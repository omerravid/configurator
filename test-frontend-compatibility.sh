#!/bin/bash

# Frontend Compatibility Test Script
# Tests that the Go backend has all endpoints the React frontend expects

set -e

BASE_URL="${BASE_URL:-http://localhost:3001}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"

echo "=================================================="
echo "Frontend Compatibility Test for Go Backend"
echo "=================================================="
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
    echo -n "Testing: $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_status" ] || [ "$status_code" = "200" ] || [ "$status_code" = "201" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code)"
        ((pass_count++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $status_code)"
        echo "  Response: $body"
        ((fail_count++))
        return 1
    fi
}

# Step 1: Login
echo "=================================================="
echo "Step 1: Authentication"
echo "=================================================="

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}✗ FAIL: Could not login or get token${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Test Auth Endpoints
echo "=================================================="
echo "Step 2: Auth Endpoints"
echo "=================================================="

test_endpoint "GET /api/auth/me" "GET" "/api/auth/me"
test_endpoint "POST /api/auth/refresh" "POST" "/api/auth/refresh" "{}"

echo ""

# Step 3: Test Configuration Endpoints
echo "=================================================="
echo "Step 3: Configuration Endpoints"
echo "=================================================="

test_endpoint "GET /api/configs" "GET" "/api/configs"
test_endpoint "GET /api/configs/components" "GET" "/api/configs/components"

# Create a test config
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/configs" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"FrontendTestConfig","type":"COMPONENT","data":{"test":true}}')

CONFIG_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -n "$CONFIG_ID" ]; then
    echo -e "${GREEN}✓ Created test config${NC} (ID: $CONFIG_ID)"
    
    test_endpoint "GET /api/configs/:id" "GET" "/api/configs/$CONFIG_ID"
    test_endpoint "GET /api/configs/:id/data" "GET" "/api/configs/$CONFIG_ID/data"
    test_endpoint "GET /api/configs/:id/children" "GET" "/api/configs/$CONFIG_ID/children"
    test_endpoint "PUT /api/configs/:id" "PUT" "/api/configs/$CONFIG_ID" '{"data":{"test":false}}'
    test_endpoint "PUT /api/configs/:id/rename" "PUT" "/api/configs/$CONFIG_ID/rename" '{"name":"RenamedTestConfig"}'
    test_endpoint "POST /api/configs/:id/archive" "POST" "/api/configs/$CONFIG_ID/archive" '{}'
    test_endpoint "POST /api/configs/:id/restore" "POST" "/api/configs/$CONFIG_ID/restore" '{}'
else
    echo -e "${RED}✗ Could not create test config${NC}"
    echo "Response: $CREATE_RESPONSE"
fi

echo ""

# Step 4: Test User Endpoints
echo "=================================================="
echo "Step 4: User Management Endpoints"
echo "=================================================="

test_endpoint "GET /api/users" "GET" "/api/users"

# Get first user ID for testing
USERS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/users" \
    -H "Authorization: Bearer $TOKEN")
FIRST_USER_ID=$(echo "$USERS_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$FIRST_USER_ID" ]; then
    test_endpoint "GET /api/users/:id" "GET" "/api/users/$FIRST_USER_ID"
    test_endpoint "GET /api/users/:id/configurations" "GET" "/api/users/$FIRST_USER_ID/configurations"
fi

echo ""

# Step 5: Test File Endpoints
echo "=================================================="
echo "Step 5: File Endpoints"
echo "=================================================="

# Create a test file
echo "test content" > /tmp/test-frontend-compat.txt

UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/files/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@/tmp/test-frontend-compat.txt")

FILE_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -n "$FILE_ID" ]; then
    echo -e "${GREEN}✓ Uploaded test file${NC} (ID: $FILE_ID)"
    
    test_endpoint "GET /api/files/:id/download" "GET" "/api/files/$FILE_ID/download"
    test_endpoint "DELETE /api/files/:id" "DELETE" "/api/files/$FILE_ID" "" "200"
else
    echo -e "${YELLOW}⚠ Could not upload test file (may be expected if storage not configured)${NC}"
fi

test_endpoint "GET /api/file-management/unreferenced" "GET" "/api/file-management/unreferenced"

rm -f /tmp/test-frontend-compat.txt

echo ""

# Step 6: Test Settings/Backup Endpoints
echo "=================================================="
echo "Step 6: Settings & Backup Endpoints"
echo "=================================================="

test_endpoint "GET /api/settings/storage" "GET" "/api/settings/storage"
test_endpoint "GET /api/settings/data/backups" "GET" "/api/settings/data/backups"
test_endpoint "POST /api/settings/data/backup" "POST" "/api/settings/data/backup" '{"name":"frontend-compat-test"}'

# Get backup list to find the test backup
BACKUPS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/settings/data/backups" \
    -H "Authorization: Bearer $TOKEN")

BACKUP_NAME=$(echo "$BACKUPS_RESPONSE" | grep -o '"frontend-compat-test[^"]*' | head -1 | tr -d '"')

if [ -n "$BACKUP_NAME" ]; then
    test_endpoint "GET /api/settings/data/backup/:name" "GET" "/api/settings/data/backup/$BACKUP_NAME"
    test_endpoint "DELETE /api/settings/data/backup/:name" "DELETE" "/api/settings/data/backup/$BACKUP_NAME"
fi

echo ""

# Summary
echo "=================================================="
echo "Test Summary"
echo "=================================================="
echo -e "${GREEN}Passed: $pass_count${NC}"
echo -e "${RED}Failed: $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Go backend is compatible with frontend.${NC}"
    echo ""
    echo "Next step: Update client/vite.config.js to point to port 3001"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Review the errors above.${NC}"
    exit 1
fi

