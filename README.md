# Configuration Manager

A comprehensive layered configuration management system with deep merge capabilities, provenance tracking, and hierarchical inheritance.

## Features

### Core Functionality

- **Layered Inheritance**: Configurations inherit from parent configurations with deep merge support
- **Provenance Tracking**: Track which configuration level provides each specific value
- **Schema Enforcement**: Only Product configurations can define new properties; Instance and User configs can only override existing ones
- **Immutable Committed Configs**: Once committed, User configurations become read-only
- **Unique Naming**: All configurations must have unique names across the system

### Configuration Types

- **Product**: Top-level configurations that define the base schema and properties
- **Instance**: Override configurations for specific environments or instances
- **User**: Personal configurations for individual users, can be Draft or Committed

### User Interface

- **Tree Navigation**: Browse configurations in a hierarchical tree structure
- **JSON Viewer with Provenance**: Hover over any value to see which configuration provided it
- **Configuration Editor**: Create and edit configurations with JSON validation
- **Role-based Access**: Admin and User roles with appropriate permissions

## Technology Stack

### Backend

- **Node.js** with Express.js
- **PostgreSQL** with JSONB for configuration data storage
- **JWT** authentication
- **Deep merge** algorithm with provenance tracking

### Frontend

- **React** with Vite
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API communication

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+ (or use Docker)

### Quick Start

1. **Install Dependencies**

   ```bash
   npm run install:all
   ```

2. **Set up Database**
   - Create a PostgreSQL database named `config_manager`
   - Update the `DATABASE_URL` in `server/.env` if needed
   - Run the initialization script:

   ```bash
   cd server
   psql -d config_manager -f models/init.sql
   ```

3. **Start the Application**
   ```bash
   npm run dev
   ```

This will start both the backend (port 3001) and frontend (port 5173).

### Demo Credentials

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
- `GET /api/configs/:id/data?path=x.y.z` - Get specific path value
- `POST /api/configs/:id/commit` - Commit user configuration
- `GET /api/configs/:id/children` - Get child configurations

### Users

- `GET /api/users` - List users (admin only)
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id/role` - Update user role (admin only)

## Configuration Examples

### Product Configuration

```json
{
  "system": {
    "logging": {
      "level": "INFO",
      "retention_days": 30
    },
    "api_keys": ["key1", "key2"]
  },
  "feature_flags": {
    "new_ui": false,
    "beta_feature": false
  }
}
```

### Instance Configuration (inherits from Product)

```json
{
  "system": {
    "logging": {
      "level": "DEBUG"
    }
  },
  "feature_flags": {
    "new_ui": true
  }
}
```

### User Configuration (inherits from Instance)

```json
{
  "system": {
    "logging": {
      "retention_days": 7
    }
  }
}
```

### Resolved Result

The final merged configuration would be:

```json
{
  "system": {
    "logging": {
      "level": "DEBUG", // from Instance
      "retention_days": 7 // from User
    },
    "api_keys": ["key1", "key2"] // from Product
  },
  "feature_flags": {
    "new_ui": true, // from Instance
    "beta_feature": false // from Product
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
