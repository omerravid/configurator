# Complete Testing Guide - Go Configuration Manager

**Purpose**: Comprehensive testing checklist to verify all features work correctly before production deployment.

**Estimated Time**: 2-3 hours for complete testing

---

## Prerequisites

### 1. Start the Service

```bash
cd server-go
docker compose -f deployments/docker-compose.yml up --build
```

Wait for:
```
✓ MongoDB started
✓ Go API started on port 3004
✓ Health check passing
```

### 2. Set Up Test Environment

**Using Postman/Insomnia:**
- Import the requests below
- Create environment variables:
  - `{{baseUrl}}` = `http://localhost:3004`
  - `{{adminToken}}` = (will be set after registration)
  - `{{userToken}}` = (will be set after registration)
  - `{{configId}}` = (will be set after creating config)

**Using curl:**
- Set environment variables in your shell:
```bash
export BASE_URL="http://localhost:3004"
export ADMIN_TOKEN=""  # Will be set after registration
export USER_TOKEN=""   # Will be set after registration
```

---

## Test Suite

### ✅ Section 1: Health & Infrastructure (2 tests)

#### 1.1 Health Check
```bash
curl $BASE_URL/api/health
```
**Expected**: `{"status":"OK"}`

#### 1.2 Invalid Route (404)
```bash
curl $BASE_URL/api/nonexistent
```
**Expected**: `404 Not Found`

---

### ✅ Section 2: Authentication (8 tests)

#### 2.1 Register Admin User
```bash
curl -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123",
    "role": "ADMIN"
  }'
```
**Expected**:
```json
{
  "message": "User created successfully",
  "token": "eyJhbGc...",
  "user": {
    "id": "...",
    "username": "admin",
    "role": "ADMIN"
  }
}
```
**Action**: Save the `token` as `$ADMIN_TOKEN`

#### 2.2 Register Regular User
```bash
curl -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123",
    "role": "USER"
  }'
```
**Expected**: Similar response with `"role": "USER"`  
**Action**: Save the `token` as `$USER_TOKEN`

#### 2.3 Login as Admin
```bash
curl -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```
**Expected**: Token and user info returned

#### 2.4 Login with Wrong Password
```bash
curl -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "wrongpassword"
  }'
```
**Expected**: `401 Unauthorized` - "Invalid username or password"

#### 2.5 Get Current User (Admin)
```bash
curl $BASE_URL/api/auth/me \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Current user details

#### 2.6 Get Current User (No Token)
```bash
curl $BASE_URL/api/auth/me
```
**Expected**: `401 Unauthorized` - "Authentication required"

#### 2.7 Refresh Token
```bash
curl -X POST $BASE_URL/api/auth/refresh \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: New token returned

#### 2.8 API Key Authentication
```bash
curl $BASE_URL/api/auth/me \
  -H "X-API-Key: your-api-key"
```
**Expected**: Virtual admin user returned (if API_KEY env set)

---

### ✅ Section 3: User Management (7 tests)

#### 3.1 List All Users (Admin)
```bash
curl $BASE_URL/api/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Array of users (admin + testuser)

#### 3.2 List All Users (Non-Admin) - Should Fail
```bash
curl $BASE_URL/api/users \
  -H "Authorization: Bearer $USER_TOKEN"
```
**Expected**: `403 Forbidden` - "Admin access required"

#### 3.3 Get User by ID
```bash
# Get user ID from list, then:
curl $BASE_URL/api/users/{691b17d44675e90aa8f250a4} \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: User details

#### 3.4 Update User Role
```bash
curl -X PUT $BASE_URL/api/users/{userId}/role \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "ADMIN"}'
```
**Expected**: `"message": "User role updated successfully"`

#### 3.5 Delete User (Not Self)
```bash
curl -X DELETE $BASE_URL/api/users/691b17d44675e90aa8f250a4 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: `"message": "User deleted successfully"`

#### 3.6 Delete Self - Should Fail
```bash
# Try to delete your own admin account
curl -X DELETE $BASE_URL/api/users/{adminUserId} \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: `400 Bad Request` - "Cannot delete your own account"

