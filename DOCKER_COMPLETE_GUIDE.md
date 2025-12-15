# 🐋 Complete Docker Setup for Configuration Manager

## Summary

I've created a complete Docker setup that allows you to run the Go backend server from Docker without needing to install Go or MongoDB on your Windows machine. This setup provides flexibility to run services in different combinations based on your needs.

---

## 📦 What Was Created

### Configuration Files
1. **`docker-compose.yml`** - Orchestrates all services (Frontend, Backend, MongoDB)
2. **`Makefile`** - Enhanced with 20+ Docker commands for easy management
3. **`.dockerignore`** - Optimizes Docker builds
4. **`server-go/.dockerignore`** - Backend-specific ignore rules

### Frontend Docker Files
5. **`client/Dockerfile.dev`** - Development container with hot-reload
6. **`client/Dockerfile`** - Production-ready container with Nginx
7. **`client/nginx.conf`** - Nginx configuration for production

### Environment & Scripts
8. **`env.example`** - Environment variables template
9. **`docker-start.bat`** - Windows quick-start wizard
10. **`docker-start.sh`** - Mac/Linux quick-start wizard
11. **`verify-docker-setup.bat`** - Windows setup verification
12. **`verify-docker-setup.sh`** - Mac/Linux setup verification

### Documentation
13. **`DOCKER.md`** - Comprehensive Docker guide (troubleshooting, architecture, etc.)
14. **`QUICKSTART.md`** - Quick reference for common tasks
15. **`DOCKER_SETUP_SUMMARY.md`** - This summary document

---

## 🚀 Quick Start Guide

### Prerequisites
- Docker Desktop installed and running
- Make (comes with Git Bash on Windows)

### Option 1: Backend in Docker + Frontend Locally (⭐ Recommended)

This is the **best approach for development**:

```bash
# Terminal 1: Start Go backend and MongoDB in Docker
make docker-backend

# Terminal 2: Run frontend locally
make frontend
```

**Why this is recommended:**
- ✅ No Go or MongoDB installation needed
- ✅ Frontend hot-reload is fastest
- ✅ Easy to debug both services
- ✅ Can restart backend: `make docker-restart`

### Option 2: Everything in Docker

```bash
make docker-up
```

This starts all three services in Docker containers.

### Option 3: Use Quick-Start Wizard

**Windows:**
```cmd
docker-start.bat
```

**Mac/Linux:**
```bash
chmod +x docker-start.sh
./docker-start.sh
```

The wizard will guide you through the options.

---

## 📋 Essential Commands

### Starting Services

```bash
# Start backend + MongoDB only (recommended)
make docker-backend

# Start everything (frontend + backend + MongoDB)
make docker-up

# Run frontend locally
make frontend
```

### Managing Services

```bash
# Stop all Docker services
make docker-down

# Restart services
make docker-restart

# Rebuild Docker images
make docker-build
```

### Monitoring

```bash
# View all logs
make docker-logs

# View backend logs only
make docker-logs-backend

# View MongoDB logs
make docker-logs-mongo
```

### Troubleshooting

```bash
# Clean everything and start fresh
make docker-clean
make docker-build
make docker-up

# Access backend shell
make docker-shell-backend

# Access MongoDB shell
make docker-mongo-shell
```

### Verification

```bash
# Verify Docker setup
verify-docker-setup.bat    # Windows
./verify-docker-setup.sh   # Mac/Linux

# Check service health
curl http://localhost:3001/api/health
```

---

## 🌐 Service URLs

After starting services, access them at:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/api/health
- **MongoDB**: mongodb://localhost:27017

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│              Your Windows Machine                │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │         Docker Desktop                   │   │
│  │                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │  Frontend*   │  │   Backend    │   │   │
│  │  │  (React)     │◄─┤   (Go/Gin)   │   │   │
│  │  │  Port: 5173  │  │  Port: 3001  │   │   │
│  │  └──────────────┘  └──────┬───────┘   │   │
│  │                            │            │   │
│  │                     ┌──────▼───────┐   │   │
│  │                     │   MongoDB    │   │   │
│  │                     │  Port: 27017 │   │   │
│  │                     └──────────────┘   │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  * Can run locally or in Docker                 │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Recommended Workflow

