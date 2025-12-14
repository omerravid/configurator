@echo off
REM Quick Start Script for Configuration Manager (Docker)
REM This script checks prerequisites and starts the application with Docker

echo ========================================
echo Configuration Manager - Docker Quick Start
echo ========================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [OK] Docker is installed
docker --version

REM Check if Docker is running
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)

echo [OK] Docker is running
echo.

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] docker-compose is not installed or not in PATH
    pause
    exit /b 1
)

echo [OK] docker-compose is available
docker-compose --version
echo.

REM Prompt user for startup option
echo Choose startup option:
echo   1 - Start everything with Docker (Frontend + Backend + MongoDB)
echo   2 - Start only Backend + MongoDB (Run frontend locally for faster dev)
echo.
set /p choice="Enter choice (1 or 2): "

if "%choice%"=="1" (
    echo.
    echo Starting all services with Docker...
    echo.
    echo Services will be available at:
    echo   Frontend:  http://localhost:5173
    echo   Backend:   http://localhost:3001
    echo   MongoDB:   localhost:27017
    echo.
    docker-compose up -d
    
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to start services
        pause
        exit /b 1
    )
    
    echo.
    echo [SUCCESS] All services started!
    echo.
    echo View logs with: docker-compose logs -f
    echo Stop services with: docker-compose down
    echo Or use: make docker-logs, make docker-down
    
) else if "%choice%"=="2" (
    echo.
    echo Starting Backend and MongoDB with Docker...
    echo.
    echo Services will be available at:
    echo   Backend:   http://localhost:3001
    echo   MongoDB:   localhost:27017
    echo.
    docker-compose up -d mongo backend
    
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to start services
        pause
        exit /b 1
    )
    
    echo.
    echo [SUCCESS] Backend services started!
    echo.
    echo To start frontend locally, open another terminal and run:
    echo   cd client
    echo   npm install   (first time only)
    echo   npm run dev
    echo.
    echo Or simply: make frontend
    
) else (
    echo Invalid choice. Please run the script again.
    pause
    exit /b 1
)

echo.
echo ========================================
pause