#### 3.7 Get User's Configurations
```bash
curl $BASE_URL/api/users/690b3cce0cf869cf9bed3848/configurations \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Array of configurations owned by user

---

### ✅ Section 4: Configurations - Basic CRUD (10 tests)

#### 4.1 Create PRODUCT Config (Admin)
```bash
curl -X POST $BASE_URL/api/configs \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BaseProduct",
    "type": "PRODUCT",
    "data": {
      "system": {
        "name": "Base System",
        "version": "1.0.0"
      },
      "settings": {
        "theme": "light",
        "language": "en"
      }
    }
  }'
```
**Expected**: Config created with status `COMMITTED`  
**Action**: Save `id` as `$PRODUCT_ID`

#### 4.2 Create PRODUCT Config (Non-Admin) - Should Fail
```bash
curl -X POST $BASE_URL/api/configs \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "UnauthorizedProduct",
    "type": "PRODUCT",
    "data": {}
  }'
```
**Expected**: `403 Forbidden` - "Only admins can create Product/Instance/Component configurations"

#### 4.3 Create USER Config (Non-Admin)
```bash
curl -X POST $BASE_URL/api/configs \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MyUserConfig",
    "type": "USER",
    "parent_id": "$PRODUCT_ID",
    "data": {
      "settings": {
        "theme": "dark"
      }
    }
  }'
```
**Expected**: Config created with status `DRAFT`  
**Action**: Save `id` as `$USER_CONFIG_ID`

#### 4.4 List All Configs
```bash
curl $BASE_URL/api/configs \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Array with both configs

#### 4.5 List Configs by Type
```bash
curl "$BASE_URL/api/configs?type=PRODUCT" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Only PRODUCT configs

#### 4.6 Get Config by ID
```bash
curl $BASE_URL/api/configs/$PRODUCT_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Resolved config with merged data

#### 4.7 Get Config with Provenance
```bash
curl "$BASE_URL/api/configs/$USER_CONFIG_ID?provenance=true" \
  -H "Authorization: Bearer $USER_TOKEN"
```
**Expected**: Data wrapped with `{value, source}` objects

#### 4.8 Update Config (Owner)
```bash
curl -X PUT $BASE_URL/api/configs/$USER_CONFIG_ID \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "settings": {
        "theme": "dark",
        "notifications": true
      }
    }
  }'
```
**Expected**: Config updated successfully

#### 4.9 Update Someone Else's Config - Should Fail
```bash
# Create another user's config first, then try to update it
curl -X PUT $BASE_URL/api/configs/{otherUserConfigId} \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": {"hack": "attempt"}}'
```
**Expected**: `403 Forbidden` - "You can only modify your own configurations"

#### 4.10 Rename Config (Admin Only)
```bash
curl -X PUT $BASE_URL/api/configs/$PRODUCT_ID/rename \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "RenamedProduct"}'
```
**Expected**: Config renamed successfully

---

### ✅ Section 5: Configurations - Advanced Features (8 tests)

#### 5.1 Get Resolved Data (Minimal Mode)
```bash
curl "$BASE_URL/api/configs/$USER_CONFIG_ID/data?minimal=true" \
  -H "Authorization: Bearer $USER_TOKEN"
```
**Expected**: Pure data without provenance wrappers

#### 5.2 Get Config Children
```bash
curl $BASE_URL/api/configs/$PRODUCT_ID/children \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Array of child configs

#### 5.3 Get Config by Name
```bash
curl "$BASE_URL/api/configs/by-name/BaseProduct/data?minimal=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Config data

#### 5.4 Get Value at Path (Dot Notation)
```bash
curl "$BASE_URL/api/configs/by-name/BaseProduct/data?path=system.version&minimal=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: `"1.0.0"`

#### 5.5 Commit DRAFT Config
```bash
curl -X POST $BASE_URL/api/configs/$USER_CONFIG_ID/commit \
  -H "Authorization: Bearer $USER_TOKEN"
```
**Expected**: Config status changed to `COMMITTED`

#### 5.6 Update COMMITTED Config - Should Fail
```bash
curl -X PUT $BASE_URL/api/configs/$USER_CONFIG_ID \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": {"attempt": "to modify"}}'
```
**Expected**: `403 Forbidden` - "Cannot modify committed configurations"

#### 5.7 Archive Config (Admin)
```bash
curl -X POST $BASE_URL/api/configs/$PRODUCT_ID/archive \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Config archived successfully

