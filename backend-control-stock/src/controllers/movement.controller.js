const movementService = require('../services/movement.service');

async function listMovements(_req, res, next) {
  try {
    const movements = await movementService.listMovements();
    return res.json(movements);
  } catch (error) {
    return next(error);
  }
}

async function createMovement(req, res, next) {
  try {
    const movement = await movementService.createMovement(req.body, req.user.id);
    return res.status(201).json(movement);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listMovements,
  createMovement,
};
