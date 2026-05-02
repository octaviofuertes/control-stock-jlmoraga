const tireService = require('../services/tire.service');

async function listTires(req, res, next) {
  try {
    const tires = await tireService.listTires(req.query);
    return res.json(tires);
  } catch (error) {
    return next(error);
  }
}

async function getTireById(req, res, next) {
  try {
    const tire = await tireService.getTireById(req.params.id);
    return res.json(tire);
  } catch (error) {
    return next(error);
  }
}

async function createTire(req, res, next) {
  try {
    const tire = await tireService.createTire(req.body);
    return res.status(201).json(tire);
  } catch (error) {
    return next(error);
  }
}

async function updateTire(req, res, next) {
  try {
    const tire = await tireService.updateTire(req.params.id, req.body);
    return res.json(tire);
  } catch (error) {
    return next(error);
  }
}

async function deleteTire(req, res, next) {
  try {
    const response = await tireService.deleteTire(req.params.id);
    return res.json(response);
  } catch (error) {
    return next(error);
  }
}

async function getTireHistory(req, res, next) {
  try {
    const movements = await tireService.getTireHistory(req.params.id);
    return res.json(movements);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listTires,
  getTireById,
  createTire,
  updateTire,
  deleteTire,
  getTireHistory,
};
