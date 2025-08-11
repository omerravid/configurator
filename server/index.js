require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 3002;

// Database initialization is handled by embedded MongoDB

// Initialize MongoDB by default (can be disabled with USE_MONGODB='false')
if (process.env.USE_MONGODB !== 'false') {
  const embeddedMongo = require("./models/embedded-mongodb");

  // Start embedded MongoDB on startup
  embeddedMongo.start()
    .then(() => {
      console.log('Embedded MongoDB initialized successfully');
      // Initialize default data
      return embeddedMongo.initializeData();
    })
    .catch(error => {
      console.error('Failed to start embedded MongoDB:', error.message);
      console.error('Cannot start application without database. Exiting...');
      process.exit(1);
    });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down embedded MongoDB...');
    await embeddedMongo.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Shutting down embedded MongoDB...');
    await embeddedMongo.stop();
    process.exit(0);
  });
}

// Middleware
app.use(helmet());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? false
        : ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// MongoDB models are available through the models/index.js

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/configs", require("./routes/configurations"));
app.use("/api/users", require("./routes/users"));
app.use("/api/settings", require("./routes/settings"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
