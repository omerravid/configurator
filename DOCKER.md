# Docker Setup Guide

This guide explains how to run the Configuration Manager using Docker.

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine + Docker Compose (Linux)
- Make (comes with Git Bash on Windows, pre-installed on Mac/Linux)

## Quick Start

### Option 1: Run Everything with Docker

Start all services (Frontend, Backend, MongoDB):

```bash
make docker-up
```

This will start:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **MongoDB**: localhost:27017

View logs:
```bash
make docker-logs
```

Stop all services:
```bash
make docker-down
```

### Option 2: Docker Backend + Local Frontend (Recommended for Development)

Start only the backend and MongoDB with Docker:

```bash
make docker-backend
```

Then run the frontend locally in another terminal:

```bash
make frontend
```

This approach is faster for frontend development since you get hot-reload without Docker overhead.

## Available Docker Commands

### Basic Operations

```bash
make docker-up          # Start all services
make docker-down        # Stop all services
make docker-restart     # Restart all services
make docker-build       # Rebuild Docker images
```

### Logs

```bash
make docker-logs              # All services
make docker-logs-backend      # Backend only
make docker-logs-frontend     # Frontend only
make docker-logs-mongo        # MongoDB only
```

### Cleanup

```bash
make docker-clean       # Remove containers, networks, volumes
make docker-clean-all   # Remove everything including images
```

### Shell Access

```bash
make docker-shell-backend   # Open shell in backend container
make docker-shell-frontend  # Open shell in frontend container
make docker-mongo-shell     # Open MongoDB shell
```

### Selective Services

```bash
make docker-backend    # Start only backend + MongoDB
```

## Service Details

### Backend (Go Server)

- **Port**: 3001
- **Health Check**: http://localhost:3001/api/health
- **Environment Variables**: See `docker-compose.yml`
- **Data Volume**: `configurator-files-data` (persists uploaded files)

### MongoDB

- **Port**: 27017
- **Database**: `config_manager`
- **Data Volume**: `configurator-mongo-data` (persists database)
- **Health Check**: Built-in with mongosh ping

### Frontend (React + Vite)

- **Development Port**: 5173
- **Production Port**: 80 (with nginx)
- **API Proxy**: Automatically proxies `/api` requests to backend

## Environment Variables

You can customize the configuration by creating a `.env` file:

```env
# Backend
SERVER_PORT=3001
JWT_SECRET=your-secret-key
API_KEY=your-api-key
STORAGE_TYPE=embedded
LOG_LEVEL=info

# MongoDB
MONGODB_URI=mongodb://mongo:27017
MONGO_DB_NAME=config_manager

# Frontend
VITE_API_BASE_URL=http://localhost:3001/api
```

## Persistent Data

Docker volumes are used to persist data:

- **mongo_data**: MongoDB database files
- **files_data**: Uploaded configuration files

These volumes persist even after stopping containers. To completely remove them:

```bash
make docker-clean
```

## Development Workflow

### Frontend Development (Hot Reload)

```bash
# Start backend with Docker
make docker-backend

# Run frontend locally (in another terminal)
make frontend
```

The frontend will hot-reload on code changes.

### Backend Development (Rebuild Required)

```bash
# Make changes to Go code

# Rebuild and restart backend
make docker-build
make docker-restart
```

Or rebuild only the backend:

```bash
docker-compose build backend
docker-compose restart backend
```

## Production Deployment

For production, use the production frontend Dockerfile:

1. Update `docker-compose.yml` to use `Dockerfile` instead of `Dockerfile.dev`
2. Set production environment variables
3. Use a reverse proxy (nginx/Traefik) for SSL termination
4. Use external MongoDB for better scalability

## Troubleshooting

### Port Already in Use

If ports 3001, 5173, or 27017 are already in use:

```bash
# Find process using port
netstat -ano | findstr :3001    # Windows
lsof -i :3001                   # Mac/Linux

# Kill the process or change ports in docker-compose.yml
```

### Backend Container Exits Immediately

Check logs:
```bash
make docker-logs-backend
```

Common issues:
- MongoDB not ready (wait for health check)
- Missing environment variables
- Port conflict

### MongoDB Connection Issues

Ensure MongoDB is healthy:
```bash
docker-compose ps
```

Should show `(healthy)` status for mongo service.

### Cannot Connect to Backend from Frontend

- Check if backend is running: `docker-compose ps`
- Check backend logs: `make docker-logs-backend`
- Verify `VITE_API_BASE_URL` is set correctly
- Check network connectivity: `docker-compose exec frontend ping backend`

### Clean Start

To start fresh:

```bash
# Stop everything and remove volumes
make docker-clean-all

# Rebuild from scratch
make docker-build

# Start services
make docker-up
```

## Architecture

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
│   Port: 5173    │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│   Backend       │
│   (Go/Gin)      │
│   Port: 3001    │
└────────┬────────┘
         │ MongoDB Protocol
         ▼
┌─────────────────┐
│   MongoDB       │
│   Port: 27017   │
└─────────────────┘
```

## Next Steps

- Configure JWT secrets for production
- Set up SSL/TLS certificates
- Configure S3 storage (optional)
- Set up monitoring and logging
- Configure backup strategy

## Additional Resources

- [Main README](./README.md)
- [Go Server Documentation](./server-go/README.md)
- [Frontend Documentation](./client/README.md)
- [Docker Compose Documentation](https://docs.docker.com/compose/)



