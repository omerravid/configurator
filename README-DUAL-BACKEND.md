# Configuration Manager

A comprehensive component-based configuration management system with deep merge capabilities, provenance tracking, and hierarchical inheritance.

## 🎯 Backend Options

This repository contains **two backend implementations**:

1. **Node.js Backend** (`server/`) - Original implementation with embedded MongoDB
2. **Go Backend** (`server-go/`) - New high-performance implementation with Docker

**Choose the backend that best fits your needs:**

| Feature | Node.js Backend | Go Backend |
|---------|----------------|------------|
| **Setup Complexity** | Simple (npm install) | Requires Docker |
| **Database** | Embedded MongoDB (zero-config) or External | MongoDB via Docker |
| **Performance** | Good | Excellent |
| **Type Safety** | JavaScript | Go (strongly typed) |
| **Production Ready** | ✅ Yes | ✅ Yes |
| **Backup/Restore** | File-based | mongodump/mongorestore |
| **File Storage** | Local filesystem | Local + AWS S3 |

---

## Features

### Core Functionality

- **Component-Version Architecture**: Reusable configuration components with versioning support
- **Layered Inheritance**: Configurations inherit from parent configurations with deep merge support
- **Provenance Tracking**: Track which configuration level provides each specific value
- **Immutable Committed Configs**: Once committed, configurations become read-only
- **Rules & Validation**: Define validation rules for configuration properties with inheritance

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

---

## 🚀 Quick Start

### Option A: Node.js Backend (Recommended for Quick Start)

#### Prerequisites
- **Node.js 18+** and npm
- **No external database required** - uses embedded MongoDB

#### Installation

1. **Install Dependencies**

   ```bash
   # Install root dependencies
   npm install

   # Install server dependencies
   cd server
   npm install
   cd ..

   # Install client dependencies
   cd client
   npm install
   cd ..
   ```

2. **Start the Application**
   ```bash
   npm run dev
   ```

This will start:
- **Backend** on port 3002 with embedded MongoDB
- **Frontend** on port 5173

#### First-Time Setup

1. **Access the application** at `http://localhost:5173`
2. **Login with default admin credentials**:
   - Username: `admin`
   - Password: `admin123`
3. **The embedded MongoDB** starts automatically - no configuration needed

---

### Option B: Go Backend (Recommended for Production)

#### Prerequisites
- **Docker** and Docker Compose
- **Node.js 18+** and npm (for frontend only)

#### Installation

1. **Install Frontend Dependencies**

   ```bash
   cd client
   npm install
   cd ..
   ```

2. **Configure Frontend for Go Backend**

   Edit `client/vite.config.js` and ensure the proxy target is set to port 3004:

   ```javascript
   export default defineConfig({
     // ... other config
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

3. **Start the Go Backend**

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

#### First-Time Setup

1. **Access the application** at `http://localhost:5173`
2. **Login with default admin credentials**:
   - Username: `admin`
   - Password: `admin123`
3. **MongoDB and Go backend** start via Docker

---

## 🔄 Switching Between Backends

To switch between Node.js and Go backends:

### Switch to Node.js Backend (Port 3002)

1. **Stop Go backend** (if running):
   ```bash
   cd server-go/deployments
   docker-compose down
   ```

2. **Update frontend proxy** in `client/vite.config.js`:
   ```javascript
   target: 'http://localhost:3002',  // Node backend
   ```

3. **Restart frontend dev server**:
   ```bash
   cd client
   # Press Ctrl+C to stop, then:
   npm run dev
   ```

4. **Start Node backend** (if not running):
   ```bash
   cd server
   npm run dev
   ```

### Switch to Go Backend (Port 3004)

1. **Stop Node backend** (if running): Press `Ctrl+C`

2. **Update frontend proxy** in `client/vite.config.js`:
   ```javascript
   target: 'http://localhost:3004',  // Go backend
   ```

3. **Restart frontend dev server**:
   ```bash
   cd client
   # Press Ctrl+C to stop, then:
   npm run dev
   ```

4. **Start Go backend** (if not running):
   ```bash
   cd server-go/deployments
   docker-compose up --build
   ```

---

## Technology Stack

### Backend - Node.js (`server/`)

- **Node.js** with Express.js
- **Embedded MongoDB** with automatic startup (mongodb-memory-server)
- **Mongoose** for MongoDB object modeling
- **JWT** authentication
- **Deep merge** algorithm with provenance tracking

### Backend - Go (`server-go/`)

- **Go 1.21+** with Gin framework
- **MongoDB** (official driver `go.mongodb.org/mongo-driver`)
- **JWT** authentication (`golang-jwt/jwt/v5`)
- **Structured Logging** with Zap
- **File Storage**: Local filesystem + AWS S3 support
- **Backup/Restore**: mongodump/mongorestore integration
- **Docker**: Containerized deployment

