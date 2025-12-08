# Configuration Manager

A comprehensive component-based configuration management system with deep merge capabilities, provenance tracking, and hierarchical inheritance. Built with Go for high performance and type safety.

## Features

### Core Functionality

- **Component-Version Architecture**: Reusable configuration components with versioning support
- **Layered Inheritance**: Configurations inherit from parent configurations with deep merge support
- **Provenance Tracking**: Track which configuration level provides each specific value
- **Immutable Committed Configs**: Once committed, configurations become read-only
- **Rules & Validation**: Define validation rules for configuration properties with inheritance
- **Structured Logging**: Comprehensive request/response logging with correlation IDs

### Configuration Types

- **Component**: Reusable configuration modules (e.g., database settings, API configurations)
- **Version**: Specific versions of components with modifications or updates
- **Product**: Top-level configurations built from components
- **Instance**: Environment-specific deployments of products (staging, production)
- **User**: Personal configurations for individual users, can be Draft or Committed

### User Interface

- **Tree Navigation**: Browse configurations in a hierarchical tree structure
- **Dual View Modes**: Toggle between Flat JSON view and Structural split-panel editing
- **JSON Viewer with Provenance**: Hover over any value to see which configuration provided it
- **Component Selector**: Easy component selection and version management for products
- **Structural Editing**: Split-panel interface with tree navigation and property panel
- **Context Menus**: Right-click operations for copy, paste, add, rename, delete
- **Import Functionality**: Import folder structures to quickly prototype components
- **Version Management**: Inline component version editing with dropdown selection
- **Dark Mode Interface**: Modern dark theme enabled by default with light mode toggle
- **Theme Persistence**: Theme preference automatically saved and restored
- **Admin Settings Panel**: Backup/restore data and manage storage
- **Role-based Access**: Admin and User roles with appropriate permissions
- **View State Persistence**: Selected configuration and view mode preserved across page refreshes

### File Management

- **Multiple Storage Backends**: Local filesystem or AWS S3
- **Automatic URL Generation**: Download URLs generated on-demand
- **Folder Import**: Two-pass import for complex directory structures
- **File Metadata**: Track file size, MIME type, and upload information

### Backup & Restore

- **MongoDB Native Tools**: Uses `mongodump` and `mongorestore` for reliable backups
- **Binary Archive Format**: Compressed `.archive` files with gzip
- **Automatic Pre-Restore Backup**: Safety backup created before each restore operation
- **Upload & Restore**: Upload backup files directly through the UI
- **Backup Management**: List, download, and delete backups through the admin panel

---

## Technology Stack

### Backend

- **Go 1.21+** with Gin framework (github.com/gin-gonic/gin)
- **MongoDB** official driver (go.mongodb.org/mongo-driver)
- **JWT Authentication** (github.com/golang-jwt/jwt/v5)
- **Password Hashing** with bcrypt (golang.org/x/crypto/bcrypt)
- **Validation** (github.com/go-playground/validator/v10)
- **Configuration** with Viper (github.com/spf13/viper)
- **Structured Logging** with Zap (go.uber.org/zap)
- **AWS S3 SDK v2** for cloud storage (github.com/aws/aws-sdk-go-v2)
- **Docker** for containerized deployment

### Frontend

- **React** with Vite
- **Tailwind CSS** for styling with dark mode support
- **React Router** for navigation
- **Axios** for API communication
- **Theme Context** for persistent dark/light mode switching

---

## 🚀 Quick Start

### Prerequisites

- **Docker** and Docker Compose
- **Node.js 18+** and npm (for frontend development)

### Installation

1. **Clone the Repository**

   ```bash
   git clone <repository-url>
   cd configurator
   ```

2. **Install Frontend Dependencies**

   ```bash
   cd client
   npm install
   cd ..
   ```

3. **Start the Backend Services**

   ```bash
   cd server-go/deployments
   docker-compose up --build
   ```

   This will start:
   - **MongoDB** on port 27017
   - **Go Backend** on port 3004

4. **Start the Frontend** (in a separate terminal)

   ```bash
   cd client
   npm run dev
   ```

   This will start:
   - **Frontend** on port 5173

