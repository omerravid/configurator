# 📖 Visual Step-by-Step Guide

## Running Configuration Manager with Docker

---

## ⚡ Quick Start (Copy & Paste These Commands)

### Option 1: Recommended for Development

**Step 1 - Open Command Prompt/Terminal:**
```bash
cd C:\Dev\POC\configurator
```

**Step 2 - Start Backend (Go + MongoDB) in Docker:**
```bash
make docker-backend
```

**Step 3 - Open NEW Terminal and Start Frontend:**
```bash
cd C:\Dev\POC\configurator
make frontend
```

**Step 4 - Open Browser:**
```
http://localhost:5173
```

✅ **Done! Your app is running.**

---

### Option 2: Everything in Docker

**Step 1 - Open Command Prompt/Terminal:**
```bash
cd C:\Dev\POC\configurator
```

**Step 2 - Start All Services:**
```bash
make docker-up
```

**Step 3 - Open Browser:**
```
http://localhost:5173
```

✅ **Done! Your app is running.**

---

## 🖼️ Visual Flow

### Option 1 (Recommended)

```
┌─────────────────────────────────────┐
│  Terminal 1                         │
│  ┌───────────────────────────────┐  │
│  │ > make docker-backend         │  │
│  │                               │  │
│  │ [Backend] Starting...         │  │
│  │ [MongoDB] Starting...         │  │
│  │ ✓ Services started!           │  │
│  │ ✓ Backend: localhost:3001     │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Terminal 2 (NEW)                   │
│  ┌───────────────────────────────┐  │
│  │ > make frontend               │  │
│  │                               │  │
│  │ VITE v5.x.x ready            │  │
│  │ ➜ Local: http://localhost:5173│ │
│  │ ✓ Frontend running!           │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Browser                            │
│  ┌───────────────────────────────┐  │
│  │ http://localhost:5173         │  │
│  │                               │  │
│  │ ┌───────────────────────────┐ │  │
│  │ │ Configuration Manager    │ │  │
│  │ │ [Login Screen]           │ │  │
│  │ └───────────────────────────┘ │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## 🎬 Stopping Services

### Stop Option 1 (Docker Backend + Local Frontend)

**Terminal 2 (Frontend):**
```
Press Ctrl+C
```

**Terminal 1 (Docker):**
```bash
make docker-down
```

### Stop Option 2 (All Docker)

```bash
make docker-down
```

---

## 🔍 Checking if Services Are Running

```bash
# Check Docker services
docker ps

# You should see:
# - configurator-backend
# - configurator-mongo
```

```bash
# Check backend health
curl http://localhost:3001/api/health

# Should return: {"status":"ok"}
```

```bash
# Check frontend
# Open browser to: http://localhost:5173
```

---

## 📊 Service Status Indicators

### Backend Running ✅
```
Container: configurator-backend
Status: Up X seconds (healthy)
Port: 0.0.0.0:3001->3001/tcp
```

### MongoDB Running ✅
```
Container: configurator-mongo
Status: Up X seconds (healthy)
Port: 0.0.0.0:27017->27017/tcp
```

### Frontend Running ✅
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

## 🚨 Common Errors & Fixes

### Error: "Docker is not running"

**See:**
```
Cannot connect to the Docker daemon
```

**Fix:**
1. Open Docker Desktop
2. Wait for it to start (whale icon in system tray)
3. Try command again

---

### Error: "Port 3001 already in use"

**See:**
```
Bind for 0.0.0.0:3001 failed: port is already allocated
```

**Fix:**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Then try again
make docker-down
make docker-backend
```

---

### Error: "MongoDB connection failed"

**See:**
```
Failed to connect to MongoDB
```

**Fix:**
```bash
# Wait 10-20 seconds for MongoDB to fully start
# Or check logs:
make docker-logs-mongo

# If still failing:
make docker-clean
make docker-backend
```

---

### Error: "Cannot GET /api/health"

**See:**
```
curl http://localhost:3001/api/health
curl: (7) Failed to connect
```

**Fix:**
```bash
# Check if backend is running
docker ps

# If not listed, check logs
make docker-logs-backend

# Restart
make docker-restart
```

---

## 📱 Full Command Reference

### Starting Services
| Command | What It Does |
|---------|-------------|
| `make docker-backend` | Start Go backend + MongoDB |
| `make frontend` | Start React frontend locally |
| `make docker-up` | Start everything in Docker |

### Monitoring
| Command | What It Does |
|---------|-------------|
| `docker ps` | List running containers |
| `make docker-logs` | View all logs |
| `make docker-logs-backend` | View backend logs only |

### Stopping
| Command | What It Does |
|---------|-------------|
| `make docker-down` | Stop all Docker services |
| `Ctrl+C` | Stop local frontend |

### Troubleshooting
| Command | What It Does |
|---------|-------------|
| `make docker-clean` | Remove all containers/volumes |
| `make docker-build` | Rebuild Docker images |
| `make docker-restart` | Restart services |

### Information
| Command | What It Does |
|---------|-------------|
| `make help` | Show all commands |
| `verify-docker-setup.bat` | Check if setup is correct |

---

## 🎯 Daily Usage Pattern

### Morning (Start Work)

```bash
# Terminal 1
cd C:\Dev\POC\configurator
make docker-backend

# Terminal 2 (new window)
cd C:\Dev\POC\configurator
make frontend
```

### During Work

- Edit files in `client/src/` → Frontend auto-reloads ✅
- Edit files in `server-go/` → Need to rebuild:
  ```bash
  make docker-build
  make docker-restart
  ```

### Evening (End Work)

```bash
# Terminal 2 (Frontend)
Ctrl+C

# Terminal 1 (Docker)
make docker-down
```

---

## 🎓 Learning Path

### Day 1: Getting Started
1. ✅ Run `verify-docker-setup.bat`
2. ✅ Run `make docker-backend`
3. ✅ Run `make frontend`
4. ✅ Open http://localhost:5173

### Day 2: Understanding Services
1. ✅ Run `docker ps` to see containers
2. ✅ Run `make docker-logs` to see logs
3. ✅ Test `curl http://localhost:3001/api/health`
4. ✅ Understand the architecture

### Day 3: Making Changes
1. ✅ Edit a frontend file, see hot-reload
2. ✅ Edit a backend file, rebuild Docker
3. ✅ Check logs for errors
4. ✅ Practice clean restart

### Day 4: Troubleshooting
1. ✅ Practice `make docker-clean`
2. ✅ Learn to read error logs
3. ✅ Find processes using ports
4. ✅ Understand data persistence

---

## 💪 You're Ready!

### Essential Commands (Memorize These)

```bash
make docker-backend    # Start backend
make frontend          # Start frontend
make docker-logs       # View logs
make docker-down       # Stop everything
make docker-clean      # Clean restart
make help              # Show all commands
```

### Essential URLs (Bookmark These)

```
http://localhost:5173              - Frontend
http://localhost:3001/api/health   - Backend health
```

---

## 🎉 Start Coding!

Copy and paste this now:

```bash
cd C:\Dev\POC\configurator
make docker-backend
```

Then open a new terminal and run:

```bash
cd C:\Dev\POC\configurator
make frontend
```

**Open browser:** http://localhost:5173

**You're running! 🚀**

---

## 📚 More Help

- **Quick commands:** See `QUICKSTART.md`
- **Troubleshooting:** See `DOCKER_COMPLETE_GUIDE.md`
- **All commands:** Run `make help`

---

**Need help? Check the logs first:**
```bash
make docker-logs-backend
```

**Happy coding! 🎉**



