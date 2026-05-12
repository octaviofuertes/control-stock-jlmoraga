const warehouseService = require('../services/parts-warehouse.service');

async function getState(_req, res, next) {
  try {
    return res.json(await warehouseService.getWarehouseState());
  } catch (error) {
    return next(error);
  }
}

async function createItem(req, res, next) {
  try {
    return res.status(201).json(await warehouseService.createSpareItem(req.body));
  } catch (error) {
    return next(error);
  }
}

async function updateItemStock(req, res, next) {
  try {
    return res.json(await warehouseService.updateSpareItemStock(req.params.id, req.body, req.user));
  } catch (error) {
    return next(error);
  }
}

async function updateOil(req, res, next) {
  try {
    return res.json(await warehouseService.updateOilStock(req.body));
  } catch (error) {
    return next(error);
  }
}

async function deleteItem(req, res, next) {
  try {
    await warehouseService.deleteSpareItem(req.params.id);
    return res.json({ message: 'Repuesto eliminado correctamente.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getState,
  createItem,
  updateItemStock,
  deleteItem,
  updateOil,
};