5. **Access the Application**

   Open your browser and navigate to: `http://localhost:5173`

### First-Time Setup

1. **Login with default admin credentials**:
   - Username: `admin`
   - Password: `admin123`

2. **Change the default password** (recommended for production)

3. **Start creating configurations!**

---

## Environment Configuration

### Docker Compose Configuration

Edit `server-go/deployments/docker-compose.yml` to customize settings:

```yaml
services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  api-go:
    build:
      context: ..
      dockerfile: build/Dockerfile
    depends_on:
      - mongo
    environment:
      # Server Configuration
      - SERVER_PORT=3004
      - SERVER_BASE_URL=http://localhost:3004
      
      # Database Configuration
      - MONGODB_URI=mongodb://mongo:27017
      - MONGO_DB_NAME=config_manager
      
      # Authentication
      - JWT_SECRET=change-me-in-production
      - API_KEY=change-me-in-production
      
      # Storage Configuration
      - STORAGE_TYPE=embedded  # Options: 'embedded' or 's3'
      - EMBEDDED_STORAGE_PATH=/data/files
      
      # Backup Tools
      - BACKUP_BIN_MONGODUMP=/usr/local/bin/mongodump
      - BACKUP_BIN_MONGORESTORE=/usr/local/bin/mongorestore
      
      # Logging
      - LOG_LEVEL=info  # Options: debug, info, warn, error
    ports:
      - "3004:3004"
    volumes:
      - files_data:/data/files

volumes:
  mongo_data:
  files_data:
```

### AWS S3 Storage Configuration

To use AWS S3 for file storage, update the environment variables:

```yaml
environment:
  - STORAGE_TYPE=s3
  - AWS_REGION=us-east-1
  - AWS_S3_BUCKET=my-config-files
  - AWS_ACCESS_KEY_ID=your-access-key
  - AWS_SECRET_ACCESS_KEY=your-secret-key
  # Optional: Use IAM roles instead of access keys when running in AWS
```

### Frontend Configuration

The frontend proxy is configured in `client/vite.config.js`:

```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3004',  // Go backend port
        changeOrigin: true,
      },
    },
  },
});
```

---

## API Endpoints

### Authentication

- `POST /api/auth/login` - User login (returns JWT token)
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user information
- `POST /api/auth/refresh` - Refresh JWT token

### Configurations

- `GET /api/configs` - List all configurations (supports filters)
- `POST /api/configs` - Create new configuration
- `GET /api/configs/:id` - Get resolved configuration with provenance
- `GET /api/configs/:id/data?path=x.y.z&minimal=true` - Get specific path value
- `PUT /api/configs/:id` - Update configuration
- `POST /api/configs/:id/commit` - Commit user configuration (make read-only)
- `POST /api/configs/:id/archive` - Archive configuration
- `POST /api/configs/:id/restore` - Restore archived configuration
- `PUT /api/configs/:id/rename` - Rename configuration
- `GET /api/configs/:id/children` - Get child configurations
- `GET /api/configs/components` - Get all components with versions
- `GET /api/configs/by-name/:name/data` - Get configuration by name

### Rules & Validation

- `GET /api/rules?configurationId=...` - List rules for configuration
- `POST /api/rules` - Create validation rule
- `GET /api/rules/:id` - Get rule details
- `PUT /api/rules/:id` - Update rule
- `DELETE /api/rules/:id` - Delete rule
- `POST /api/rules/validate` - Validate value against rules
- `GET /api/rules/configuration/:configId/path/:path` - Get rules for specific path with inheritance

### Files

- `POST /api/files/upload` - Upload file (multipart/form-data)
- `GET /api/files/:storageKey` - Download file
- `DELETE /api/files/:storageKey` - Delete file
- `GET /api/files` - List all files with metadata
- `POST /api/files/folder-import` - Import folder structure (two-pass algorithm)

### Settings (Admin Only)

- `POST /api/settings/data/backup` - Create backup (returns backup filename)
- `GET /api/settings/data/backups` - List all available backups
- `GET /api/settings/data/backup/:name` - Download backup file
- `POST /api/settings/data/restore` - Restore from backup (creates pre-restore backup)
- `POST /api/settings/data/upload-restore` - Upload and restore backup file
- `DELETE /api/settings/data/backup/:name` - Delete backup
- `GET /api/settings/data/status` - Get database statistics (user count, config count)
- `GET /api/settings/storage` - Get storage backend information