#### 5.8 Restore Config (Admin)
```bash
curl -X POST $BASE_URL/api/configs/$PRODUCT_ID/restore \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Config restored successfully

---

### ✅ Section 6: Component Expansion (5 tests)

#### 6.1 Create COMPONENT Config
```bash
curl -X POST $BASE_URL/api/configs \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BatteryComponent",
    "type": "COMPONENT",
    "data": {
      "capacity": 5000,
      "voltage": 12.6,
      "chemistry": "Li-ion"
    }
  }'
```
**Expected**: Component created  
**Action**: Save `id` as `$COMPONENT_ID`

#### 6.2 Create VERSION of Component
```bash
curl -X POST $BASE_URL/api/configs \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BatteryV2",
    "type": "VERSION",
    "parent_id": "$COMPONENT_ID",
    "data": {
      "capacity": 6000,
      "charging": {
        "maxWatts": 100
      }
    }
  }'
```
**Expected**: Version created  
**Action**: Save `id` as `$VERSION_ID`

#### 6.3 Create PRODUCT with Component Reference
```bash
curl -X POST $BASE_URL/api/configs \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ProductWithComponents",
    "type": "PRODUCT",
    "data": {
      "name": "EV Model X",
      "Battery": {
        "componentId": "$COMPONENT_ID",
        "versionId": "$VERSION_ID",
        "componentName": "Battery",
        "versionName": "v2.0"
      }
    }
  }'
```
**Expected**: Product created  
**Action**: Save `id` as `$PRODUCT_WITH_COMPONENTS_ID`

#### 6.4 Get Resolved Product (Component Expanded)
```bash
curl $BASE_URL/api/configs/$PRODUCT_WITH_COMPONENTS_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Battery object contains expanded properties:
- `capacity`: 6000 (from VERSION)
- `voltage`: 12.6 (inherited from COMPONENT)
- `chemistry`: "Li-ion" (inherited from COMPONENT)
- `charging.maxWatts`: 100 (from VERSION)

#### 6.5 Verify Component Metadata Preserved
**Check**: Response should still have:
- `componentId`
- `versionId`
- `componentName`
- `versionName`

---

### ✅ Section 7: Rules (10 tests)

#### 7.1 Create Numeric Rule
```bash
curl -X POST $BASE_URL/api/rules \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "configuration_id": "$PRODUCT_ID",
    "property_path": "system.maxUsers",
    "validator_type": "numeric",
    "config": {
      "operator": ">=",
      "value": 1
    },
    "error_message": "Max users must be at least 1"
  }'
```
**Expected**: Rule created  
**Action**: Save `id` as `$RULE_ID`

#### 7.2 Create Pattern Rule
```bash
curl -X POST $BASE_URL/api/rules \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "configuration_id": "$PRODUCT_ID",
    "property_path": "system.name",
    "validator_type": "pattern",
    "config": {
      "pattern": "^[A-Za-z ]+$"
    },
    "error_message": "Name must contain only letters and spaces"
  }'
```
**Expected**: Rule created

#### 7.3 Create Collection Rule
```bash
curl -X POST $BASE_URL/api/rules \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "configuration_id": "$PRODUCT_ID",
    "property_path": "settings.theme",
    "validator_type": "collection",
    "config": {
      "allowed_values": ["light", "dark", "auto"]
    },
    "error_message": "Theme must be light, dark, or auto"
  }'
```
**Expected**: Rule created

#### 7.4 List Rules for Configuration
```bash
curl "$BASE_URL/api/rules?configurationId=$PRODUCT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Array of 3 rules

#### 7.5 Get Rule by ID
```bash
curl $BASE_URL/api/rules/$RULE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Rule details

#### 7.6 Update Rule
```bash
curl -X PUT $BASE_URL/api/rules/$RULE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "operator": ">=",
      "value": 5
    }
  }'
```
**Expected**: Rule updated

#### 7.7 Validate Value (Pass)
```bash
curl -X POST $BASE_URL/api/rules/validate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": "$RULE_ID",
    "value": 10
  }'
```
**Expected**: `{"valid": true}`

