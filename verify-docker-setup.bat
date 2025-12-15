@echo off
REM Docker Setup Verification Script
REM Tests if Docker setup is working correctly

echo ========================================
echo Docker Setup Verification
echo ========================================
echo.

REM Check Docker installation
echo [1/7] Checking Docker installation...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Docker is not installed
    echo Install from: https://www.docker.com/products/docker-desktop
    goto :end_fail
)
echo [PASS] Docker is installed
docker --version
echo.

REM Check Docker is running
echo [2/7] Checking if Docker is running...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Docker is not running
    echo Please start Docker Desktop
    goto :end_fail
)
echo [PASS] Docker is running
echo.

REM Check docker-compose
echo [3/7] Checking docker-compose...
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] docker-compose not found
    goto :end_fail
)
echo [PASS] docker-compose is available
docker-compose --version
echo.

REM Check if docker-compose.yml exists
echo [4/7] Checking docker-compose.yml...
if not exist "docker-compose.yml" (
    echo [FAIL] docker-compose.yml not found
    echo Make sure you're in the project root directory
    goto :end_fail
)
echo [PASS] docker-compose.yml found
echo.

REM Check if Makefile exists
echo [5/7] Checking Makefile...
if not exist "Makefile" (
    echo [FAIL] Makefile not found
    goto :end_fail
)
echo [PASS] Makefile found
echo.

REM Check server-go directory
echo [6/7] Checking server-go directory...
if not exist "server-go\build\Dockerfile" (
    echo [FAIL] server-go/build/Dockerfile not found
    goto :end_fail
)
echo [PASS] Backend Dockerfile found
echo.

REM Check client directory
echo [7/7] Checking client directory...
if not exist "client\Dockerfile.dev" (
    echo [FAIL] client/Dockerfile.dev not found
    goto :end_fail
)
echo [PASS] Frontend Dockerfile found
echo.

echo ========================================
echo All checks passed! ✓
echo ========================================
echo.
echo Your Docker setup is ready to use!
echo.
echo To start the application:
echo   Option 1: make docker-backend  (then make frontend in another terminal)
echo   Option 2: make docker-up       (starts everything)
echo   Option 3: docker-start.bat     (interactive guide)
echo.
echo For more help:
echo   make help
echo   See QUICKSTART.md
echo   See DOCKER.md
echo.
goto :end_success

:end_fail
echo.
echo ========================================
echo Verification failed ✗
echo ========================================
echo.
echo Please fix the issues above and try again.
echo.
pause
exit /b 1

:end_success
pause
exit /b 0



