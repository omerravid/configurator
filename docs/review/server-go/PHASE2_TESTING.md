# Phase 2: Users & Permissions - Testing Guide

## Overview
Phase 2 implements user management endpoints and comprehensive permission checks for configurations.

## What Was Implemented

### 1. Users Management Endpoints (Admin Only)
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id/role` - Update user role
- `DELETE /api/users/:id` - Delete user (prevents self-deletion)
- `GET /api/users/:id/configurations` - Get user's configurations

### 2. Permission Middleware
- `RequireAdmin()` - Blocks non-admin users
- `CheckConfigPermissions()` - Implements ownership and status checks:
  - Admins can do anything
  - Non-admins cannot modify PRODUCT/INSTANCE/COMPONENT configs
  - Non-admins can only modify their own USER/VERSION configs
  - Cannot modify COMMITTED configs (except commit operation on DRAFT)

### 3. Applied Permissions
- **Create config**: Inline check prevents non-admins from creating PRODUCT/INSTANCE/COMPONENT
- **Update config**: `CheckConfigPermissions` middleware
- **Rename config**: Admin only
- **Archive config**: Admin only
- **Restore config**: Admin only
- **Commit config**: `CheckConfigPermissions` (allows DRAFT owners)

---

## Testing Instructions

### Prerequisites
1. Start the service:
```bash
cd server-go
docker compose -f deployments/docker-compose.yml up --build
```

2. Create test users in Postman:

**Admin User:**
```http
POST http://localhost:3004/api/auth/register
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123",
  "role": "ADMIN"
}
```
Save the returned token as `{{adminToken}}`

**Regular User:**
```http
POST http://localhost:3004/api/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "password": "password123",
  "role": "USER"
}
```
Save the returned token as `{{userToken}}`

---

## Test Cases

### A. Users Management (Admin Only)

#### A1. List All Users (Admin)
```http
GET http://localhost:3004/api/users
Authorization: Bearer {{adminToken}}
```
**Expected**: 200 OK, list of users

#### A2. List All Users (Non-Admin) - Should Fail
```http
GET http://localhost:3004/api/users
Authorization: Bearer {{userToken}}
```
**Expected**: 403 Forbidden, `"error": "Admin access required"`

#### A3. Get User by ID (Admin)
```http
GET http://localhost:3004/api/users/{{userId}}
Authorization: Bearer {{adminToken}}
```
**Expected**: 200 OK, user details

#### A4. Update User Role (Admin)
```http
PUT http://localhost:3004/api/users/{{userId}}/role
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "role": "ADMIN"
}
```
**Expected**: 200 OK, `"message": "User role updated successfully"`

#### A5. Update User Role (Non-Admin) - Should Fail
```http
PUT http://localhost:3004/api/users/{{userId}}/role
Authorization: Bearer {{userToken}}
Content-Type: application/json

{
  "role": "ADMIN"
}
```
**Expected**: 403 Forbidden

#### A6. Delete User (Admin)
```http
DELETE http://localhost:3004/api/users/{{userId}}
Authorization: Bearer {{adminToken}}
```
**Expected**: 200 OK, `"message": "User deleted successfully"`

#### A7. Delete Self (Admin) - Should Fail
```http
DELETE http://localhost:3004/api/users/{{adminUserId}}
Authorization: Bearer {{adminToken}}
```
**Expected**: 400 Bad Request, `"error": "Cannot delete your own account"`

#### A8. Get User's Configurations
```http
GET http://localhost:3004/api/users/{{userId}}/configurations?includeArchived=false
Authorization: Bearer {{adminToken}}
```
**Expected**: 200 OK, list of configurations owned by user

---

### B. Configuration Permissions

#### B1. Create PRODUCT Config (Admin)
```http
POST http://localhost:3004/api/configs
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "name": "TestProduct",
  "type": "PRODUCT",
  "data": {
    "version": "1.0.0"
  }
}
```
**Expected**: 201 Created

#### B2. Create PRODUCT Config (Non-Admin) - Should Fail
```http
POST http://localhost:3004/api/configs
Authorization: Bearer {{userToken}}
Content-Type: application/json

{
  "name": "TestProduct2",
  "type": "PRODUCT",
  "data": {
    "version": "1.0.0"
  }
}
```
**Expected**: 403 Forbidden, `"error": "Only admins can create Product/Instance/Component configurations"`

#### B3. Create USER Config (Non-Admin)
```http
POST http://localhost:3004/api/configs
Authorization: Bearer {{userToken}}
Content-Type: application/json

{
  "name": "MyUserConfig",
  "type": "USER",
  "parent_id": "{{productConfigId}}",
  "data": {
    "customSetting": "value"
  }
}
```
**Expected**: 201 Created (status: DRAFT)

#### B4. Update Own USER Config (Non-Admin)
```http
PUT http://localhost:3004/api/configs/{{userConfigId}}
Authorization: Bearer {{userToken}}
Content-Type: application/json

{
  "data": {
    "customSetting": "updated value"
  }
}
```
**Expected**: 200 OK

#### B5. Update Someone Else's Config (Non-Admin) - Should Fail
```http
PUT http://localhost:3004/api/configs/{{otherUserConfigId}}
Authorization: Bearer {{userToken}}
Content-Type: application/json