#### 7.8 Validate Value (Fail)
```bash
curl -X POST $BASE_URL/api/rules/validate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": "$RULE_ID",
    "value": 3
  }'
```
**Expected**: `{"valid": false, "error": "Max users must be at least 5"}`

#### 7.9 Get Rules by Path (with Inheritance)
```bash
curl "$BASE_URL/api/rules/configuration/$USER_CONFIG_ID/path/system.maxUsers?includeInherited=true" \
  -H "Authorization: Bearer $USER_TOKEN"
```
**Expected**: Rules from parent config included

#### 7.10 Delete Rule
```bash
curl -X DELETE $BASE_URL/api/rules/$RULE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Rule deleted successfully

---

### ✅ Section 8: File Management (12 tests)

#### 8.1 Upload File to Config
```bash
# Create a test file first
echo "Test file content" > test.txt

curl -X POST $BASE_URL/api/file-management/upload \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@test.txt" \
  -F "configId=$PRODUCT_ID" \
  -F "propertyPath=documents.readme"
```
**Expected**: File uploaded, metadata returned  
**Action**: Save `storageKey` from response

#### 8.2 Verify File in Config
```bash
curl $BASE_URL/api/configs/$PRODUCT_ID/data?minimal=true \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: `documents.readme` contains file object with `_type`, `_metadata`, `_link`

#### 8.3 Download File (Embedded Storage)
```bash
curl $BASE_URL/api/files/{storageKey} \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: File content returned

#### 8.4 Get File Info
```bash
curl $BASE_URL/api/files/4cd743de4838ef6507d8ca93155ea2bc.txt/info \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: File metadata + download URL

#### 8.5 Replace File
```bash
echo "Updated content" > test-updated.txt

curl -X POST $BASE_URL/api/file-management/replace \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@test-updated.txt" \
  -F "configId=$PRODUCT_ID" \
  -F "propertyPath=documents.readme"
```
**Expected**: File replaced, new storageKey returned

#### 8.6 Upload Image File
```bash
# Create or use an actual image
curl -X POST $BASE_URL/api/file-management/upload \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@test-image.png" \
  -F "configId=$PRODUCT_ID" \
  -F "propertyPath=assets.logo"
```
**Expected**: Image uploaded with correct MIME type

#### 8.7 List Unreferenced Files
```bash
curl $BASE_URL/api/file-management/unreferenced \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: List of files not referenced in any config

#### 8.8 Delete File by Storage Key
```bash
curl -X DELETE $BASE_URL/api/file-management/{storageKey} \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: File deleted successfully

#### 8.9 Delete Unreferenced Files (Bulk)
```bash
curl -X DELETE $BASE_URL/api/file-management/unreferenced \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Count of deleted files

#### 8.10 URL Regeneration Test
```bash
# Change SERVER_BASE_URL env and restart
# Then fetch config with file
curl $BASE_URL/api/configs/$PRODUCT_ID/data \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: File `_link` URLs use new SERVER_BASE_URL

#### 8.11 File in Nested Path
```bash
curl -X POST $BASE_URL/api/file-management/upload \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@test.pdf" \
  -F "configId=$PRODUCT_ID" \
  -F "propertyPath=documents.manuals.installation"
```
**Expected**: File stored at nested path

#### 8.12 Multiple Files in Config
```bash
# Upload several files to different paths
# Then verify all appear in resolved config
curl $BASE_URL/api/configs/$PRODUCT_ID/data \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: All file objects present with correct URLs

---

### ✅ Section 9: Folder Import (6 tests)

#### 9.1 Prepare Test Folder Structure
```bash
mkdir -p test-folder/subfolder
echo '{"key": "value"}' > test-folder/config.json
echo '{"nested": true}' > test-folder/subfolder/data.json
echo "Binary content" > test-folder/file.txt
echo "Image data" > test-folder/image.png
```

#### 9.2 Import Folder (No Attachment)
```bash
curl -X POST $BASE_URL/api/folder-import \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "files=@test-folder/config.json" \
  -F "files=@test-folder/subfolder/data.json" \
  -F "files=@test-folder/file.txt" \
  -F "files=@test-folder/image.png" \
  -F "relativePaths=test-folder/config.json" \
  -F "relativePaths=test-folder/subfolder/data.json" \
  -F "relativePaths=test-folder/file.txt" \
  -F "relativePaths=test-folder/image.png" \
  -F "folderName=test-folder"
