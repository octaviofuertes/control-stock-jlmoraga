const aiRecommendationService = require('../services/ai-recommendation.service');

async function getWeeklyRecommendations(_req, res, next) {
  try {
    const data = await aiRecommendationService.getWeeklyRecommendations();
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getWeeklyRecommendations,
};
