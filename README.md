# Configuration Manager

A comprehensive component-based configuration management system with deep merge capabilities, provenance tracking, and hierarchical inheritance. Features embedded MongoDB for zero-configuration database setup.

## Features

### Core Functionality

- **Component-Version Architecture**: Reusable configuration components with versioning support
- **Layered Inheritance**: Configurations inherit from parent configurations with deep merge support
- **Provenance Tracking**: Track which configuration level provides each specific value
- **Immutable Committed Configs**: Once committed, configurations become read-only
- **Embedded Database**: No external database setup required - uses embedded MongoDB

### Configuration Types

- **Component**: Reusable configuration modules (e.g., database settings, API configurations)
- **Version**: Specific versions of components with modifications or updates
- **Product**: Top-level configurations built from components
- **Instance**: Environment-specific deployments of products (staging, production)
- **User**: Personal configurations for individual users, can be Draft or Committed

### Database Options

- **Embedded MongoDB** (Default): Zero-configuration, starts automatically with the application
- **External MongoDB**: Connect to your own MongoDB server for production deployments
- **SQLite**: Legacy support with migration tools available

### User Interface

- **Tree Navigation**: Browse configurations in a hierarchical tree structure
- **JSON Viewer with Provenance**: Hover over any value to see which configuration provided it
- **Component Selector**: Easy component selection and version management for products
- **Admin Settings Panel**: Configure MongoDB connections and migrate data
- **Role-based Access**: Admin and User roles with appropriate permissions

## Technology Stack

### Backend

- **Node.js** with Express.js
- **Embedded MongoDB** with automatic startup (mongodb-memory-server)
- **Mongoose** for MongoDB object modeling
- **JWT** authentication
- **Deep merge** algorithm with provenance tracking

### Frontend

- **React** with Vite
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API communication

## Getting Started

### Prerequisites

- **Node.js 18+** and npm
- **No external database required** - uses embedded MongoDB

### Quick Start with Embedded MongoDB

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Start the Application**
   ```bash
   npm run dev
   ```

That's it! The embedded MongoDB will start automatically and the application will be ready to use.

This will start:
- **Backend** on port 3002 with embedded MongoDB
- **Frontend** on port 5173

### First-Time Setup

When you first start the application:

1. **Access the application** at `http://localhost:5173`
2. **Login with default admin credentials**:
   - Username: `admin`
   - Password: `admin123`
3. **The embedded MongoDB** starts automatically - no configuration needed

### Advanced Setup Options

#### Option 1: Migrate from Existing SQLite Data

If you have existing SQLite data:

1. **Start with SQLite** (default on first run)
2. **Login as admin** and go to Settings
3. **Click "Migrate to Embedded MongoDB"**
4. **Restart the application** - it will now use MongoDB

#### Option 2: Use External MongoDB

For production or if you prefer external MongoDB:

1. **Setup your MongoDB server**
2. **Login as admin** and go to Settings
3. **Enter your MongoDB connection string**
4. **Test the connection** and migrate data
5. **Restart the application**

### Environment Configuration

Create `server/.env` file for custom settings:

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

### Default Credentials

- **Username**: `admin`
- **Password**: `admin123`
- **Role**: Admin

## API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

### Configurations

- `GET /api/configs` - List all configurations
- `POST /api/configs` - Create new configuration
- `GET /api/configs/:id` - Get resolved configuration (with provenance)
- `PUT /api/configs/:id` - Update configuration
- `DELETE /api/configs/:id` - Delete configuration
- `GET /api/configs/:id/data?path=x.y.z&minimal=true` - Get specific path value (minimal response)
- `POST /api/configs/:id/commit` - Commit user configuration
- `GET /api/configs/:id/children` - Get child configurations
- `GET /api/configs/components` - Get all components with versions

### Users

- `GET /api/users` - List users (admin only)
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id/role` - Update user role (admin only)

### Settings (Admin Only)

- `GET /api/settings/mongodb` - Get MongoDB settings and status
- `PUT /api/settings/mongodb` - Update MongoDB settings
- `POST /api/settings/mongodb/test` - Test MongoDB connection
- `POST /api/settings/mongodb/migrate-embedded` - Migrate to embedded MongoDB
- `POST /api/settings/mongodb/revert-to-sqlite` - Revert to SQLite with data migration

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

### User Configuration (Personal overrides)

```json
{
  "database": {
    "pool": {
      "max": 5
    }
  }
}
```

### Resolved Result

The final merged configuration would be:

```json
{
  "database": {
    "host": "prod-db.company.com", // from Instance
    "port": 5432, // from Database component
    "database": "myapp_production", // from Instance
    "ssl": true, // from Database v2 version
    "pool": {
      "min": 2, // from Database component
      "max": 5 // from User config
    }
  },
  "api": {
    "rate_limit": 1000 // from Instance
    // ... other API settings from component
  }
}
```

## Architecture

### Database Schema

- `users` table for authentication and authorization
- `configurations` table with JSONB data column and inheritance relationships
- Recursive queries for inheritance chain resolution

### Deep Merge Algorithm

- Recursive merging of nested objects
- Array replacement (not merging)
- Provenance tracking for each value
- Support for null values and type changes

### Permission Model

- **Admin**: Can create/edit Product and Instance configurations, manage users
- **User**: Can create/edit their own Draft User configurations

## Development

### Project Structure

```
├── server/                 # Backend API
│   ├── models/            # Database models and schema
│   ├── services/          # Business logic (ConfigurationService)
│   ├── routes/            # API routes
│   └── middleware/        # Authentication middleware
├── client/                # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React context (auth)
│   │   └── services/      # API service layer
└── README.md
```

### Key Components

- **ConfigurationService**: Handles deep merge and provenance logic
- **ConfigurationTree**: Tree navigation component
- **JSONViewer**: JSON display with hover provenance
- **ConfigurationEditor**: Create/edit modal with validation

## License

MIT License
