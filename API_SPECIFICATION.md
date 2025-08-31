# Configuration Manager - Complete API Specification

## Overview
This document provides detailed API specifications for the Configuration Manager system, including request/response schemas, authentication mechanisms, error handling, and usage examples.

## Base URL
- **Development**: `http://localhost:3002/api`
- **Production**: `https://your-domain.com/api`

## Authentication

### JWT Token Authentication
Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt-token>
```

### API Key Authentication  
Machine-to-machine access via API key header:
```
X-API-Key: <api-key>
```

### Combined Authentication
Some endpoints accept either JWT token OR API key for flexibility.

---

## Authentication Endpoints

### POST /api/auth/login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "username": "string (3-50 chars, required)",
  "password": "string (6+ chars, required)"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id-123",
    "username": "admin",
    "role": "ADMIN",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
- `400`: Invalid input validation
- `401`: Invalid username or password

### POST /api/auth/register
Register new user (requires admin privileges or open registration).

**Request Body:**
```json
{
  "username": "string (3-50 chars, required)",
  "password": "string (6+ chars, required)",
  "role": "ADMIN|USER (default: USER)"
}
```

**Response (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "new-user-id",
    "username": "newuser",
    "role": "USER",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### GET /api/auth/me
Get current authenticated user information.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "user": {
    "id": "user-id-123",
    "username": "admin", 
    "role": "ADMIN",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### POST /api/auth/refresh
Refresh JWT token.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Configuration Endpoints

### GET /api/configs
List all configurations with optional filtering.

**Headers:** `Authorization: Bearer <token>` OR `X-API-Key: <key>`

**Query Parameters:**
- `type`: Filter by type (PRODUCT|INSTANCE|USER|COMPONENT|VERSION)
- `status`: Filter by status (DRAFT|COMMITTED)
- `includeArchived`: Include archived configs (true|false, default: false)

**Response (200):**
```json
{
  "configs": [
    {
      "id": "config-id-123",
      "name": "Display",
      "type": "COMPONENT",
      "parent_id": null,
      "created_by": "admin",
      "description": "Display configuration component",
      "status": "COMMITTED",
      "archived": false,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### POST /api/configs
Create new configuration.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "string (3-100 chars, required, unique)",
  "type": "PRODUCT|INSTANCE|USER|COMPONENT|VERSION (required)",
  "parent_id": "string (optional, null for root configs)",
  "data": "object (required, JSON configuration data)",
  "description": "string (max 500 chars, optional)"
}
```

**Response (201):**
```json
{
  "config": {
    "id": "new-config-id",
    "name": "New Configuration",
    "type": "COMPONENT",
    "parent_id": null,
    "data": { ... },
    "created_by": "admin",
    "description": "New configuration",
    "status": "COMMITTED",
    "archived": false,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Permission Rules:**
- ADMIN: Can create any type
- USER: Can only create USER and VERSION types
- Draft status: Only USER and VERSION can be created as DRAFT

### GET /api/configs/:id
Get configuration with resolved inheritance and optional provenance.

**Headers:** `Authorization: Bearer <token>` OR `X-API-Key: <key>`

**Query Parameters:**
- `provenance`: Include provenance tracking (true|false, default: false)
- `raw`: Return raw config without inheritance resolution (true|false, default: false)

**Response (200) - Resolved with Provenance:**
```json
{
  "config": {
    "id": "config-id-123",
    "name": "SmartWatch Lite",
    "type": "PRODUCT",
    "parent_id": null,
    "created_by": "admin",
    "description": "Essential smart watch",
    "status": "COMMITTED",
    "archived": false,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  },
  "data": {
    "Display": {
      "value": {
        "screen": {
          "value": {
            "resolution": {
              "value": {
                "width": {
                  "value": 454,
                  "source": {
                    "id": "display-component-id",
                    "name": "Display",
                    "type": "COMPONENT"
                  }
                },
                "height": {
                  "value": 454,
                  "source": {
                    "id": "display-component-id", 
                    "name": "Display",
                    "type": "COMPONENT"
                  }
                }
              },
              "source": {
                "id": "display-component-id",
                "name": "Display", 
                "type": "COMPONENT"
              }
            }
          },
          "source": {
            "id": "display-component-id",
            "name": "Display",
            "type": "COMPONENT"
          }
        }
      },
      "source": {
        "id": "config-id-123",
        "name": "SmartWatch Lite",
        "type": "PRODUCT"
      }
    }
  },
  "inheritance_chain": [
    {
      "id": "config-id-123",
      "name": "SmartWatch Lite",
      "type": "PRODUCT"
    }
  ]
}
```

**Response (200) - Raw Configuration:**
```json
{
  "config": {
    "id": "config-id-123",
    "name": "SmartWatch Lite",
    "type": "PRODUCT",
    "parent_id": null,
    "data": {
      "Display": {
        "componentId": "display-component-id",
        "versionId": "display-component-id",
        "componentName": "Display",
        "versionName": "Display (root)"
      }
    },
    "created_by": "admin",
    "description": "Essential smart watch",
    "status": "COMMITTED",
    "archived": false,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### PUT /api/configs/:id
Update existing configuration.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "data": "object (optional, partial or complete config data)",
  "description": "string (max 500 chars, optional)"
}
```

**Response (200):**
```json
{
  "config": {
    "id": "config-id-123",
    "name": "Updated Configuration",
    "type": "COMPONENT",
    "parent_id": null,
    "data": { "updated": "data" },
    "created_by": "admin", 
    "description": "Updated description",
    "status": "COMMITTED",
    "archived": false,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T11:45:00.000Z"
  }
}
```

**Permission Rules:**
- ADMIN: Can update any configuration
- USER: Can only update own USER/VERSION configs in DRAFT status
- COMMITTED configs cannot be modified (except by admin for non-USER types)

### DELETE /api/configs/:id
Delete configuration and optionally its children.

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**
```json
{
  "message": "Configuration deleted successfully",
  "deletedConfig": {
    "id": "config-id-123",
    "name": "Deleted Configuration"
  }
}
```

### GET /api/configs/:id/data
Get specific property value from resolved configuration.

**Headers:** `Authorization: Bearer <token>` OR `X-API-Key: <key>`

**Query Parameters:**
- `path`: Dot-notation path to property (e.g., "Display.screen.resolution.width")
- `minimal`: Return minimal response (true|false, default: false)

**Response (200) - Full:**
```json
{
  "value": 454,
  "path": "Display.screen.resolution.width",
  "source": {
    "id": "display-component-id",
    "name": "Display",
    "type": "COMPONENT",
    "createdBy": "admin",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "config": {
    "id": "config-id-123",
    "name": "SmartWatch Lite",
    "type": "PRODUCT"
  }
}
```

**Response (200) - Minimal:**
```json
{
  "value": 454
}
```

### POST /api/configs/:id/commit
Commit draft configuration (makes it immutable).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Configuration committed successfully",
  "config": {
    "id": "config-id-123",
    "name": "Configuration Name",
    "status": "COMMITTED",
    "updated_at": "2024-01-15T11:45:00.000Z"
  }
}
```

**Requirements:**
- Only DRAFT configurations can be committed
- Only config owner or admin can commit
- USER and VERSION types only

### GET /api/configs/:id/children
Get child configurations.

**Headers:** `Authorization: Bearer <token>` OR `X-API-Key: <key>`

**Response (200):**
```json
{
  "children": [
    {
      "id": "child-config-id-1",
      "name": "Child Configuration 1",
      "type": "VERSION",
      "parent_id": "config-id-123",
      "created_by": "admin",
      "status": "COMMITTED",
      "archived": false,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### GET /api/configs/components
Get all components with their versions (for component selector).

**Headers:** `Authorization: Bearer <token>` OR `X-API-Key: <key>`

**Response (200):**
```json
{
  "components": [
    {
      "id": "component-id-123",
      "name": "Display",
      "type": "COMPONENT",
      "description": "Display configuration component",
      "status": "COMMITTED",
      "created_by": "admin",
      "created_at": "2024-01-15T10:30:00.000Z",
      "versions": [
        {
          "id": "version-id-456",
          "name": "Display v2",
          "type": "VERSION",
          "parent_id": "component-id-123",
          "description": "Enhanced display configuration",
          "status": "COMMITTED",
          "created_by": "admin",
          "created_at": "2024-01-15T11:00:00.000Z"
        }
      ]
    }
  ]
}
```

### PUT /api/configs/:id/rename
Rename configuration (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Request Body:**
```json
{
  "name": "string (3-100 chars, required, unique)"
}
```

**Response (200):**
```json
{
  "config": {
    "id": "config-id-123",
    "name": "New Configuration Name",
    "updated_at": "2024-01-15T11:45:00.000Z"
  }
}
```

### POST /api/configs/:id/archive
Archive configuration (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**
```json
{
  "message": "Configuration archived successfully",
  "config": {
    "id": "config-id-123",
    "name": "Configuration Name",
    "archived": true,
    "updated_at": "2024-01-15T11:45:00.000Z"
  }
}
```

### POST /api/configs/:id/restore
Restore archived configuration (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**
```json
{
  "message": "Configuration restored successfully",
  "config": {
    "id": "config-id-123",
    "name": "Configuration Name",
    "archived": false,
    "updated_at": "2024-01-15T11:45:00.000Z"
  }
}
```

---

## User Management Endpoints

### GET /api/users
List all users (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**
```json
{
  "users": [
    {
      "id": "user-id-123",
      "username": "admin",
      "role": "ADMIN",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "user-id-456", 
      "username": "user1",
      "role": "USER",
      "created_at": "2024-01-15T10:35:00.000Z",
      "updated_at": "2024-01-15T10:35:00.000Z"
    }
  ]
}
```

### GET /api/users/:id
Get user details (self or admin).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "user": {
    "id": "user-id-123",
    "username": "admin",
    "role": "ADMIN",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### PUT /api/users/:id/role
Update user role (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Request Body:**
```json
{
  "role": "ADMIN|USER"
}
```

**Response (200):**
```json
{
  "message": "User role updated successfully",
  "user": {
    "id": "user-id-456",
    "username": "user1", 
    "role": "ADMIN",
    "updated_at": "2024-01-15T11:45:00.000Z"
  }
}
```

### DELETE /api/users/:id
Delete user (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**
```json
{
  "message": "User deleted successfully",
  "deletedUser": {
    "id": "user-id-456",
    "username": "user1"
  }
}
```

### GET /api/users/:id/configurations
List user's configurations.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "configurations": [
    {
      "id": "config-id-789",
      "name": "My User Config",
      "type": "USER",
      "parent_id": "product-id-123",
      "status": "DRAFT",
      "created_at": "2024-01-15T10:40:00.000Z",
      "updated_at": "2024-01-15T11:00:00.000Z"
    }
  ]
}
```

---

## File Management Endpoints

### GET /api/files/:storageKey
Serve file content (embedded storage only).

**Headers:** `Authorization: Bearer <token>` OR `X-API-Key: <key>`

**Response (200):**
- Binary file content with appropriate Content-Type header
- Content-Disposition header for filename

**Response (404):**
```json
{
  "error": "File not found"
}
```

### GET /api/files/:storageKey/info
Get file metadata and download URL.

**Headers:** `Authorization: Bearer <token>` OR `X-API-Key: <key>`

**Response (200):**
```json
{
  "metadata": {
    "storageKey": "file-storage-key-123",
    "originalName": "document.pdf",
    "mimeType": "application/pdf",
    "size": 1048576,
    "storageType": "embedded",
    "uploaded_at": "2024-01-15T10:30:00.000Z"
  },
  "downloadUrl": "http://localhost:3002/api/files/file-storage-key-123"
}
```

### POST /api/file-management/replace
Replace file in existing configuration.

**Headers:** `Authorization: Bearer <token>`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: File upload (required)
- `configId`: Configuration ID (required)
- `propertyPath`: Dot-notation path to file property (required)

**Response (200):**
```json
{
  "message": "File replaced successfully",
  "fileObject": {
    "_type": "file",
    "_metadata": {
      "storageKey": "new-file-key-123",
      "originalName": "new-document.pdf",
      "mimeType": "application/pdf",
      "size": 2097152,
      "storageType": "embedded"
    },
    "_link": "http://localhost:3002/api/files/new-file-key-123"
  },
  "config": {
    "id": "config-id-123",
    "updated_at": "2024-01-15T11:45:00.000Z"
  }
}
```

### POST /api/folder-import
Bulk import folder structure with JSON and binary files.

**Headers:** `Authorization: Bearer <token>`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `files[]`: Multiple file uploads
- `structure`: JSON string describing folder structure

**Response (200):**
```json
{
  "message": "Folder imported successfully",
  "imported": {
    "jsonFiles": 5,
    "binaryFiles": 12,
    "totalSize": 15728640
  },
  "structure": {
    "folder1": {
      "config.json": { ... },
      "image.png": {
        "_type": "file",
        "_metadata": { ... },
        "_link": "..."
      }
    }
  }
}
```

---

## Settings & Administration Endpoints

### GET /api/settings/mongodb
Get MongoDB connection settings and status (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**
```json
{
  "success": true,
  "settings": {
    "connectionString": "mongodb://*****:*****@localhost:27017/config_manager",
    "options": {
      "useNewUrlParser": true,
      "useUnifiedTopology": true
    }
  },
  "status": {
    "connected": true,
    "host": "localhost:27017",
    "database": "config_manager",
    "type": "embedded"
  }
}
```

### PUT /api/settings/mongodb
Update MongoDB connection settings (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Request Body:**
```json
{
  "connectionString": "mongodb://username:password@host:port/database",
  "options": {
    "useNewUrlParser": true,
    "useUnifiedTopology": true
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "MongoDB settings updated successfully",
  "requiresRestart": true
}
```

### POST /api/settings/mongodb/test
Test MongoDB connection (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Request Body:**
```json
{
  "connectionString": "mongodb://username:password@host:port/database"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "MongoDB connection successful",
  "details": {
    "host": "host:port",
    "database": "database",
    "connected": true,
    "latency": 45
  }
}
```

### POST /api/settings/mongodb/migrate
Migrate from SQLite to external MongoDB (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Request Body:**
```json
{
  "connectionString": "mongodb://username:password@host:port/database",
  "createBackup": true
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Migration completed successfully",
  "migrated": {
    "users": 3,
    "configurations": 10
  },
  "backup": {
    "created": true,
    "filename": "pre-migration-backup-1642246800000.json"
  }
}
```

### POST /api/settings/mongodb/migrate-embedded
Migrate to embedded MongoDB (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**
```json
{
  "success": true,
  "message": "Migration to embedded MongoDB completed successfully",
  "migrated": {
    "users": 3,
    "configurations": 10
  },
  "embeddedMongo": {
    "started": true,
    "connectionString": "mongodb://127.0.0.1:27017/"
  }
}
```

### POST /api/settings/mongodb/revert-to-sqlite
Migrate back to SQLite from MongoDB (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**
```json
{
  "success": true,
  "message": "Reverted to SQLite successfully",
  "migrated": {
    "users": 3,
    "configurations": 10
  }
}
```

### GET /api/settings/data/status
Get data statistics (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**
```json
{
  "success": true,
  "statistics": {
    "users": {
      "total": 5,
      "admins": 2,
      "regularUsers": 3
    },
    "configurations": {
      "total": 25,
      "byType": {
        "PRODUCT": 3,
        "INSTANCE": 5,
        "USER": 8,
        "COMPONENT": 6,
        "VERSION": 3
      },
      "byStatus": {
        "COMMITTED": 20,
        "DRAFT": 5
      },
      "archived": 2
    },
    "storage": {
      "type": "embedded",
      "totalFiles": 45,
      "totalSize": 52428800
    }
  }
}
```

### POST /api/settings/data/backup
Create data backup (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Request Body:**
```json
{
  "name": "manual-backup-2024-01-15"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Backup created successfully",
  "backup": {
    "filename": "manual-backup-2024-01-15.json",
    "timestamp": "2024-01-15T11:45:00.000Z",
    "size": 1048576,
    "included": {
      "users": 5,
      "configurations": 25
    }
  }
}
```

### GET /api/settings/data/backups
List available backups (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**
```json
{
  "success": true,
  "backups": [
    {
      "filename": "manual-backup-2024-01-15.json",
      "timestamp": "2024-01-15T11:45:00.000Z",
      "size": 1048576,
      "type": "manual"
    },
    {
      "filename": "pre-migration-backup-1642246800000.json",
      "timestamp": "2024-01-15T10:00:00.000Z",
      "size": 524288,
      "type": "automatic"
    }
  ]
}
```

### POST /api/settings/data/restore
Restore from backup (admin only).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Request Body:**
```json
{
  "filename": "manual-backup-2024-01-15.json",
  "createBackup": true
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Data restored successfully",
  "restored": {
    "users": 5,
    "configurations": 25
  },
  "preRestoreBackup": {
    "filename": "pre-restore-backup-1642250400000.json",
    "created": true
  }
}
```

---

## Error Responses

### Standard Error Format
All error responses follow this format:

```json
{
  "error": "Error message description",
  "details": "Additional error details (optional)",
  "code": "ERROR_CODE (optional)"
}
```

### HTTP Status Codes

#### 400 Bad Request
Input validation failed or malformed request.

```json
{
  "error": "\"username\" length must be at least 3 characters long"
}
```

#### 401 Unauthorized
Authentication required or failed.

```json
{
  "error": "No token provided"
}
```

```json
{
  "error": "Invalid token"
}
```

#### 403 Forbidden
Insufficient permissions for the requested operation.

```json
{
  "error": "Only admins can modify Product/Instance/Component configurations"
}
```

```json
{
  "error": "You can only modify your own configurations"
}
```

#### 404 Not Found
Requested resource not found.

```json
{
  "error": "Configuration not found"
}
```

```json
{
  "error": "User not found"
}
```

#### 409 Conflict
Resource conflict (duplicate names, etc.).

```json
{
  "error": "Configuration name already exists",
  "details": "A configuration with the name 'Display' already exists"
}
```

#### 422 Unprocessable Entity
Business logic validation failed.

```json
{
  "error": "Cannot modify committed configurations"
}
```

```json
{
  "error": "Cannot delete configuration with children",
  "details": "Configuration has 3 child configurations"
}
```

#### 500 Internal Server Error
Unexpected server error.

```json
{
  "error": "Internal server error",
  "details": "Database connection failed"
}
```

---

## Rate Limiting & Quotas

### Default Limits
- **Authentication endpoints**: 10 requests per minute per IP
- **Configuration operations**: 100 requests per minute per user
- **File uploads**: 10 uploads per minute per user, 100MB max file size
- **Bulk operations**: 5 requests per minute per user

### Headers
Rate limit information is included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642250400
```

---

## Webhooks (Future Enhancement)

### Configuration Change Webhook
POST to configured URL when configurations are modified.

**Payload:**
```json
{
  "event": "configuration.updated",
  "timestamp": "2024-01-15T11:45:00.000Z",
  "data": {
    "configId": "config-id-123",
    "configName": "Display",
    "configType": "COMPONENT",
    "operation": "update",
    "userId": "user-id-123",
    "username": "admin",
    "changes": {
      "data.screen.brightness.max": {
        "old": 100,
        "new": 120
      }
    }
  }
}
```

---

## SDK Examples

### JavaScript/Node.js
```javascript
const ConfigurationManager = require('@your-org/config-manager-sdk');

const client = new ConfigurationManager({
  baseURL: 'http://localhost:3002/api',
  apiKey: 'your-api-key'
});

// Get resolved configuration
const config = await client.configs.get('config-id-123', {
  provenance: true
});

// Create new configuration
const newConfig = await client.configs.create({
  name: 'New Component',
  type: 'COMPONENT',
  data: { setting: 'value' }
});

// Get specific configuration value
const value = await client.configs.getValue('config-id-123', 'path.to.property');
```

### Python
```python
from config_manager import ConfigurationManager

client = ConfigurationManager(
    base_url='http://localhost:3002/api',
    api_key='your-api-key'
)

# Get resolved configuration
config = client.configs.get('config-id-123', provenance=True)

# Create new configuration  
new_config = client.configs.create({
    'name': 'New Component',
    'type': 'COMPONENT', 
    'data': {'setting': 'value'}
})

# Get specific configuration value
value = client.configs.get_value('config-id-123', 'path.to.property')
```

### cURL Examples
```bash
# Login
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Get configuration with provenance
curl -X GET "http://localhost:3002/api/configs/config-id-123?provenance=true" \
  -H "Authorization: Bearer $TOKEN"

# Create configuration
curl -X POST http://localhost:3002/api/configs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Component",
    "type": "COMPONENT",
    "data": {"setting": "value"}
  }'

# Get specific value
curl -X GET "http://localhost:3002/api/configs/config-id-123/data?path=Display.screen.resolution.width&minimal=true" \
  -H "Authorization: Bearer $TOKEN"
```

---

This comprehensive API specification provides all the details needed to integrate with the Configuration Manager system, including authentication, CRUD operations, file management, and administrative functions.
