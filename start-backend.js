const { spawn } = require("child_process");

// Start the backend server
const backend = spawn("node", ["server/index.js"], {
  stdio: "inherit",
  env: { ...process.env, PORT: "3001" },
});

backend.on("error", (err) => {
  console.error("Failed to start backend:", err);
});

backend.on("exit", (code) => {
  console.log(`Backend exited with code ${code}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  backend.kill("SIGTERM");
});

process.on("SIGINT", () => {
  backend.kill("SIGINT");
  process.exit(0);
});
