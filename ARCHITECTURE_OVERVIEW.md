# Configuration Manager - Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  React Frontend (Port 5173)                                    │
│  ┌─────────────┬─────────────┬─────────────┬─────────────────┐  │
│  │   Pages     │ Components  │   Context   │    Services     │  │
│  │             │             │             │                 │  │
│  │ Dashboard   │ ConfigTree  │ AuthContext │ API Service     │  │
│  │ Login       │ JSONViewer  │ ThemeContext│ HTTP Client     │  │
│  │             │ Settings    │ ToastContext│ (Axios)         │  │
│  │             │ FileManager │             │                 │  │
│  └─────────────┴─────────────┴─────────────┴─────────────────┘  │
│                                                                 │
│  UI Features:                                                   │
│  • Dark/Light Theme • Drag & Drop • Real-time Editing          │
│  • Provenance Tooltips • Component Selection • File Upload     │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                HTTP/JSON
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                       API LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  Express.js Server (Port 3002)                                 │
│  ┌─────────────┬─────────────┬─────────────┬─────────────────┐  │
│  │   Routes    │ Middleware  │  Services   │    Models       │  │
│  │             │             │             │                 │  │
│  │ /auth       │ JWT Auth    │ ConfigSvc   │ Configuration   │  │
│  │ /configs    │ CORS        │ FileSvc     │ User            │  │
│  │ /users      │ Validation  │ Migration   │ Dynamic Loader  │  │
│  │ /files      │ Permissions │ Backup      │                 │  │
│  │ /settings   │ Error       │             │                 │  │
│  └───���─────────┴─────────────┴─────────────┴─────────────────┘  │
│                                                                 │
│  API Features:                                                  │
│  • RESTful Endpoints • JWT + API Key Auth • Role-based Access  │
│  • Input Validation • Deep Merge Algorithm • Provenance Track  │
└─────────────────────────────────────────────────────────────────┘
                                    │
                            Database Abstraction
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│  Dual Database Support                                          │
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │      SQLite         │    │         MongoDB                 │ │
│  │  ┌───────────────┐  │    │  ┌─────────────┬─────────────┐  │ │
│  │  │ config_mgr.db │  │    │  │  Embedded   │  External   │  │ │
│  │  │               │  │    │  │  (Memory)   │ (Production)│  │ │
│  │  │ • users       │  │    │  │             │             │  │ │
│  │  │ • configs     │  │    │  │ Memory      │ Network     │  │ │
│  │  └───────────────┘  │    │  │ Server      │ Connection  │  │ │
│  │                     │    │  └─────────────┴─────────────┘  │ │
│  │ File-based          │    │  Document-based                 │ │
│  │ Development         │    │  Production Ready               │ │
│  └────���────────────────┘    └─────────────────────────────────┘ │
│                                                                 │
│  Migration Features:                                            │
│  • Seamless SQLite ↔ MongoDB • Automatic Backup • Data Verify │
└─────────────────────────────────────────────────────────────────┘
                                    │
                              File Storage
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                    STORAGE LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  File Storage Options                                           │
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   Embedded Storage  │    │        AWS S3 Storage          │ │
│  │                     │    │                                 │ │
│  │ server/storage/     │    │ ┌─────────────────────────────┐ │ │
│  │ ├── files/          │    │ │ Bucket: your-bucket-name    │ │ │
│  │ │   ├── file1.pdf   │    │ │                             │ │ │
│  │ │   ├── file1.meta  │    │ │ • Presigned URLs            │ │ │
│  │ │   ├── file2.jpg   │    │ │ • CDN Distribution          │ │ │
│  │ │   └── file2.meta  │    │ │ • Encryption at Rest        │ │ │
│  │ └── metadata.json   │    │ │ • Cross-Region Replication  │ │ │
│  │                     │    │ └─────────────────────────────┘ │ │
│  │ Local Filesystem    │    │ Cloud Object Storage            │ │
│  │ Zero Configuration  │    │ Enterprise Scale                │ │
│  └─────────────────────┘    └─────────────────────────────────┘ │
│                                                                 │
│  File Features:                                                 │
│  • Upload/Download • Metadata Tracking • URL Generation        │
│  • MIME Type Support • Size Limits • Security Validation      │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration Inheritance Flow

