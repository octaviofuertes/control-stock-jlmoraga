const express = require('express');
const userController = require('../controllers/user.controller');
const { adminOnly } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', adminOnly, userController.listUsers);
router.post('/', adminOnly, userController.createUser);

module.exports = router;