### Frontend (`client/`)

- **React** with Vite
- **Tailwind CSS** for styling with dark mode support
- **React Router** for navigation
- **Axios** for API communication
- **Theme Context** for persistent dark/light mode switching

---

## Environment Configuration

### Node.js Backend (`server/.env`)

```bash
# Database type (true = MongoDB, false = SQLite)
USE_MONGODB=true

# MongoDB connection (only used if USE_MONGODB=true)
MONGODB_URI=mongodb://localhost:27017/config_manager

# Server settings
PORT=3002
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

### Go Backend (`server-go/deployments/docker-compose.yml`)

```yaml
environment:
  - SERVER_PORT=3004
  - MONGODB_URI=mongodb://mongo:27017
  - MONGO_DB_NAME=config_manager
  - JWT_SECRET=change-me-in-production
  - API_KEY=change-me-in-production
  - STORAGE_TYPE=embedded  # or 's3'
  - EMBEDDED_STORAGE_PATH=/data/files
  - SERVER_BASE_URL=http://localhost:3004
  - LOG_LEVEL=info  # debug, info, warn, error
  
  # For S3 storage (optional)
  # - STORAGE_TYPE=s3
  # - AWS_REGION=us-east-1
  # - AWS_S3_BUCKET=my-config-files
  # - AWS_ACCESS_KEY_ID=...
  # - AWS_SECRET_ACCESS_KEY=...
```

---

## API Endpoints

Both backends implement the same REST API:

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh JWT token (Go only)

### Configurations
- `GET /api/configs` - List all configurations
- `POST /api/configs` - Create new configuration
- `GET /api/configs/:id` - Get resolved configuration (with provenance)
- `GET /api/configs/:id/data?path=x.y.z&minimal=true` - Get specific path value
- `PUT /api/configs/:id` - Update configuration
- `POST /api/configs/:id/commit` - Commit user configuration
- `POST /api/configs/:id/archive` - Archive configuration
- `POST /api/configs/:id/restore` - Restore archived configuration
- `PUT /api/configs/:id/rename` - Rename configuration
- `GET /api/configs/:id/children` - Get child configurations
- `GET /api/configs/components` - Get all components with versions
- `GET /api/configs/by-name/:name/data` - Get configuration by name

### Rules (Go backend only)
- `GET /api/rules?configurationId=...` - List rules for configuration
- `POST /api/rules` - Create validation rule
- `GET /api/rules/:id` - Get rule details
- `PUT /api/rules/:id` - Update rule
- `DELETE /api/rules/:id` - Delete rule
- `POST /api/rules/validate` - Validate value against rules
- `GET /api/rules/configuration/:configId/path/:path` - Get rules for specific path

### Files
- `POST /api/files/upload` - Upload file
- `GET /api/files/:storageKey` - Download file
- `DELETE /api/files/:storageKey` - Delete file
- `GET /api/files` - List all files
- `POST /api/files/folder-import` - Import folder structure (Go: two-pass)

### Settings (Admin Only)
- **Node.js**: MongoDB migration and connection management
- **Go**: 
  - `POST /api/settings/data/backup` - Create backup
  - `GET /api/settings/data/backups` - List backups
  - `GET /api/settings/data/backup/:name` - Download backup
  - `POST /api/settings/data/restore` - Restore from backup
  - `POST /api/settings/data/upload-restore` - Upload and restore backup
  - `DELETE /api/settings/data/backup/:name` - Delete backup
  - `GET /api/settings/data/status` - Get database statistics
  - `GET /api/settings/storage` - Get storage status

### Users
- `GET /api/users` - List users (admin only)
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id/role` - Update user role (admin only)
- `PUT /api/users/:id` - Update user (Go only)
- `DELETE /api/users/:id` - Delete user (Go only)

---

## Development

### Project Structure

```
├── server/                 # Node.js Backend
│   ├── models/            # Database models (SQLite + MongoDB)
│   ├── services/          # Business logic
│   ├── routes/            # API routes
│   └── middleware/        # Authentication middleware
│
├── server-go/             # Go Backend
│   ├── cmd/server/        # Application entrypoint
│   ├── internal/
│   │   ├── auth/          # JWT generation
│   │   ├── backup/        # Backup/restore service
│   │   ├── config/        # Configuration loader
│   │   ├── configs/       # Configuration resolution
│   │   ├── files/         # File storage (local + S3)
│   │   ├── http/
│   │   │   ├── handlers/  # Route handlers
│   │   │   ├── middleware/# Auth & logging middleware
│   │   │   └── router.go  # Route registration
│   │   ├── logger/        # Structured logging (Zap)
│   │   ├── mongo/         # MongoDB client
│   │   ├── rules/         # Rules validation
│   │   └── types/         # DTOs and models
│   ├── build/
│   │   └── Dockerfile     # Multi-stage build
│   └── deployments/
│       └── docker-compose.yml
│
├── client/                # React Frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React context (auth, toast, theme)
│   │   └── services/      # API service layer
│   └── vite.config.js     # Frontend build config (set backend port here)
│
└── USER_MANUAL.md         # Comprehensive user guide
```

