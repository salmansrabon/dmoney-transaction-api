const express = require("express");
const app = express();
const morgan = require("morgan");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");

const {swaggerUserDocument,swaggerTrnxDocument,} = require("./swagger/swagger.js");

// Middleware Config
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: "*" }));
app.use(morgan("dev"));

// Swagger Docs
app.use("/api-docs/user", swaggerUi.serveFiles(swaggerUserDocument), swaggerUi.setup(swaggerUserDocument));
app.use("/api-docs/transaction", swaggerUi.serveFiles(swaggerTrnxDocument), swaggerUi.setup(swaggerTrnxDocument));

// Routes
const userRoutes = require("./routes/user.route.js");
const transactionRoutes = require("./routes/transaction.route.js");
const defaultRoutes = require("./routes/default.route.js");

app.use("/", userRoutes);
app.use("/", transactionRoutes);
app.use("/", defaultRoutes);

// 404 Not Found Handler
app.use((req, res, next) => {
  const err = new Error(`${req.method} ${req.url} Not Found`);
  err.status = 404;
  next(err);
});

// Global Error Handler
app.use((err, req, res, next) => {
  const errorDetails = err.stack || err.message || "Unknown Error";
  console.error(errorDetails);
  res.status(err.status || 500).json({ error: { message: err.message } });
});

module.exports = app;