```
Configuration Resolution Process:

1. Base Component
   ┌─────────────────┐
   │   COMPONENT     │ ← Base configuration with default values
   │   "Display"     │
   │                 │
   │ screen: {       │
   │   resolution: { │
   │     width: 454, │
   │     height: 454 │
   │   },            │
   │   brightness: { │
   │     max: 100,   │
   │     default: 75 │
   │   }             │
   │ }               │
   └─────────────────┘
           │
           ▼ (inherits from)
   ┌─────────────────┐
   │    VERSION      │ ← Enhanced version with modifications
   │  "Display v2"   │
   │                 │
   │ screen: {       │
   │   brightness: { │
   │     max: 120,   │ ← Override: increased max brightness
   │     outdoor: 90 │ ← Addition: new outdoor setting
   │   },            │
   │   colorDepth:   │ ← Addition: new property
   │     "24bit"     │
   │ }               │
   └─────────────────┘
           │
           ▼ (references in)
   ┌─────────────────┐
   │    PRODUCT      │ ← Product configuration using components
   │ "FitnessWatch   │
   │     Pro"        │
   │                 │
   │ Display: {      │
   │   componentId:  │ ← Reference to Display component
   │     "comp_123", │
   │   versionId:    │ ← Reference to Display v2 version
   │     "ver_456"   │
   │ },              │
   │ Sensors: { ... }│ ← Other component references
   │ }               │
   └─────────────────┘
           │
           ▼ (inherits from)
   ┌───���─────────────┐
   │   INSTANCE      │ ← Environment-specific configuration
   │  "Production"   │
   │                 │
   │ Display: {      │
   │   screen: {     │
   │     brightness: │
   │       default:  │ ← Override: production brightness
   │         85      │
   │   }             │
   │ }               │
   └─────────────────┘
           │
           ▼ (inherits from)
   ┌─────────────────┐
   │     USER        │ ← Personal user overrides
   │  "user_config"  │
   │                 │
   │ Display: {      │
   │   screen: {     │
   │     brightness: │
   │       default:  │ ← Override: personal preference
   │         70      │
   │   }             │
   │ }               │
   └─────────────────┘

Final Resolved Configuration:
{
  Display: {
    screen: {
      resolution: {
        width: 454,        ← From: Component
        height: 454        ← From: Component
      },
      brightness: {
        max: 120,          ← From: Version (override)
        default: 70,       ← From: User (override)
        outdoor: 90        ← From: Version (addition)
      },
      colorDepth: "24bit"  ← From: Version (addition)
    }
  }
}
```

## Deep Merge Algorithm

```
Deep Merge with Provenance Tracking:

Input Configurations (in inheritance order):
┌─────────────────────────────────────────────────────────────────┐
│ 1. Component    2. Version     3. Product     4. Instance       │
│ {               {              {              {                 │
│   screen: {       screen: {      <reference    screen: {        │
│     width: 454,     brightness:    to comp>      brightness: {  │
│     height: 454,      max: 120,                    default: 85  │
│     brightness: {     outdoor: 90                }             │
│       max: 100,     }                           }              │
│       default: 75 }                                            │
│   }             }                                              │
│ }               }                              }              │
└───────────────────────────────────────────────────────────────��─┘

Deep Merge Process:
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Start with Component (base)                             │
│ {                                                               │
│   screen: {                                                     │
│     width: { value: 454, source: "Component" },                │
│     height: { value: 454, source: "Component" },               │
│     brightness: {                                               │
│       max: { value: 100, source: "Component" },                │
│       default: { value: 75, source: "Component" }              │
│     }                                                           │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Merge Version (recursive property merge)                │
│ {                                                               │
│   screen: {                                                     │
│     width: { value: 454, source: "Component" },                │
│     height: { value: 454, source: "Component" },               │
│     brightness: {                                               │
│       max: { value: 120, source: "Version" },      ← Override  │
│       default: { value: 75, source: "Component" },             │
│       outdoor: { value: 90, source: "Version" }    ← Addition  │
│     }                                                           │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Merge Instance (final override)                         │
│ {                                                               │
│   screen: {                                                     │
│     width: { value: 454, source: "Component" },                │
│     height: { value: 454, source: "Component" },               │
│     brightness: {                                               │
│       max: { value: 120, source: "Version" },                  │
│       default: { value: 85, source: "Instance" },  ← Override  │
│       outdoor: { value: 90, source: "Version" }                │
│     }                                                           │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

Merge Rules:
• Objects: Recursive merge (combine properties)
• Arrays: Replace entirely (no merge)
• Primitives: Override (last wins)
• null/undefined: Remove property
• Provenance: Track source of each value
```