### Daily Development

1. **Start Backend Services:**
   ```bash
   make docker-backend
   ```
   Wait until you see "Configuration Manager Service started" in logs.

2. **Start Frontend (in new terminal):**
   ```bash
   make frontend
   ```

3. **Open Browser:**
   - Navigate to http://localhost:5173

4. **Develop:**
   - Frontend changes auto-reload
   - Backend changes require rebuild: `make docker-build && make docker-restart`

5. **Monitor Logs (optional, in new terminal):**
   ```bash
   make docker-logs-backend
   ```

6. **Stop Services:**
   ```bash
   make docker-down
   ```

### Testing Changes

```bash
# Frontend tests
cd client
npm test

# Backend tests
cd server-go
go test ./...
# or
make test-go
```

### Building for Production

```bash
# Build both frontend and backend
make build

# Or individually
make build-frontend
make build-go
```

---

## ⚙️ Configuration

### Environment Variables

1. Copy the example file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` with your values:
   ```env
   SERVER_PORT=3001
   JWT_SECRET=your-secret-key-min-32-chars
   MONGODB_URI=mongodb://mongo:27017
   MONGO_DB_NAME=config_manager
   ```

3. Restart services:
   ```bash
   make docker-down
   make docker-up
   ```

### Changing Ports

Edit `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "3002:3001"  # Change external port to 3002
```

---

## 🐛 Troubleshooting Guide

### Problem: Docker won't start

**Solution:**
```bash
# Check if Docker Desktop is running
docker ps

# If not, start Docker Desktop
```

### Problem: Port already in use

**Windows:**
```cmd
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

**Mac/Linux:**
```bash
lsof -i :3001
kill -9 <PID>
```

### Problem: Backend container exits immediately

**Solution:**
```bash
# View logs to see error
make docker-logs-backend

# Common fixes:
make docker-clean       # Clean everything
make docker-build       # Rebuild
make docker-up          # Start again
```

### Problem: MongoDB connection failed

**Solution:**
```bash
# Check MongoDB is running and healthy
docker ps

# Should show "(healthy)" next to mongo
# If not, wait 10-20 seconds for health check

# Check MongoDB logs
make docker-logs-mongo
```

### Problem: Frontend can't reach backend

**Check backend is running:**
```bash
docker ps
curl http://localhost:3001/api/health
```

**Check environment:**
```bash
# In client/.env or frontend container
VITE_API_BASE_URL=http://localhost:3001/api
```

### Problem: Changes not reflected

**Frontend:** Should auto-reload. If not, restart `make frontend`

**Backend:**
```bash
make docker-build
make docker-restart
```

### Nuclear Option: Clean Start

```bash
# Stop everything
make docker-down

# Remove all data (WARNING: deletes database!)
make docker-clean

# Rebuild from scratch
make docker-build

# Start fresh
make docker-up
```

---

## 💾 Data Persistence

Docker uses named volumes to persist data:

- **configurator-mongo-data**: MongoDB database
- **configurator-files-data**: Uploaded configuration files

**View volumes:**
```bash
docker volume ls
```

**Backup data:**
```bash
docker run --rm -v configurator-mongo-data:/data -v $(pwd):/backup ubuntu tar czf /backup/mongo-backup.tar.gz /data
```

**Restore data:**
```bash
docker run --rm -v configurator-mongo-data:/data -v $(pwd):/backup ubuntu tar xzf /backup/mongo-backup.tar.gz -C /
```

---

## 📊 Performance Tips

1. **Use Docker Backend + Local Frontend** for fastest development
2. **Allocate more resources** to Docker Desktop (Settings → Resources)
3. **Use .dockerignore** to exclude unnecessary files
4. **Multi-stage builds** already configured for smaller images

