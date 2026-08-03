require('./config/env');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const authRoutes = require('./routes/auth.routes');
const tireRoutes = require('./routes/tire.routes');
const movementRoutes = require('./routes/movement.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const resourceRoutes = require('./routes/resource.routes');
const userRoutes = require('./routes/user.routes');
const partsWarehouseRoutes = require('./routes/parts-warehouse.routes');
const aiRecommendationRoutes = require('./routes/ai-recommendation.routes');
const authMiddleware = require('./middlewares/auth.middleware');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'API de control de stock operativa.' });
});

app.use('/auth', authRoutes);
app.use(authMiddleware);
app.use('/users', userRoutes);
app.use('/tires', tireRoutes);
app.use('/gomas', tireRoutes);
app.use('/movimientos', movementRoutes);
app.use('/', resourceRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/repuestos', partsWarehouseRoutes);
app.use('/recomendaciones-ia', aiRecommendationRoutes);

app.use(errorMiddleware);

module.exports = app;
