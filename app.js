const express = require("express");
const app = express();
const morgan = require("morgan");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
const http = require("http");

const {swaggerUserDocument,swaggerTrnxDocument,} = require("./swagger/swagger.js");

// -- Log buffer --
let lastConsoleError = "";

// Override console.error to capture error logs globally
const originalConsoleError = console.error;
console.error = function (...args) {
  const logText = args
    .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg, null, 2)))
    .join(" ") + "\n";

  lastConsoleError += logText;
  originalConsoleError.apply(console, args);
};

// -- Middleware Config --
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: "*" }));
app.use(morgan("dev"));

// Log capture for 4xx and 5xx requests BEFORE response is sent
app.use((req, res, next) => {
  const originalSend = res.send;
  const originalStatus = res.status;

  let statusCode = 200;
  res.status = function (code) {
    statusCode = code;
    return originalStatus.apply(this, arguments);
  };

  res.send = function (body) {
    if (statusCode >= 400 && statusCode < 600) {
      const now = new Date().toISOString();
      const logLine = `${req.ip} - - [${now}] "${req.method} ${req.originalUrl} HTTP/${req.httpVersion}" ${statusCode}\n`;
      const stack = res.locals.errorDetails || lastConsoleError || "[No stacktrace]";
      const fullLog = `${logLine}${stack ? `Error Stack:\n${stack}\n` : ""}`;
  
      // Conditionally send to MCP server (only in local/dev)
      const isLocalEnv = process.env.NODE_ENV !== "production";
  
      if (isLocalEnv) {
        try {
          const postReq = http.request(
            {
              hostname: "localhost",
              port: 8000,
              path: "/logs/stream",
              method: "POST",
              headers: {
                "Content-Type": "text/plain",
                "Content-Length": Buffer.byteLength(fullLog),
              },
            },
            (res) => {
              res.on("data", () => {});
            }
          );
  
          postReq.on("error", (err) => {
            console.warn("⚠️ MCP log send failed:", err.message);
          });
  
          postReq.write(fullLog);
          postReq.end();
        } catch (e) {
          console.warn("⚠️ MCP logging exception:", e.message);
        }
      }
    }
  
    return originalSend.apply(this, arguments);
  };
  

  next();
});

// Optional: suppress morgan from writing duplicate logs to file
app.use(
  morgan("combined", {
    stream: {
      write: (message) => {
        const statusMatch = message.match(/" (\d{3}) /);
        if (statusMatch) {
          const code = parseInt(statusMatch[1]);
          if (code >= 400 && code < 600) return;
        }
      },
    },
  })
);

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
  res.locals.errorDetails = errorDetails;
  console.error(errorDetails); // Captured to buffer
  res.status(err.status || 500).json({ error: { message: err.message } });
});

// Clear error buffer after each request (safe reset)
app.use((req, res, next) => {
  lastConsoleError = "";
  next();
});

module.exports = app;
