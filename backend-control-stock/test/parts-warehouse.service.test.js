const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Prisma falso en memoria para no depender de la base de datos.
const store = { items: new Map(), movements: [] };

function itemWithMovements(id) {
  const item = store.items.get(id);
  const movements = store.movements
    .filter((movement) => movement.spareItemId === id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((movement) => ({ ...movement, user: { name: movement.userId === 'u1' ? 'Ana' : 'Beto' } }));
  return { ...item, movements };
}

const fakePrisma = {
  spareItem: {
    findUnique: async ({ where, include }) => {
      if (!store.items.has(where.id)) {
        return null;
      }
      return include ? itemWithMovements(where.id) : { ...store.items.get(where.id) };
    },
    updateMany: async ({ where, data }) => {
      const item = store.items.get(where.id);
      if (!item || (where.stock && item.stock < where.stock.gte)) {
        return { count: 0 };
      }
      item.stock += data.stock.increment;
      return { count: 1 };
    },
  },
  spareItemMovement: {
    create: async ({ data }) => {
      const movement = { id: `m${store.movements.length + 1}`, createdAt: new Date(Date.now() + store.movements.length), ...data };
      store.movements.push(movement);
      return movement;
    },
  },
  $transaction: async (callback) => callback(fakePrisma),
};

require.cache[path.resolve(__dirname, '../src/config/prisma.js')] = {
  id: 'prisma',
  filename: 'prisma',
  loaded: true,
  exports: fakePrisma,
};

const { summarizeLatestMovement, updateSpareItemStock } = require('../src/services/parts-warehouse.service');

function movement(id, userId, action, quantity, minutesAgo) {
  return {
    id,
    userId,
    action,
    quantity,
    resultingStock: 0,
    createdAt: new Date(Date.UTC(2026, 10, 2, 12, 0) - minutesAgo * 60 * 1000),
    user: { name: userId },
  };
}

test('summarizeLatestMovement suma los clics seguidos de la misma persona', () => {
  const summary = summarizeLatestMovement([
    movement('a', 'u1', 'REMOVE', 1, 0),
    movement('b', 'u1', 'REMOVE', 1, 0.2),
    movement('c', 'u1', 'REMOVE', 1, 0.4),
    movement('d', 'u2', 'REMOVE', 5, 1),
  ]);

  assert.equal(summary.id, 'a');
  assert.equal(summary.action, 'REMOVE');
  assert.equal(summary.quantity, 3);
  assert.equal(summary.userName, 'u1');
});

test('summarizeLatestMovement corta cuando cambia la accion o pasa mucho tiempo', () => {
  assert.equal(
    summarizeLatestMovement([movement('a', 'u1', 'REMOVE', 2, 0), movement('b', 'u1', 'ADD', 4, 1)]).quantity,
    2,
  );
  assert.equal(
    summarizeLatestMovement([movement('a', 'u1', 'REMOVE', 2, 0), movement('b', 'u1', 'REMOVE', 4, 30)]).quantity,
    2,
  );
  assert.equal(summarizeLatestMovement([]), null);
});

test('updateSpareItemStock registra la cantidad exacta y devuelve el ultimo movimiento', async () => {
  store.items.set('foco', { id: 'foco', name: 'Foco H4', category: 'FOCOS', stock: 10 });

  const afterBatch = await updateSpareItemStock('foco', { delta: -3 }, { id: 'u1' });
  assert.equal(afterBatch.stock, 7);
  assert.equal(afterBatch.movements, undefined);
  assert.deepEqual(
    { action: afterBatch.latestMovement.action, quantity: afterBatch.latestMovement.quantity, userName: afterBatch.latestMovement.userName },
    { action: 'REMOVE', quantity: 3, userName: 'Ana' },
  );

  const afterSecondClick = await updateSpareItemStock('foco', { delta: -1 }, { id: 'u1' });
  assert.equal(afterSecondClick.stock, 6);
  assert.equal(afterSecondClick.latestMovement.quantity, 4);

  const otherUser = await updateSpareItemStock('foco', { delta: 2 }, { id: 'u2' });
  assert.equal(otherUser.stock, 8);
  assert.deepEqual(
    { action: otherUser.latestMovement.action, quantity: otherUser.latestMovement.quantity, userName: otherUser.latestMovement.userName },
    { action: 'ADD', quantity: 2, userName: 'Beto' },
  );
});

test('updateSpareItemStock no deja el stock en negativo', async () => {
  store.items.set('tornillo', { id: 'tornillo', name: 'Tornillo', category: 'FERRETERIA', stock: 1 });

  await assert.rejects(updateSpareItemStock('tornillo', { delta: -2 }, { id: 'u1' }), /negativo/);
  assert.equal(store.items.get('tornillo').stock, 1);
  await assert.rejects(updateSpareItemStock('tornillo', { delta: 0 }, { id: 'u1' }), /valido/);
  await assert.rejects(updateSpareItemStock('nada', { delta: 1 }, { id: 'u1' }), /no encontrado/);
});