## Authentication & Authorization Flow

```
Authentication Flow:

1. Login Request
   ┌─────────────┐    POST /api/auth/login     ┌─────────────┐
   │   Client    │ ────────────────────────────▶│   Server    │
   │             │   {username, password}       │             │
   └─────────────┘                              └─────────────┘
                                                       │
                                                       ▼
                                                ┌─────────────┐
                                                │  Validate   │
                                                │ Credentials │
                                                │ (bcrypt)    │
                                                └─────────────┘
                                                       │
                                                       ▼
   ┌─────────────┐    JWT Token + User Info    ┌─────────────┐
   │   Client    │ ◀────────────────────────────│   Server    │
   │             │   {token, user}              │             │
   └───��─────────┘                              └─────────────┘

2. Authenticated Request
   ┌─────────────┐    API Request + JWT        ┌─────────────┐
   │   Client    │ ────────────────────────────▶│   Server    │
   │             │   Authorization: Bearer     │             │
   └─────────────┘                              └─────────────┘
                                                       │
                                                       ▼
                                                ┌─────────────┐
                                                │   Verify    │
                                                │    JWT      │
                                                │   Extract   │
                                                │   User      │
                                                └─────────────┘
                                                       │
                                                       ▼
                                                ┌���────────────┐
                                                │   Check     │
                                                │ Permissions │
                                                │  (Role +    │
                                                │ Ownership)  │
                                                └─────────────┘

Authorization Matrix:
┌──────────────┬─────────┬──────────┬─────────────────────────────┐
│ Resource     │ Admin   │ User     │ Notes                       │
├──────────────┼─────────┼──────────┼─────────────────────────────┤
│ PRODUCT      │ CRUD    │ Read     │ Admin manages products      │
│ INSTANCE     │ CRUD    │ Read     │ Admin manages instances     │
│ COMPONENT    │ CRUD    │ Read     │ Admin manages components    │
│ VERSION      │ CRUD    │ Own CRUD │ Users can version own comps │
│ USER Config  │ CRUD    │ Own CRUD │ Users manage own configs    │
│ User Mgmt    │ CRUD    │ Self R   │ Admin manages all users     │
│ Settings     │ CRUD    │ None     │ Admin-only system settings  │
│ Files        │ CRUD    │ Own CRUD │ Users manage own files      │
└──────────────┴─────────┴──────────┴─────────────────────────────┘
```

## Deployment Architecture

