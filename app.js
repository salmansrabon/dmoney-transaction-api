const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');

const { swaggerUserDocument, swaggerTrnxDocument } = require('./swagger');
const swaggerUi = require('swagger-ui-express');

// Separate middleware instances for each route
const userSwaggerUi = swaggerUi.setup(swaggerUserDocument);
const transactionSwaggerUi = swaggerUi.setup(swaggerTrnxDocument);

app.use('/api-docs/user', swaggerUi.serveFiles(swaggerUserDocument), userSwaggerUi);
app.use('/api-docs/transaction', swaggerUi.serveFiles(swaggerTrnxDocument), transactionSwaggerUi);

app.use(express.urlencoded({ extended: true })); // <--- Add this line
app.use(express.json());


app.use(cors({
    origin: '*'
}));

// To see detail log
app.use(morgan('dev'));
// Read data from api body
app.use(bodyParser.json());
// To route api controller

const userRoutes = require('./api/user');
app.use('/user', userRoutes);
const transactionRoutes = require('./api/transaction/transactions');
app.use('/transaction', transactionRoutes);
const sendMoneyRoutes = require('./api/transaction/sendMoney');
app.use('/transaction', sendMoneyRoutes);
const withdrawRoutes = require('./api/transaction/withdraw');
app.use('/transaction', withdrawRoutes);
const paymentRoutes = require('./api/transaction/payment');
app.use('/transaction', paymentRoutes);
const depositRoutes = require('./api/transaction/deposit');
app.use('/transaction', depositRoutes);

// If user inputs wrong API URL then show in json format
app.use((req, res, next) => {
    const err = new Error(`${req.method} ${req.url} Not Found`);
    err.status = 404;
    next(err);
});

// If any internal error occurs then show in json format
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500);
    res.json({
        error: {
            message: err.message,
        },
    });
});

module.exports=app;