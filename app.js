const express = require("express");
const app = express();
const morgan = require("morgan");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
const http = require("http");

const {swaggerUserDocument,swaggerTrnxDocument,} = require("./swagger/swagger.js");

const errorLogStream = fs.createWriteStream("./logs/runtime.log", {
  flags: "a",
});

let lastConsoleError = ""; // Buffer to store latest error before request logs

const originalConsoleError = console.error;
console.error = function (...args) {
  const logText =
    args
      .map((arg) =>
        typeof arg === "string" ? arg : JSON.stringify(arg, null, 2)
      )
      .join(" ") + "\n";

  lastConsoleError += logText; // Capture for request-based logging

  originalConsoleError.apply(console, args); // Still show in console
};

// 🌐 Middleware configurations
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: "*" }));
app.use(morgan("dev"));

// 🔗 Capture 4xx/5xx request logs BEFORE response is sent
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
      const stack = res.locals.errorDetails || lastConsoleError;
      const fullLog = `${logLine}${stack ? `Error Stack:\n${stack}\n` : ""}`;

      // Write locally
      /*errorLogStream.write(fullLog);
      // Clear buffer
      lastConsoleError = "";*/ 

      //Send to MCP server
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
        console.warn("⚠️ Failed to send log to MCP:", err.message);
      });

      postReq.write(fullLog);
      postReq.end();
    }

    return originalSend.apply(this, arguments);
  };

  next();
});

// 🧾 Also pipe structured request logs via morgan (optional)
app.use(
  morgan("combined", {
    stream: {
      write: (message) => {
        // Only log to runtime.log if it’s 4xx or 5xx
        const statusCodeMatch = message.match(/" (\d{3}) /);
        if (statusCodeMatch) {
          const status = parseInt(statusCodeMatch[1]);
          if (status >= 400 && status < 600) {
            // Suppressed because we're already logging manually above
            return;
          }
        }
      },
    },
  })
);

// 🧭 Swagger
app.use(
  "/api-docs/user",
  swaggerUi.serveFiles(swaggerUserDocument),
  swaggerUi.setup(swaggerUserDocument)
);
app.use(
  "/api-docs/transaction",
  swaggerUi.serveFiles(swaggerTrnxDocument),
  swaggerUi.setup(swaggerTrnxDocument)
);

// 🚦 Routes
const userRoutes = require("./routes/user.route.js");
const transactionRoutes = require("./routes/transaction.route.js");
const defaultRoutes = require("./routes/default.route.js");

app.use("/", userRoutes);
app.use("/", transactionRoutes);
app.use("/", defaultRoutes);

// ❌ 404 Not Found
app.use((req, res, next) => {
  const err = new Error(`${req.method} ${req.url} Not Found`);
  err.status = 404;
  next(err);
});

// 🧯 Global Error Handler
app.use((err, req, res, next) => {
  const errorDetails = err.stack || err.message || "Unknown Error";
  res.locals.errorDetails = errorDetails;
  console.error(errorDetails); // Already logs to file
  res.status(err.status || 500).json({ error: { message: err.message } });
});

module.exports = app;
