.PHONY: help frontend backend go server dev dev-frontend dev-backend dev-go install install-frontend install-go clean test test-frontend test-go build build-frontend build-go docker-up docker-down docker-build docker-logs docker-restart docker-clean

# Default target
help:
	@echo "Configuration Manager - Makefile"
	@echo ""
	@echo "=== Local Development (without Docker) ==="
	@echo "  make dev              - Run both frontend and Go backend (in parallel)"
	@echo "  make frontend         - Run frontend dev server (port 5173)"
	@echo "  make backend          - Run Go backend server (port 3001)"
	@echo "  make go               - Alias for 'make backend'"
	@echo "  make server           - Alias for 'make backend'"
	@echo ""
	@echo "=== Docker Commands ==="
	@echo "  make docker-up        - Start all services with Docker Compose"
	@echo "  make docker-down      - Stop all Docker services"
	@echo "  make docker-build     - Build Docker images"
	@echo "  make docker-restart   - Restart all Docker services"
	@echo "  make docker-logs      - View Docker logs (tail -f)"
	@echo "  make docker-backend   - Start only backend + MongoDB with Docker"
	@echo "  make docker-clean     - Stop and remove all containers, networks, volumes"
	@echo ""
	@echo "=== Installation ==="
	@echo "  make install          - Install all dependencies (frontend + go)"
	@echo "  make install-frontend - Install frontend dependencies"
	@echo "  make install-go       - Download Go dependencies"
	@echo ""
	@echo "=== Build ==="
	@echo "  make build            - Build both frontend and backend"
	@echo "  make build-frontend   - Build frontend for production"
	@echo "  make build-go         - Build Go backend binary"
	@echo ""
	@echo "=== Testing ==="
	@echo "  make test             - Run all tests (frontend + backend)"
	@echo "  make test-frontend    - Run frontend tests"
	@echo "  make test-go          - Run Go backend tests"
	@echo ""
	@echo "=== Cleanup ==="
	@echo "  make clean            - Clean build artifacts and caches"

# Development - Run both frontend and backend
dev:
	@echo "Starting Configuration Manager (Frontend + Go Backend)..."
	@echo "Frontend will be available at: http://localhost:5173"
	@echo "Backend will be available at: http://localhost:3001"
	@echo ""
	@echo "Press Ctrl+C to stop both servers"
	@echo ""
	@$(MAKE) -j2 dev-frontend dev-backend

# Development targets (for parallel execution)
dev-frontend:
	@echo "[Frontend] Starting Vite dev server..."
	@cd client && npm run dev

dev-backend:
	@echo "[Backend] Starting Go server..."
	@cd server-go && go run cmd/server/main.go

# Individual server targets
frontend:
	@echo "Starting frontend dev server on http://localhost:5173..."
	@cd client && npm run dev

backend:
	@echo "Starting Go backend server on http://localhost:3001..."
	@cd server-go && go run cmd/server/main.go

# Aliases
go: backend
server: backend

# Installation
install: install-frontend install-go
	@echo "All dependencies installed successfully!"

install-frontend:
	@echo "Installing frontend dependencies..."
	@cd client && npm install
	@echo "Frontend dependencies installed!"

install-go:
	@echo "Downloading Go dependencies..."
	@cd server-go && go mod download
	@echo "Go dependencies downloaded!"

# Build
build: build-frontend build-go
	@echo "Build complete!"

build-frontend:
	@echo "Building frontend for production..."
	@cd client && npm run build
	@echo "Frontend build complete! Output in client/dist/"

build-go:
	@echo "Building Go backend binary..."
	@cd server-go && go build -o bin/server cmd/server/main.go
	@echo "Go backend build complete! Binary at server-go/bin/server"

# Testing
test: test-frontend test-go
	@echo "All tests complete!"

test-frontend:
	@echo "Running frontend tests..."
	@cd client && npm test

test-go:
	@echo "Running Go backend tests..."
	@cd server-go && $(MAKE) test

# Additional Go test targets (proxied from server-go/Makefile)
test-go-coverage:
	@echo "Running Go tests with coverage..."
	@cd server-go && $(MAKE) test-coverage

test-go-verbose:
	@echo "Running Go tests with verbose output..."
	@cd server-go && $(MAKE) test-verbose

# Cleanup
clean:
	@echo "Cleaning build artifacts and caches..."
	@rm -rf client/dist
	@rm -rf client/node_modules/.vite
	@rm -rf server-go/bin
	@cd server-go && $(MAKE) clean
	@echo "Clean complete!"

# Lint and format
lint:
	@echo "Running linters..."
	@cd client && npm run lint
	@echo "Lint complete!"

lint-fix:
	@echo "Running linters with auto-fix..."
	@cd client && npm run lint:fix
	@echo "Lint fix complete!"

format:
	@echo "Formatting code..."
	@cd client && npm run format
	@echo "Format complete!"

format-check:
	@echo "Checking code format..."
	@cd client && npm run format:check
	@echo "Format check complete!"

# ============================================
# Docker Commands
# ============================================

# Start all services with Docker Compose
docker-up:
	@echo "Starting all services with Docker Compose..."
	@echo "Frontend: http://localhost:5173"
	@echo "Backend:  http://localhost:3001"
	@echo "MongoDB:  localhost:27017"
	@echo ""
	docker-compose up -d
	@echo ""
	@echo "Services started! Use 'make docker-logs' to view logs."

# Start only backend and MongoDB (frontend runs locally)
docker-backend:
	@echo "Starting Backend and MongoDB with Docker..."
	@echo "Backend: http://localhost:3001"
	@echo "MongoDB: localhost:27017"
	@echo ""
	docker-compose up -d mongo backend
	@echo ""
	@echo "Backend services started! Run 'make frontend' separately for local frontend dev."

# Stop all Docker services
docker-down:
	@echo "Stopping all Docker services..."
	docker-compose down
	@echo "Services stopped."

# Build Docker images
docker-build:
	@echo "Building Docker images..."
	docker-compose build
	@echo "Build complete!"

# Rebuild and restart all services
docker-restart:
	@echo "Restarting all Docker services..."
	docker-compose restart
	@echo "Services restarted!"

# View logs from all services
docker-logs:
	@echo "Showing Docker logs (Ctrl+C to exit)..."
	docker-compose logs -f

# View logs from specific service
docker-logs-backend:
	@echo "Showing backend logs (Ctrl+C to exit)..."
	docker-compose logs -f backend

docker-logs-frontend:
	@echo "Showing frontend logs (Ctrl+C to exit)..."
	docker-compose logs -f frontend

docker-logs-mongo:
	@echo "Showing MongoDB logs (Ctrl+C to exit)..."
	docker-compose logs -f mongo

# Stop and remove all containers, networks, and volumes
docker-clean:
	@echo "Stopping and removing all Docker resources..."
	docker-compose down -v --remove-orphans
	@echo "Docker resources cleaned!"

# Full clean including images
docker-clean-all:
	@echo "Stopping and removing all Docker resources including images..."
	docker-compose down -v --rmi all --remove-orphans
	@echo "All Docker resources cleaned!"

# Execute shell in backend container
docker-shell-backend:
	@echo "Opening shell in backend container..."
	docker-compose exec backend sh

# Execute shell in frontend container
docker-shell-frontend:
	@echo "Opening shell in frontend container..."
	docker-compose exec frontend sh

# Execute MongoDB shell
docker-mongo-shell:
	@echo "Opening MongoDB shell..."
	docker-compose exec mongo mongosh config_manager

