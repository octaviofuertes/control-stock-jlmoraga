const resourceService = require('../services/resource.service');

function buildCrudHandlers(serviceMap) {
  return {
    list: async (_req, res, next) => {
      try {
        return res.json(await serviceMap.list());
      } catch (error) {
        return next(error);
      }
    },
    create: async (req, res, next) => {
      try {
        return res.status(201).json(await serviceMap.create(req.body));
      } catch (error) {
        return next(error);
      }
    },
    update: async (req, res, next) => {
      try {
        return res.json(await serviceMap.update(req.params.id, req.body));
      } catch (error) {
        return next(error);
      }
    },
    remove: async (req, res, next) => {
      try {
        await serviceMap.remove(req.params.id);
        return res.json({ message: 'Registro eliminado correctamente.' });
      } catch (error) {
        return next(error);
      }
    },
  };
}

const depositHandlers = buildCrudHandlers({
  list: resourceService.listDeposits,
  create: resourceService.createDeposit,
  update: resourceService.updateDeposit,
  remove: resourceService.deleteDeposit,
});

const tractorHandlers = buildCrudHandlers({
  list: resourceService.listTractors,
  create: resourceService.createTractor,
  update: resourceService.updateTractor,
  remove: resourceService.deleteTractor,
});

const semiHandlers = buildCrudHandlers({
  list: resourceService.listSemis,
  create: resourceService.createSemi,
  update: resourceService.updateSemi,
  remove: resourceService.deleteSemi,
});

module.exports = {
  depositHandlers,
  tractorHandlers,
  semiHandlers,
};
