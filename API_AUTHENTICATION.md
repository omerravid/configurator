# Third-Party Service Authentication

This document explains how third-party services can authenticate to access data and download files from the system.

## Authentication Methods

The system supports two authentication methods:

### 1. JWT Token Authentication (for web users)
- Used by the web interface
- Requires user login credentials
- Token stored in browser localStorage

### 2. API Key Authentication (for third-party services)
- Used by external services, scripts, and integrations
- Uses a shared API key
- No user credentials required

## API Key Usage

Third-party services should include the API key in the request headers:

```http
X-API-Key: your-api-key-here
```

## Available Endpoints for Third-Party Services

### Configuration Data Access

**List all configurations:**
```http
GET /api/configs
X-API-Key: your-api-key-here
```

**Get specific configuration:**
```http
GET /api/configs/{config-id}
X-API-Key: your-api-key-here
```

**Get configuration data at specific path:**
```http
GET /api/configs/{config-id}/data?path=some.nested.path
X-API-Key: your-api-key-here
```

**Get child configurations:**
```http
GET /api/configs/{config-id}/children
X-API-Key: your-api-key-here
```

### File Downloads

**Download file:**
```http
GET /api/files/{storage-key}
X-API-Key: your-api-key-here
```

**Get file metadata:**
```http
GET /api/files/{storage-key}/info
X-API-Key: your-api-key-here
```

## Example Usage

### Using curl
```bash
# Get all configurations
curl -H "X-API-Key: your-api-key-here" \
     http://your-domain/api/configs

# Download a file
curl -H "X-API-Key: your-api-key-here" \
     -O \
     http://your-domain/api/files/some-storage-key
```

### Using JavaScript/Node.js
```javascript
const apiKey = 'your-api-key-here';
const baseUrl = 'http://your-domain';

// Get configurations
const response = await fetch(`${baseUrl}/api/configs`, {
  headers: {
    'X-API-Key': apiKey
  }
});
const data = await response.json();

// Download file
const fileResponse = await fetch(`${baseUrl}/api/files/storage-key`, {
  headers: {
    'X-API-Key': apiKey
  }
});
const fileBlob = await fileResponse.blob();
```

### Using Python
```python
import requests

api_key = 'your-api-key-here'
base_url = 'http://your-domain'

headers = {'X-API-Key': api_key}

# Get configurations
response = requests.get(f'{base_url}/api/configs', headers=headers)
data = response.json()

# Download file
file_response = requests.get(f'{base_url}/api/files/storage-key', headers=headers)
with open('downloaded-file', 'wb') as f:
    f.write(file_response.content)
```

## Permissions

API key authentication grants **read-only admin access** to:
- All configuration data
- All files
- All metadata

API keys **cannot** perform:
- Create/update/delete operations
- User management
- System configuration changes

## Security Notes

1. **Keep API keys secure** - Store them as environment variables or in secure credential storage
2. **Use HTTPS** in production to protect API keys in transit
3. **Rotate API keys** periodically for security
4. **Monitor API usage** to detect unauthorized access

## Configuration

The API key is configured via the `API_KEY` environment variable on the server.
