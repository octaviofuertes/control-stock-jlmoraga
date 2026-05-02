const express = require('express');
const warehouseController = require('../controllers/parts-warehouse.controller');

const router = express.Router();

router.get('/', warehouseController.getState);
router.post('/items', warehouseController.createItem);
router.patch('/items/:id/stock', warehouseController.updateItemStock);
router.patch('/oil', warehouseController.updateOil);

module.exports = router;