```
Development Deployment:
┌─────────────────────────────────────────────────────────────────┐
│ Development Environment (Single Machine)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────┐    ┌─────────────┐    ┌──────────────────────┐  │
│ │   Vite      │    │ Express.js  │    │   Embedded MongoDB   │  │
│ │ Dev Server  │    │   Server    │    │   (Memory Server)    │  │
│ │             │    │             │    │                      │  │
│ │ Port: 5173  │    │ Port: 3002  │    │ Port: 27017          │  │
│ │             │    │             │    │ Data: In Memory      │  │
│ │ Hot Reload  │    │ nodemon     │    │ Zero Config          │  │
│ └─────────────┘    └─────────────┘    └──────────────────────┘  │
│                                                                 │
│ File Storage: ./server/storage/files/                           │
│ Database: Embedded MongoDB (auto-start)                        │
│ Command: npm run dev                                            │
└─────────────────────────────────────────────────────────────────┘

Production Deployment:
┌─────────────────────────────────────────────────────────────────┐
│ Production Environment (Distributed)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│ │   Web Server    │  │  Application    │  │    Database     │  │
│ │                 │  │     Server      │  │                 │  │
│ │ nginx/Apache    │  │                 │  │   MongoDB       │  │
│ │ Static Files    │  │ Express.js      │  │   Replica Set   │  │
│ │ SSL/TLS         │  │ PM2/Forever     │  │   Sharding      │  │
│ │ Load Balancer   │  │ Port: 3002      │  │   Port: 27017   │  │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│ ┌─────────────────┐  ┌────────────────���┐  ┌─────────────────┐  │
│ │   File Storage  │  │    Monitoring   │  │     Backup      │  │
│ │                 │  │                 │  │                 │  │
│ │ AWS S3 Bucket   │  │ Logs/Metrics    │  │ Automated       │  │
│ │ CDN (CloudFront)│  │ Health Checks   │  │ Database Dumps  │  │
│ │ Presigned URLs  │  │ Error Tracking  │  │ File Backups    │  │
│ │ Cross-Region    │  │ Performance     │  │ Point-in-Time   │  │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack Detail

```
Frontend Technology Stack:
┌─────────────────────────────────────────────────────────────────┐
│ Framework: React 18.2.0                                        │
│ ├── Build Tool: Vite 5.0.8 (fast development & building)       │
│ ├── Routing: React Router 6.8.0 (SPA navigation)               │
│ ├── HTTP Client: Axios 1.6.2 (API communication)               │
│ ├── Styling: Tailwind CSS 3.3.0 (utility-first CSS)           │
│ ├── Icons: Heroicons React 2.0.18 (consistent iconography)     │
│ ├── State: React Context (auth, theme, notifications)          │
│ ├── JSON Editor: react-json-editor-ajrm 2.5.14                 │
│ └── Tooltips: react-tooltip 5.24.0                             │
└─────────────────────────────────────────────────────────────────┘

Backend Technology Stack:
┌─────────────────────────────────────────────────────────────────┐
│ Runtime: Node.js 18+ with Express.js 4.18.2                    │
│ ├── Database: Dual Support                                     │
│ │   ├── SQLite: sqlite3 5.1.7 (development)                   │
│ │   └── MongoDB: mongoose 8.8.4 (production)                  │
│ ├── Authentication: jsonwebtoken 9.0.2 + bcryptjs 2.4.3       │
│ ├── Validation: joi 17.11.0 (schema validation)                │
│ ├── Security: helmet 7.1.0 + cors 2.8.5                       │
│ ├── File Storage: multer 2.0.2 + AWS SDK 3.876.0              │
│ ├── Utils: lodash 4.17.21 + uuid 9.0.1                        │
│ └── Dev Tools: nodemon 3.0.2 + jest 29.7.0                    │
└─────────────────────────────────────────────────────────────────┘

Database Technology Details:
┌─────────────────────────────────────────────────────────────────┐
│ SQLite Configuration:                                           │
│ ├── File: server/config_manager.db                             │
│ ├── Tables: users, configurations                              │
│ ├── Features: ACID, Foreign Keys, JSON storage                 │
│ └── Use Case: Development, small deployments                   │
│                                                                 │
│ MongoDB Configuration:                                          │
│ ├── Embedded: mongodb-memory-server 10.2.0                     │
│ ├── External: Standard MongoDB connection                      │
│ ├── Collections: users, configurations                         │
│ ├── Features: Document store, indexing, aggregation            │
│ └── Use Case: Production, scalable deployments                 │
└─────────────────────────────────────────────────────────────────┘
```

This architecture overview provides a comprehensive view of the system's structure, data flow, and technology stack, making it easier to understand the system's design and implementation choices.
