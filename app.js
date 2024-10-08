const express = require('express');
const app = express();
const morgan = require('morgan');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const { swaggerUserDocument, swaggerTrnxDocument } = require('./swagger/swagger.js');

// Middleware configurations
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: '*' }));
app.use(morgan('dev')); // Log HTTP requests

// Swagger setup
app.use('/api-docs/user', swaggerUi.serveFiles(swaggerUserDocument), swaggerUi.setup(swaggerUserDocument));
app.use('/api-docs/transaction', swaggerUi.serveFiles(swaggerTrnxDocument), swaggerUi.setup(swaggerTrnxDocument));

// Routes setup
const userRoutes = require('./routes/user.route.js');
const transactionRoutes = require('./routes/transaction.route.js');
const defaultRoutes = require('./routes/default.route.js');

app.use('/user', userRoutes);
app.use('/transaction', transactionRoutes);
app.use('/', defaultRoutes);

// 404 error handling
app.use((req, res, next) => {
    const err = new Error(`${req.method} ${req.url} Not Found`);
    err.status = 404;
    next(err);
});

// Global error handling
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: { message: err.message } });
});

module.exports = app;
