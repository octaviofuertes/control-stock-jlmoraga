const express = require('express');
const movementController = require('../controllers/movement.controller');

const router = express.Router();

router.get('/', movementController.listMovements);
router.post('/', movementController.createMovement);

module.exports = router;
