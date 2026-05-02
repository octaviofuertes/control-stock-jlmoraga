const userService = require('../services/user.service');

async function listUsers(_req, res, next) {
  try {
    return res.json(await userService.listUsers());
  } catch (error) {
    return next(error);
  }
}

async function createUser(req, res, next) {
  try {
    return res.status(201).json(await userService.createUser(req.body));
  } catch (error) {
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    await userService.deleteUser(req.params.id, req.user.id);
    return res.json({ message: 'Usuario eliminado correctamente.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listUsers,
  createUser,
  deleteUser,
};