```
**Expected**:
```json
{
  "success": true,
  "data": {
    "config": {"key": "value"},
    "subfolder": {
      "data": {"nested": true}
    },
    "file": {
      "_type": "file",
      "_metadata": {...},
      "_link": "..."
    },
    "image": {
      "_type": "file",
      "_metadata": {...},
      "_link": "..."
    }
  },
  "stats": {
    "totalFiles": 4,
    "jsonFiles": 2,
    "binaryFiles": 2
  }
}
```

#### 9.3 Import and Attach to Config
```bash
curl -X POST $BASE_URL/api/folder-import \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "files=@test-folder/config.json" \
  -F "files=@test-folder/file.txt" \
  -F "configId=$PRODUCT_ID" \
  -F "propertyPath=importedData"
```
**Expected**: Files imported and attached to config at `importedData` path

#### 9.4 Verify Imported Structure in Config
```bash
curl "$BASE_URL/api/configs/$PRODUCT_ID/data?path=importedData&minimal=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Imported folder structure present

#### 9.5 Import with Name Collisions
```bash
# Upload files with same names to same folder
curl -X POST $BASE_URL/api/folder-import \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "files=@file1.txt" \
  -F "files=@file1.txt" \
  -F "relativePaths=folder/file.txt" \
  -F "relativePaths=folder/file.txt"
```
**Expected**: Second file renamed to `file_1`

#### 9.6 Import Large Folder (100+ files)
```bash
# Create 100+ test files
for i in {1..150}; do
  echo "File $i" > "test-files/file$i.txt"
done

# Import all (test file limit)
# ... construct curl with all files ...
```
**Expected**: Success or error about file limit

---

### ✅ Section 10: Array Path Traversal (5 tests)

#### 10.1 Create Config with Array Data
```bash
curl -X POST $BASE_URL/api/configs \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ArrayTestConfig",
    "type": "PRODUCT",
    "data": {
      "items": [
        {"name": "First", "value": 10},
        {"name": "Second", "value": 20},
        {"name": "Third", "value": 30}
      ],
      "matrix": [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]
      ]
    }
  }'
```
**Expected**: Config created  
**Action**: Save `id` as `$ARRAY_CONFIG_ID`

#### 10.2 Access Array Element
```bash
curl "$BASE_URL/api/configs/by-name/ArrayTestConfig/data?path=items%5B0%5D&minimal=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: `{"name": "First", "value": 10}`

#### 10.3 Access Nested Property in Array
```bash
curl "$BASE_URL/api/configs/by-name/ArrayTestConfig/data?path=items\[1\].name&minimal=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: `"Second"`

#### 10.4 Access Nested Array Element
```bash
curl "$BASE_URL/api/configs/by-name/ArrayTestConfig/data?path=matrix\[1\]\[2\]&minimal=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: `6`

#### 10.5 Invalid Array Index
```bash
curl "$BASE_URL/api/configs/by-name/ArrayTestConfig/data?path=items\[99\]&minimal=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: `404 Not Found` - "array index 99 out of bounds"

---

### ✅ Section 11: Backup & Restore (6 tests)

#### 11.1 Create Backup
```bash
curl -X POST $BASE_URL/api/settings/data/backup \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Backup created with filename  
**Action**: Save `filename` as `$BACKUP_NAME`

#### 11.2 List Backups
```bash
curl $BASE_URL/api/settings/data/backups \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Array of backups with sizes and dates

#### 11.3 Download Backup
```bash
curl $BASE_URL/api/settings/data/backup/$BACKUP_NAME \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  --output backup.tar.gz
```
**Expected**: Backup file downloaded

#### 11.4 Restore from Backup
```bash
curl -X POST $BASE_URL/api/settings/data/restore \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"backupName\": \"$BACKUP_NAME\"}"
```
**Expected**: Database restored successfully

#### 11.5 Delete Backup
```bash
curl -X DELETE $BASE_URL/api/settings/data/backup/$BACKUP_NAME \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Backup deleted successfully

#### 11.6 Get Storage Status
```bash
curl $BASE_URL/api/settings/storage \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Storage type and configuration info