### Users (Admin Only)

- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user details
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user information
- `PUT /api/users/:id/role` - Update user role
- `DELETE /api/users/:id` - Delete user (cannot delete self)

### Health Check

- `GET /api/health` - Health check endpoint (returns service status)

---

## Project Structure

```
server-go/
├── cmd/
│   └── server/
│       └── main.go              # Application entrypoint
│
├── internal/
│   ├── auth/
│   │   └── jwt.go              # JWT token generation and validation
│   │
│   ├── backup/
│   │   └── service.go          # Backup/restore service (mongodump/mongorestore)
│   │
│   ├── config/
│   │   └── config.go           # Configuration loader (Viper)
│   │
│   ├── configs/
│   │   ├── service.go          # Configuration resolution service
│   │   ├── resolve.go          # Deep merge with provenance
│   │   └── path.go             # Path traversal utilities
│   │
│   ├── files/
│   │   ├── storage.go          # Storage interface and implementations
│   │   └── url_fixer.go        # URL regeneration for file links
│   │
│   ├── http/
│   │   ├── handlers/
│   │   │   ├── auth.go         # Authentication endpoints
│   │   │   ├── configs.go      # Configuration endpoints
│   │   │   ├── rules.go        # Rules endpoints
│   │   │   ├── users.go        # User management endpoints
│   │   │   ├── files.go        # File endpoints
│   │   │   ├── file_management.go  # File management endpoints
│   │   │   ├── folder_import.go    # Folder import endpoints
│   │   │   └── settings.go     # Settings endpoints
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.go         # JWT authentication middleware
│   │   │   └── logging.go      # Request/response logging middleware
│   │   │
│   │   └── router.go           # Route registration
│   │
│   ├── logger/
│   │   ├── logger.go           # Zap logger wrapper
│   │   └── README.md           # Logger documentation
│   │
│   ├── mongo/
│   │   ├── client.go           # MongoDB client initialization
│   │   └── indexes.go          # Index creation
│   │
│   ├── rules/
│   │   └── service.go          # Rules validation service
│   │
│   └── types/
│       ├── config.go           # Configuration types
│       ├── user.go             # User types
│       ├── rule.go             # Rule types
│       └── file.go             # File types
│
├── build/
│   └── Dockerfile              # Multi-stage Docker build
│
├── deployments/
│   └── docker-compose.yml      # Docker Compose configuration
│
├── go.mod                      # Go module dependencies
└── go.sum                      # Dependency checksums

client/
├── src/
│   ├── components/             # React components
│   │   ├── ConfigurationTree.jsx
│   │   ├── InteractiveJSONViewer.jsx
│   │   ├── ComponentSelector.jsx
│   │   ├── SettingsModal.jsx
│   │   └── ...
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx       # Main application page
│   │   ├── Login.jsx
│   │   └── ...
│   │
│   ├── context/
│   │   ├── AuthContext.jsx     # Authentication state
│   │   ├── ThemeContext.jsx    # Dark/light mode
│   │   └── ToastContext.jsx    # Notifications
│   │
│   └── services/
│       └── api.js              # Axios API client
│
└── vite.config.js              # Vite configuration
```

---

## Development

### Backend Development

#### Running Locally (without Docker)

1. **Install Go 1.21+**

2. **Start MongoDB** (via Docker or local installation):
   ```bash
   docker run -d -p 27017:27017 --name mongo mongo:7
   ```

3. **Set environment variables**:
   ```bash
   export MONGODB_URI=mongodb://localhost:27017
   export MONGO_DB_NAME=config_manager
   export JWT_SECRET=dev-secret
   export API_KEY=dev-api-key
   export STORAGE_TYPE=embedded
   export EMBEDDED_STORAGE_PATH=./data/files
   export SERVER_PORT=3004
   export LOG_LEVEL=debug
   ```

4. **Run the server**:
   ```bash
   cd server-go
   go run cmd/server/main.go
   ```

#### Running with Docker Compose

