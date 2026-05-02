const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/resumen', dashboardController.getSummary);

module.exports = router;
