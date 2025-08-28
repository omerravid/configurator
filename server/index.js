require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 3002;

const { initializeSampleData } = require("./scripts/init-sample-data");

// Initialize database conditionally
let db;
if (process.env.USE_MONGODB !== 'true') {
  db = require("./models/database");
}

// Initialize MongoDB if enabled
if (process.env.USE_MONGODB === 'true') {
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
      console.log('Falling back to SQLite...');
      process.env.USE_MONGODB = 'false';
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

// Make database available to all routes (only for SQLite)
if (db) {
  app.locals.db = db;
}

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/configs", require("./routes/configurations"));
app.use("/api/users", require("./routes/users"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/files", require("./routes/files"));
app.use("/api/folder-import", require("./routes/folder-import"));
app.use("/api/file-management", require("./routes/file-management"));

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

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);

  // Initialize sample data if database is empty (with delay to ensure admin user is created)
  setTimeout(async () => {
    try {
      await initializeSampleData();
    } catch (error) {
      console.log('Sample data initialization handled:', error.message);
    }
  }, 2000); // 2 second delay
});

module.exports = app;
