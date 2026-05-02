const dashboardService = require('../services/dashboard.service');

async function getSummary(_req, res, next) {
  try {
    const summary = await dashboardService.getDashboardSummary();
    return res.json(summary);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getSummary,
};
