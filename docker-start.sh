#!/bin/bash
# Quick Start Script for Configuration Manager (Docker)
# This script checks prerequisites and starts the application with Docker

set -e

echo "========================================"
echo "Configuration Manager - Docker Quick Start"
echo "========================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed"
    echo "Please install Docker from: https://www.docker.com/get-started"
    exit 1
fi

echo "[OK] Docker is installed"
docker --version

# Check if Docker is running
if ! docker ps &> /dev/null; then
    echo "[ERROR] Docker is not running"
    echo "Please start Docker and try again"
    exit 1
fi

echo "[OK] Docker is running"
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "[ERROR] docker-compose is not installed"
    exit 1
fi

echo "[OK] docker-compose is available"
docker-compose --version
echo ""

# Prompt user for startup option
echo "Choose startup option:"
echo "  1 - Start everything with Docker (Frontend + Backend + MongoDB)"
echo "  2 - Start only Backend + MongoDB (Run frontend locally for faster dev)"
echo ""
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo "Starting all services with Docker..."
    echo ""
    echo "Services will be available at:"
    echo "  Frontend:  http://localhost:5173"
    echo "  Backend:   http://localhost:3001"
    echo "  MongoDB:   localhost:27017"
    echo ""
    
    docker-compose up -d
    
    echo ""
    echo "[SUCCESS] All services started!"
    echo ""
    echo "View logs with: docker-compose logs -f"
    echo "Stop services with: docker-compose down"
    echo "Or use: make docker-logs, make docker-down"
    
elif [ "$choice" = "2" ]; then
    echo ""
    echo "Starting Backend and MongoDB with Docker..."
    echo ""
    echo "Services will be available at:"
    echo "  Backend:   http://localhost:3001"
    echo "  MongoDB:   localhost:27017"
    echo ""
    
    docker-compose up -d mongo backend
    
    echo ""
    echo "[SUCCESS] Backend services started!"
    echo ""
    echo "To start frontend locally, open another terminal and run:"
    echo "  cd client"
    echo "  npm install   (first time only)"
    echo "  npm run dev"
    echo ""
    echo "Or simply: make frontend"
    
else
    echo "Invalid choice. Please run the script again."
    exit 1
fi

echo ""
echo "========================================"


