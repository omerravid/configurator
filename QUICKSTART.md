# Configuration Manager - Quick Reference

## 🚀 Quick Start

### Using Docker (Recommended for Windows)

```bash
# Start everything with Docker
make docker-up

# Or run the quick start script
docker-start.bat         # Windows
./docker-start.sh        # Mac/Linux
```

**Services:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- MongoDB: localhost:27017

### Without Docker

```bash
# Install dependencies
make install

# Run both frontend and backend
make dev
```

## 📋 Common Commands

### Docker Commands

| Command | Description |
|---------|-------------|
| `make docker-up` | Start all services |
| `make docker-backend` | Start only backend + MongoDB |
| `make docker-down` | Stop all services |
| `make docker-logs` | View logs |
| `make docker-restart` | Restart services |
| `make docker-clean` | Clean everything |

### Local Development Commands

| Command | Description |
|---------|-------------|
| `make dev` | Run frontend + backend |
| `make frontend` | Run only frontend |
| `make backend` | Run only backend |
| `make install` | Install dependencies |
| `make build` | Build for production |
| `make test` | Run all tests |
| `make clean` | Clean build artifacts |

## 🏗️ Project Structure

```
configurator/
├── client/              # React frontend
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── server-go/          # Go backend
│   ├── cmd/server/
│   ├── internal/
│   └── go.mod
├── docker-compose.yml  # Docker configuration
├── Makefile           # Command shortcuts
└── README.md          # Full documentation
```

## 🔧 Development Workflow

### Frontend Development (with Docker Backend)

```bash
# Terminal 1: Start backend with Docker
make docker-backend

# Terminal 2: Run frontend locally (hot reload)
make frontend
```

### Full Local Development

```bash
# Install dependencies first (one time)
make install

# Run both services
make dev
```

### Testing

```bash
# Run all tests
make test

# Frontend tests only
make test-frontend

# Backend tests only
make test-go
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3001
kill -9 <PID>
```

### Docker Issues

```bash
# Clean restart
make docker-clean
make docker-build
make docker-up

# View logs
make docker-logs-backend
make docker-logs-frontend
```

### MongoDB Connection Issues

```bash
# Check if MongoDB is running
docker ps

# View MongoDB logs
make docker-logs-mongo

# Access MongoDB shell
make docker-mongo-shell
```

## 📚 Documentation

- **[Full README](./README.md)** - Complete documentation
- **[Docker Guide](./DOCKER.md)** - Docker setup and troubleshooting
- **[User Manual](./USER_MANUAL.md)** - Application usage guide
- **[API Specification](./API_SPECIFICATION.md)** - API documentation

## 🔑 Default Credentials

After first run, create an admin user via the API or use:

```bash
# Create admin user (example)
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","role":"ADMIN"}'
```

## 🌐 URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
- **API Health**: http://localhost:3001/api/health
- **MongoDB**: mongodb://localhost:27017

## 💡 Tips

1. **Use Docker for backend** - Easier setup, no Go installation needed
2. **Run frontend locally** - Faster hot reload during development
3. **Use Make commands** - Simpler than remembering Docker commands
4. **Check logs often** - `make docker-logs` shows what's happening
5. **Clean start** - Use `make docker-clean` when things go wrong

## 🆘 Getting Help

```bash
# Show all available commands
make help

# Check Docker status
docker ps

# Check service health
curl http://localhost:3001/api/health
```

## 📦 What Gets Installed

### With Docker
- Nothing on your machine! Everything runs in containers

### Without Docker
- **Node.js 20+** - For frontend development
- **Go 1.25+** - For backend development
- **MongoDB** - Database (or use Docker for this only)

## 🎯 Recommended Setup for Development

```bash
# Use Docker for backend and MongoDB (no installation needed)
make docker-backend

# Run frontend locally (faster hot reload)
make frontend
```

This gives you the best of both worlds:
- ✅ No MongoDB/Go installation needed
- ✅ Fast frontend hot reload
- ✅ Easy to debug backend via logs
- ✅ Can rebuild backend with `make docker-build`