---

### ✅ Section 12: Performance & Load (4 tests)

#### 12.1 Concurrent Requests
```bash
# Run 100 concurrent requests
for i in {1..100}; do
  curl $BASE_URL/api/health &
done
wait
```
**Expected**: All requests succeed

#### 12.2 Large Config Resolution
```bash
# Create config with 1000+ properties
# Then resolve it
curl $BASE_URL/api/configs/{largeConfigId} \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: Resolves in <1 second

#### 12.3 Deep Inheritance Chain
```bash
# Create chain: PRODUCT -> INSTANCE -> USER -> VERSION (4 levels)
# Then resolve leaf config
curl $BASE_URL/api/configs/{leafConfigId} \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected**: All levels merged correctly

#### 12.4 Large File Upload
```bash
# Create 50MB file
dd if=/dev/zero of=large-file.bin bs=1M count=50

curl -X POST $BASE_URL/api/file-management/upload \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@large-file.bin" \
  -F "configId=$PRODUCT_ID" \
  -F "propertyPath=largeFile"
```
**Expected**: Upload succeeds (may take time)

---

## Test Results Summary

### Pass/Fail Tracking

| Section | Total Tests | Passed | Failed | Notes |
|---------|-------------|--------|--------|-------|
| 1. Health & Infrastructure | 2 | | | |
| 2. Authentication | 8 | | | |
| 3. User Management | 7 | | | |
| 4. Configs - Basic CRUD | 10 | | | |
| 5. Configs - Advanced | 8 | | | |
| 6. Component Expansion | 5 | | | |
| 7. Rules | 10 | | | |
| 8. File Management | 12 | | | |
| 9. Folder Import | 6 | | | |
| 10. Array Path Traversal | 5 | | | |
| 11. Backup & Restore | 6 | | | |
| 12. Performance & Load | 4 | | | |
| **TOTAL** | **83** | | | |

---

## Critical Issues Checklist

Before production deployment, verify:

- [ ] All authentication flows work
- [ ] Permissions enforced correctly (admin vs user)
- [ ] Config resolution with provenance correct
- [ ] Component expansion works
- [ ] File uploads/downloads work
- [ ] Folder import works
- [ ] URL regeneration works
- [ ] Backup/restore works
- [ ] No data corruption
- [ ] No memory leaks (monitor during load test)
- [ ] All error messages user-friendly
- [ ] Logs don't contain sensitive data

---

## Performance Benchmarks

Record these metrics:

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Startup time | <200ms | | |
| Health check response | <10ms | | |
| Login response | <50ms | | |
| Config resolution (simple) | <20ms | | |
| Config resolution (complex) | <100ms | | |
| File upload (1MB) | <500ms | | |
| Concurrent requests (100) | >95% success | | |
| Memory usage (idle) | <50MB | | |
| Memory usage (load) | <200MB | | |

---

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Check token is valid and not expired
- Verify `Authorization: Bearer <token>` header format
- Try X-API-Key header as fallback

**403 Forbidden**
- Check user has correct role (ADMIN vs USER)
- Verify config ownership
- Check config status (DRAFT vs COMMITTED)

**404 Not Found**
- Verify ID format (must be valid ObjectID hex)
- Check resource exists in database
- Verify path syntax for array notation

**500 Internal Server Error**
- Check server logs: `docker logs <container-id>`
- Verify MongoDB is running
- Check storage is configured correctly

---

## Next Steps After Testing

1. **All tests pass**: Proceed to production deployment
2. **Some tests fail**: Fix issues and retest
3. **Performance issues**: Optimize and retest
4. **Critical bugs**: Do not deploy, fix first

---

## Production Readiness Checklist

- [ ] All 83 tests passed
- [ ] Performance benchmarks met
- [ ] No critical issues found
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation reviewed
- [ ] Rollback plan documented
- [ ] Monitoring configured
- [ ] Team trained on new service

---

**Testing Complete!** ✅

If all tests pass, your Go service is **ready for production deployment**.

Follow `PRODUCTION_MIGRATION_PLAN.md` for deployment steps.