```bash
cd server-go/deployments
docker-compose up --build
```

#### View Logs

```bash
cd server-go/deployments
docker-compose logs -f api-go
```

#### Stop Services

```bash
cd server-go/deployments
docker-compose down
```

#### Clean Restart (removes all data)

```bash
cd server-go/deployments
docker-compose down -v
docker-compose up --build
```

#### Run Tests

```bash
cd server-go
go test ./...
```

#### Build Binary

```bash
cd server-go
go build -o bin/server cmd/server/main.go
./bin/server
```

### Frontend Development

```bash
cd client

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Backup & Restore

### Creating Backups

1. **Via UI**: 
   - Login as admin
   - Go to Settings → Backup & Restore
   - Click "Create Backup"
   - Enter a backup name
   - Backup is saved to the container's backup directory

2. **Via API**:
   ```bash
   curl -X POST http://localhost:3004/api/settings/data/backup \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name": "my-backup"}'
   ```

### Listing Backups

```bash
curl -X GET http://localhost:3004/api/settings/data/backups \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Restoring Backups

1. **Via UI**:
   - Login as admin
   - Go to Settings → Backup & Restore
   - Select a backup from the list
   - Click "Restore Selected"
   - System automatically creates a pre-restore backup
   - Close settings modal to refresh the UI

2. **Via API**:
   ```bash
   curl -X POST http://localhost:3004/api/settings/data/restore \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"backupName": "my-backup.archive"}'
   ```

### Upload & Restore

Upload a backup file and restore it in one operation:

```bash
curl -X POST http://localhost:3004/api/settings/data/upload-restore \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "backupFile=@/path/to/backup.archive"
```

### Downloading Backups

```bash
curl -X GET http://localhost:3004/api/settings/data/backup/my-backup.archive \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o my-backup.archive
```

### Backup File Format

- **Format**: MongoDB binary archive (`.archive`)
- **Compression**: gzip
- **Tool**: Created with `mongodump --archive --gzip`
- **Location**: `/data/backups` inside the container

---

## Logging

The Go backend uses structured logging with Zap. All HTTP requests are logged with:

- **Request ID**: Unique UUID for each request
- **User Information**: User ID and username (if authenticated)
- **Request Details**: Method, path, IP address
- **Response Details**: Status code, duration
- **Error Details**: Full error messages and stack traces

### Log Levels

Set via `LOG_LEVEL` environment variable:

- `debug` - Detailed debugging information
- `info` - General informational messages (default)
- `warn` - Warning messages
- `error` - Error messages only

### Viewing Logs

```bash
# View all logs
cd server-go/deployments
docker-compose logs -f api-go

# View only errors
docker-compose logs -f api-go | grep ERROR

# View logs for specific request
docker-compose logs -f api-go | grep "requestId=<uuid>"
```

---

## Configuration Examples

### Component Configuration (Database)

```json
{
  "host": "localhost",
  "port": 5432,
  "database": "myapp",
  "ssl": false,
  "pool": {
    "min": 2,
    "max": 10
  }
}
```

### Version Configuration (Database v2 - inherits from Database component)

```json
{
  "ssl": true,
  "pool": {
    "max": 20
  }
}
```

### Product Configuration (Built from components)

```json
{
  "database": {
    "componentId": "comp_db_123",
    "versionId": "ver_db_v2_456",
    "componentName": "Database",
    "versionName": "Database_v2"
  },
  "api": {
    "componentId": "comp_api_789",
    "versionId": "comp_api_789",
    "componentName": "API",
    "versionName": "API (root)"
  }
}
```

### Instance Configuration (Production - inherits from Product)

```json
{
  "database": {
    "host": "prod-db.company.com",
    "database": "myapp_production"
  },
  "api": {
    "rate_limit": 1000
  }
}
```

### Resolved Result with Provenance

The system automatically merges configurations and tracks provenance:

```json
{
  "database": {
    "host": {
      "value": "prod-db.company.com",
      "source": "Instance: Production"
    },
    "port": {
      "value": 5432,
      "source": "Component: Database"
    },
    "ssl": {
      "value": true,
      "source": "Version: Database_v2"
    },
    "pool": {
      "min": {
        "value": 2,
        "source": "Component: Database"
      },
      "max": {
        "value": 20,
        "source": "Version: Database_v2"
      }
    }
  }
}
```

