const express = require('express');
const aiRecommendationController = require('../controllers/ai-recommendation.controller');

const router = express.Router();

router.get('/', aiRecommendationController.getWeeklyRecommendations);

module.exports = router;