### Development Scripts

#### Node.js Backend
```bash
# Start development server (embedded MongoDB)
npm run dev

# Server-only development
cd server && npm run dev

# Test MongoDB functionality
cd server && npm run test-mongodb

# Create data backup
cd server && node backup-restore.js backup
```

#### Go Backend
```bash
# Start with Docker Compose
cd server-go/deployments
docker-compose up --build

# View logs
docker-compose logs -f api-go

# Stop services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v

# Run tests
cd server-go
go test ./...

# Build locally (without Docker)
cd server-go
go build -o bin/server cmd/server/main.go
```

#### Frontend
```bash
# Start development server
cd client
npm run dev

# Build for production
cd client
npm run build

# Preview production build
cd client
npm run preview
```

---

## Backup & Restore

### Node.js Backend
- Uses file-based backup system
- Accessible via Settings → Backup & Restore in the UI
- Command line: `cd server && node backup-restore.js backup <name>`

### Go Backend
- Uses MongoDB's native `mongodump`/`mongorestore` tools
- Binary `.archive` format with gzip compression
- Accessible via Settings → Backup & Restore in the UI
- Automatic pre-restore backup creation
- Supports upload and restore from file

**Note**: Backups are not compatible between Node.js and Go backends due to different formats.

---

## Migration Between Backends

### From Node.js to Go

1. **Create a backup** in Node.js backend (Settings → Backup & Restore)
2. **Export data** to JSON format (if needed for manual migration)
3. **Start Go backend** with fresh database
4. **Manually recreate** configurations or use import functionality
5. **Update frontend** proxy to port 3004

**Note**: Automated migration tool is not currently available. Plan for manual data recreation or export/import workflow.

### From Go to Node.js

1. **Create a backup** in Go backend (Settings → Backup & Restore → Download)
2. **Start Node.js backend** with fresh database
3. **Manually recreate** configurations
4. **Update frontend** proxy to port 3002

---

## Troubleshooting

### Common Issues

#### **Port Conflicts**
- Node.js backend: port 3002 (configurable via `PORT` env var)
- Go backend: port 3004 (configurable via `SERVER_PORT` env var)
- Frontend: port 5173
- MongoDB: port 27017
- Ensure these ports are available

#### **Frontend Shows 404 or Connection Errors**
- Check `client/vite.config.js` proxy target matches running backend port
- Restart frontend dev server after changing proxy configuration
- Verify backend is running: `curl http://localhost:3002/api/health` or `http://localhost:3004/api/health`

#### **Go Backend Won't Start**
- Ensure Docker and Docker Compose are installed
- Check Docker daemon is running
- View logs: `cd server-go/deployments && docker-compose logs -f`
- Try clean start: `docker-compose down -v && docker-compose up --build`

#### **Node.js Embedded MongoDB Won't Start**
- Ensure you have enough disk space (100MB+)
- Check Node.js version (18+ required)
- Try deleting `node_modules` and reinstalling
- Check for port conflicts on MongoDB port

#### **Permission Errors**
- Admin users can manage all configurations
- Regular users can only edit their own drafts
- Check user role in the header

### Getting Help

1. **Check the User Manual**: Access via the Help button in the application
2. **Review server logs**: 
   - Node.js: Check console output
   - Go: `cd server-go/deployments && docker-compose logs -f api-go`
3. **Admin Settings Panel**: Use the settings panel for backup/restore
4. **Check backend health**: Visit `/api/health` endpoint

---

## Performance Tips

1. **Use Components**: Create reusable components instead of duplicating configuration data
2. **Commit Configurations**: Commit stable configurations to make them read-only
3. **Regular Cleanup**: Remove unused configurations and versions
4. **Backup Regularly**: Use the backup functionality before major changes
5. **Choose Go for Scale**: For high-performance needs, use the Go backend

---

## Default Credentials

- **Username**: `admin`
- **Password**: `admin123`
- **Role**: Admin

**⚠️ Important**: Change the default admin password after first login in production environments!

---

## License

MIT License