---

## Troubleshooting

### Common Issues

#### **Docker Services Won't Start**

```bash
# Check Docker is running
docker ps

# View error logs
cd server-go/deployments
docker-compose logs

# Clean restart
docker-compose down -v
docker-compose up --build
```

#### **MongoDB Connection Errors**

- Ensure MongoDB container is running: `docker ps | grep mongo`
- Check MongoDB logs: `docker-compose logs mongo`
- Verify connection string in docker-compose.yml
- Ensure port 27017 is not in use by another process

#### **Frontend Can't Connect to Backend**

- Verify backend is running: `curl http://localhost:3004/api/health`
- Check `client/vite.config.js` proxy target is set to `http://localhost:3004`
- Restart frontend dev server after changing proxy config
- Check browser console for CORS or network errors

#### **File Upload Fails**

- Check `STORAGE_TYPE` environment variable is set correctly
- For embedded storage, ensure `/data/files` volume is mounted
- For S3 storage, verify AWS credentials and bucket permissions
- Check backend logs for detailed error messages

#### **Backup/Restore Fails**

- Ensure `mongodump` and `mongorestore` are available in the container
- Check backup directory permissions
- Verify MongoDB connection is stable
- Review logs: `docker-compose logs api-go | grep backup`

#### **Permission Errors**

- Admin users can manage all configurations and users
- Regular users can only edit their own draft configurations
- Check user role in the application header
- Use admin account for system management tasks

### Performance Issues

#### **Slow Configuration Resolution**

- Check for deeply nested inheritance chains (>10 levels)
- Consider flattening configuration hierarchy
- Use committed configurations when possible (cached)

#### **High Memory Usage**

- Review log level (set to `info` or `warn` in production)
- Check for memory leaks in long-running processes
- Monitor with: `docker stats api-go`

#### **Database Performance**

- Ensure indexes are created (automatic on startup)
- Monitor MongoDB performance: `docker-compose logs mongo`
- Consider increasing MongoDB resources in docker-compose.yml

### Getting Help

1. **Check Logs**: Always start with `docker-compose logs -f`
2. **Health Check**: Verify backend health at `/api/health`
3. **User Manual**: Access via Help button in the application
4. **Admin Settings**: Use Settings panel for backup/restore and diagnostics

---

## Security Considerations

### Production Deployment

1. **Change Default Credentials**:
   - Change admin password immediately after first login
   - Update `JWT_SECRET` to a strong random value
   - Update `API_KEY` to a strong random value

2. **Use Environment Variables**:
   - Never commit secrets to version control
   - Use Docker secrets or environment variable injection
   - Consider using a secrets management service

3. **Enable HTTPS**:
   - Use a reverse proxy (nginx, Traefik) with SSL/TLS
   - Update `SERVER_BASE_URL` to use `https://`
   - Configure proper CORS settings

4. **Database Security**:
   - Use MongoDB authentication in production
   - Restrict MongoDB network access
   - Enable MongoDB encryption at rest

5. **File Storage**:
   - For S3, use IAM roles instead of access keys when possible
   - Restrict S3 bucket permissions
   - Enable S3 encryption

6. **Network Security**:
   - Use Docker networks to isolate services
   - Restrict port exposure (only expose necessary ports)
   - Use firewall rules to limit access

---

## Performance Tips

1. **Use Components**: Create reusable components instead of duplicating configuration data
2. **Commit Configurations**: Commit stable configurations to make them read-only and improve performance
3. **Regular Cleanup**: Remove unused configurations and versions
4. **Backup Regularly**: Use the backup functionality before major changes
5. **Monitor Logs**: Set appropriate log level (`info` or `warn` in production)
6. **Database Indexes**: Automatically created, but monitor query performance
7. **Use S3 for Large Files**: For production deployments with many files, use S3 storage

---

## Default Credentials

- **Username**: `admin`
- **Password**: `admin123`
- **Role**: Admin

**⚠️ IMPORTANT**: Change the default admin password immediately after first login, especially in production environments!

---

## License

MIT License





