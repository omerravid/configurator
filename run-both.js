const { spawn } = require("child_process");
const path = require("path");

console.log("Starting Configuration Manager...");

// Start backend server
console.log("Starting backend server on port 3002...");
const backend = spawn("node", ["index.js"], {
  cwd: path.join(__dirname, "server"),
  stdio: ["inherit", "pipe", "pipe"],
  env: { ...process.env, PORT: "3002" },
});

backend.stdout.on("data", (data) => {
  console.log(`[BACKEND] ${data.toString().trim()}`);
});

backend.stderr.on("data", (data) => {
  console.error(`[BACKEND ERROR] ${data.toString().trim()}`);
});

// Start frontend after a short delay
setTimeout(() => {
  console.log("Starting frontend server on port 5173...");
  const frontend = spawn("npm", ["run", "dev"], {
    cwd: path.join(__dirname, "client"),
    stdio: ["inherit", "pipe", "pipe"],
    shell: true,
  });

  frontend.stdout.on("data", (data) => {
    console.log(`[FRONTEND] ${data.toString().trim()}`);
  });

  frontend.stderr.on("data", (data) => {
    console.error(`[FRONTEND ERROR] ${data.toString().trim()}`);
  });

  frontend.on("error", (err) => {
    console.error("Failed to start frontend:", err);
  });
}, 2000);

backend.on("error", (err) => {
  console.error("Failed to start backend:", err);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down...");
  backend.kill("SIGTERM");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Shutting down...");
  backend.kill("SIGINT");
  process.exit(0);
});
