const express = require('express');
const tireController = require('../controllers/tire.controller');
const { adminOnly } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', tireController.listTires);
router.post('/', tireController.createTire);
router.get('/:id', tireController.getTireById);
router.put('/:id', tireController.updateTire);
router.delete('/:id', adminOnly, tireController.deleteTire);
router.get('/:id/historial', tireController.getTireHistory);

module.exports = router;
