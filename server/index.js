require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 3003;

const { initializeSampleData } = require("./scripts/init-sample-data");

// Initialize database conditionally
let db;
if (process.env.USE_MONGODB !== 'true') {
  db = require("./models/database");
}

// Initialize MongoDB if enabled
if (process.env.USE_MONGODB === 'true') {
  const embeddedMongo = require("./models/embedded-mongodb");
  const DatabaseManager = require("./services/DatabaseManager");

  // Start embedded MongoDB and initialize DatabaseManager
  embeddedMongo.start()
    .then(async () => {
      console.log('Embedded MongoDB initialized successfully');

      // Small delay to ensure MongoDB is fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Initialize DatabaseManager
      await DatabaseManager.initialize();

      // Manually add embedded MongoDB configuration
      try {
        const connectionString = embeddedMongo.getConnectionString();
        if (connectionString) {
          await DatabaseManager.addDatabase({
            name: 'Embedded MongoDB',
            connectionString: connectionString,
            description: 'Built-in embedded MongoDB server',
            isEmbedded: true
          });

          // Set it as active
          await DatabaseManager.setActiveDatabase('Embedded MongoDB');
          console.log('Embedded MongoDB registered and set as active database');
        }
      } catch (error) {
        console.log('Embedded MongoDB already configured or error:', error.message);
      }

      // Connect to active database
      const activeDb = DatabaseManager.getActiveDatabase();
      if (activeDb) {
        await DatabaseManager.connectToDatabase(activeDb.name);
        console.log(`Connected to active database: ${activeDb.name}`);
      } else {
        console.log('No active database found, using embedded MongoDB connection');
      }

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
} else {
  // For SQLite mode, still initialize DatabaseManager for consistency
  const DatabaseManager = require("./services/DatabaseManager");
  DatabaseManager.initialize().catch(console.error);
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
app.use(express.json({ limit: "500mb" })); // Increased for large backup files
app.use(express.urlencoded({ extended: true, limit: "500mb" }));

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
app.use("/api/rules", require("./routes/rules"));

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
      const force = process.env.FORCE_SAMPLE === 'true';
      await initializeSampleData(force);
    } catch (error) {
      console.log('Sample data initialization handled:', error.message);
    }
  }, 2000); // 2 second delay
});

module.exports = app;
