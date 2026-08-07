const express = require('express');
const aiRecommendationController = require('../controllers/ai-recommendation.controller');
const { adminOnly } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', aiRecommendationController.getWeeklyRecommendations);
router.post('/recalcular', adminOnly, aiRecommendationController.regenerateWeeklyRecommendations);

module.exports = router;