{
  "data": {
    "hack": "attempt"
  }
}
```
**Expected**: 403 Forbidden, `"error": "You can only modify your own configurations"`

#### B6. Update PRODUCT Config (Non-Admin) - Should Fail
```http
PUT http://localhost:3004/api/configs/{{productConfigId}}
Authorization: Bearer {{userToken}}
Content-Type: application/json

{
  "data": {
    "version": "2.0.0"
  }
}
```
**Expected**: 403 Forbidden, `"error": "Only admins can modify Product/Instance/Component configurations"`

#### B7. Commit DRAFT Config (Owner)
```http
POST http://localhost:3004/api/configs/{{userConfigId}}/commit
Authorization: Bearer {{userToken}}
```
**Expected**: 200 OK, status changed to COMMITTED

#### B8. Update COMMITTED Config (Owner) - Should Fail
```http
PUT http://localhost:3004/api/configs/{{userConfigId}}
Authorization: Bearer {{userToken}}
Content-Type: application/json

{
  "data": {
    "attempt": "to modify committed"
  }
}
```
**Expected**: 403 Forbidden, `"error": "Cannot modify committed configurations"`

#### B9. Commit Already COMMITTED Config - Should Fail
```http
POST http://localhost:3004/api/configs/{{userConfigId}}/commit
Authorization: Bearer {{userToken}}
```
**Expected**: 403 Forbidden, `"error": "Can only commit DRAFT configurations"`

#### B10. Rename Config (Admin Only)
```http
PUT http://localhost:3004/api/configs/{{configId}}/rename
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "name": "RenamedConfig"
}
```
**Expected**: 200 OK

#### B11. Rename Config (Non-Admin) - Should Fail
```http
PUT http://localhost:3004/api/configs/{{configId}}/rename
Authorization: Bearer {{userToken}}
Content-Type: application/json

{
  "name": "AttemptRename"
}
```
**Expected**: 403 Forbidden

#### B12. Archive Config (Admin Only)
```http
POST http://localhost:3004/api/configs/{{configId}}/archive
Authorization: Bearer {{adminToken}}
```
**Expected**: 200 OK

#### B13. Archive Config (Non-Admin) - Should Fail
```http
POST http://localhost:3004/api/configs/{{configId}}/archive
Authorization: Bearer {{userToken}}
```
**Expected**: 403 Forbidden

#### B14. Restore Config (Admin Only)
```http
POST http://localhost:3004/api/configs/{{configId}}/restore
Authorization: Bearer {{adminToken}}
```
**Expected**: 200 OK

---

## Permission Matrix

| Operation | Admin | Non-Admin (Own USER/VERSION DRAFT) | Non-Admin (Own COMMITTED) | Non-Admin (PRODUCT/INSTANCE/COMPONENT) |
|-----------|-------|-------------------------------------|---------------------------|----------------------------------------|
| List configs | ✅ | ✅ | ✅ | ✅ |
| Get config | ✅ | ✅ | ✅ | ✅ |
| Create PRODUCT/INSTANCE/COMPONENT | ✅ | ❌ | ❌ | ❌ |
| Create USER/VERSION | ✅ | ✅ | ✅ | ✅ |
| Update own DRAFT | ✅ | ✅ | N/A | N/A |
| Update own COMMITTED | ✅ | ❌ | ❌ | N/A |
| Update PRODUCT/INSTANCE/COMPONENT | ✅ | ❌ | ❌ | ❌ |
| Update other's config | ✅ | ❌ | ❌ | ❌ |
| Commit own DRAFT | ✅ | ✅ | N/A | N/A |
| Commit COMMITTED | ✅ | ❌ | ❌ | ❌ |
| Rename | ✅ | ❌ | ❌ | ❌ |
| Archive | ✅ | ❌ | ❌ | ❌ |
| Restore | ✅ | ❌ | ❌ | ❌ |
| List users | ✅ | ❌ | ❌ | ❌ |
| Update user role | ✅ | ❌ | ❌ | ❌ |
| Delete user | ✅ | ❌ | ❌ | ❌ |

---

## Expected Behavior Summary

### Admin Users
- Can perform ALL operations
- Can manage all users
- Can create/modify/delete any configuration
- Can archive/restore/rename any configuration

### Regular Users
- Can create USER and VERSION configurations (start as DRAFT)
- Can modify their own DRAFT configurations
- Can commit their own DRAFT configurations
- **Cannot** modify COMMITTED configurations
- **Cannot** modify PRODUCT/INSTANCE/COMPONENT configurations
- **Cannot** modify other users' configurations
- **Cannot** rename/archive/restore configurations
- **Cannot** manage users

---

## Troubleshooting

### 401 Unauthorized
- Check that Authorization header is present: `Authorization: Bearer <token>`
- Verify token is valid (not expired, correct JWT secret)
- Try using X-API-Key header as fallback

### 403 Forbidden
- Check user role (admin vs user)
- Verify ownership of configuration
- Check configuration status (DRAFT vs COMMITTED)
- Check configuration type (PRODUCT/INSTANCE/COMPONENT vs USER/VERSION)

### 404 Not Found
- Verify ID format (must be valid MongoDB ObjectID hex string)
- Check that resource exists in database

---

## Next Steps

After testing Phase 2, proceed to:
- **Phase 3**: Advanced Config Features (component expansion, schema enforcement, full provenance)
- **Phase 4**: File Management (upload, delete, folder import)
- **Phase 5**: Settings Enhancements (storage config, upload-restore)

