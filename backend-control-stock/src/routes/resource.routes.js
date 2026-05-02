const express = require('express');
const { depositHandlers, tractorHandlers, semiHandlers } = require('../controllers/resource.controller');
const { adminOnly } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/deposits', depositHandlers.list);
router.post('/deposits', depositHandlers.create);
router.put('/deposits/:id', depositHandlers.update);
router.delete('/deposits/:id', adminOnly, depositHandlers.remove);

router.get('/tractors', tractorHandlers.list);
router.post('/tractors', tractorHandlers.create);
router.put('/tractors/:id', tractorHandlers.update);
router.delete('/tractors/:id', adminOnly, tractorHandlers.remove);

router.get('/semis', semiHandlers.list);
router.post('/semis', semiHandlers.create);
router.put('/semis/:id', semiHandlers.update);
router.delete('/semis/:id', adminOnly, semiHandlers.remove);

module.exports = router;
