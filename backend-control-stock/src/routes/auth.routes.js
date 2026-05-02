const express = require('express');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/login', authController.login);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