---

## 🔒 Security Notes

1. **Change secrets in production:**
   - `JWT_SECRET` - Minimum 32 characters
   - `API_KEY` - Strong random key

2. **Use environment variables:**
   - Never commit `.env` files
   - Use `env.example` as template

3. **Production checklist:**
   - [ ] Change all default secrets
   - [ ] Use HTTPS (reverse proxy with SSL)
   - [ ] Use external MongoDB for production
   - [ ] Enable rate limiting
   - [ ] Review security headers in `client/nginx.conf`

---

## 📚 Additional Resources

### Documentation
- **[QUICKSTART.md](./QUICKSTART.md)** - Quick reference cheat sheet
- **[DOCKER.md](./DOCKER.md)** - Detailed Docker documentation
- **[README.md](./README.md)** - Full project documentation
- **[USER_MANUAL.md](./USER_MANUAL.md)** - How to use the application

### Command Reference
```bash
make help              # Show all available commands
docker-compose --help  # Docker Compose help
docker --help          # Docker help
```

### Online Resources
- [Docker Desktop Documentation](https://docs.docker.com/desktop/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Go Documentation](https://go.dev/doc/)
- [React Documentation](https://react.dev/)

---

## ✅ Verification Checklist

Run through this checklist to ensure everything works:

- [ ] Docker Desktop is installed and running
- [ ] `make help` shows all commands
- [ ] `make docker-backend` starts successfully
- [ ] http://localhost:3001/api/health returns 200 OK
- [ ] `make frontend` starts successfully (in new terminal)
- [ ] http://localhost:5173 loads the application
- [ ] Can create/view configurations in the UI
- [ ] `make docker-logs` shows logs without errors
- [ ] `make docker-down` stops all services cleanly

Run automated verification:
```bash
verify-docker-setup.bat    # Windows
./verify-docker-setup.sh   # Mac/Linux
```

---

## 🎓 Next Steps

1. **Start the application:**
   ```bash
   make docker-backend
   make frontend
   ```

2. **Access the app:**
   - Open http://localhost:5173

3. **Create admin user:**
   - Register via the UI or use API

4. **Read the documentation:**
   - QUICKSTART.md for daily tasks
   - DOCKER.md for advanced usage
   - USER_MANUAL.md for features

5. **Customize configuration:**
   - Copy `env.example` to `.env`
   - Update secrets and settings

---

## 💡 Pro Tips

1. **Keep Docker logs open** in a separate terminal: `make docker-logs-backend`
2. **Use `make docker-backend`** for best development experience
3. **Run `make docker-clean`** when things don't make sense
4. **Use Make commands** instead of raw Docker commands
5. **Check health endpoint** when debugging: `curl http://localhost:3001/api/health`
6. **Allocate sufficient memory** to Docker (4GB+ recommended)
7. **Enable WSL 2** on Windows for better performance

---

## 🆘 Getting Help

### Check Status
```bash
docker ps                    # See running containers
docker-compose ps            # See compose services
make docker-logs             # View all logs
curl http://localhost:3001/api/health  # Test backend
```

### Common Commands
```bash
make help                    # Show all commands
make docker-restart          # Restart services
make docker-clean            # Clean everything
verify-docker-setup.bat      # Verify setup
```

### Still Having Issues?

1. Check logs: `make docker-logs-backend`
2. Review DOCKER.md troubleshooting section
3. Try clean restart: `make docker-clean && make docker-up`
4. Verify Docker resources (CPU, memory)
5. Check firewall/antivirus settings

---

## 🎉 Success!

You now have a fully functional Docker setup for the Configuration Manager! 

The Go backend runs in Docker (no Go installation needed), and you can develop the frontend locally with fast hot-reload.

**Start developing:**
```bash
make docker-backend
make frontend
```

**Happy coding! 🚀**



