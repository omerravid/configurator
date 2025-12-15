#!/bin/bash
# Docker Setup Verification Script
# Tests if Docker setup is working correctly

set -e

echo "========================================"
echo "Docker Setup Verification"
echo "========================================"
echo ""

FAILED=0

# Function to report pass/fail
check_pass() {
    echo "[PASS] $1"
}

check_fail() {
    echo "[FAIL] $1"
    FAILED=1
}

# Check Docker installation
echo "[1/7] Checking Docker installation..."
if command -v docker &> /dev/null; then
    check_pass "Docker is installed"
    docker --version
else
    check_fail "Docker is not installed"
    echo "Install from: https://www.docker.com/get-started"
fi
echo ""

# Check Docker is running
echo "[2/7] Checking if Docker is running..."
if docker ps &> /dev/null; then
    check_pass "Docker is running"
else
    check_fail "Docker is not running"
    echo "Please start Docker and try again"
fi
echo ""

# Check docker-compose
echo "[3/7] Checking docker-compose..."
if command -v docker-compose &> /dev/null; then
    check_pass "docker-compose is available"
    docker-compose --version
else
    check_fail "docker-compose not found"
fi
echo ""

# Check if docker-compose.yml exists
echo "[4/7] Checking docker-compose.yml..."
if [ -f "docker-compose.yml" ]; then
    check_pass "docker-compose.yml found"
else
    check_fail "docker-compose.yml not found"
    echo "Make sure you're in the project root directory"
fi
echo ""

# Check if Makefile exists
echo "[5/7] Checking Makefile..."
if [ -f "Makefile" ]; then
    check_pass "Makefile found"
else
    check_fail "Makefile not found"
fi
echo ""

# Check server-go directory
echo "[6/7] Checking server-go directory..."
if [ -f "server-go/build/Dockerfile" ]; then
    check_pass "Backend Dockerfile found"
else
    check_fail "server-go/build/Dockerfile not found"
fi
echo ""

# Check client directory
echo "[7/7] Checking client directory..."
if [ -f "client/Dockerfile.dev" ]; then
    check_pass "Frontend Dockerfile found"
else
    check_fail "client/Dockerfile.dev not found"
fi
echo ""

# Final result
if [ $FAILED -eq 0 ]; then
    echo "========================================"
    echo "All checks passed! ✓"
    echo "========================================"
    echo ""
    echo "Your Docker setup is ready to use!"
    echo ""
    echo "To start the application:"
    echo "  Option 1: make docker-backend  (then make frontend in another terminal)"
    echo "  Option 2: make docker-up       (starts everything)"
    echo "  Option 3: ./docker-start.sh    (interactive guide)"
    echo ""
    echo "For more help:"
    echo "  make help"
    echo "  See QUICKSTART.md"
    echo "  See DOCKER.md"
    echo ""
    exit 0
else
    echo "========================================"
    echo "Verification failed ✗"
    echo "========================================"
    echo ""
    echo "Please fix the issues above and try again."
    echo ""
    exit 1
fi



