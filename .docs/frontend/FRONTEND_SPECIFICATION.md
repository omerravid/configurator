# Frontend Architecture & Implementation Specification

**Version**: 1.0.0  
**Date**: November 26, 2025  
**Status**: Draft  
**Based On**: FRONTEND_IMPROVEMENTS.md

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Specifications](#architecture-specifications)
3. [Security Implementation Spec](#security-implementation-spec)
4. [Component Specifications](#component-specifications)
5. [API & Data Layer Spec](#api--data-layer-spec)
6. [Performance Requirements](#performance-requirements)
7. [Accessibility Requirements](#accessibility-requirements)
8. [Testing Requirements](#testing-requirements)
9. [Build & Deployment Spec](#build--deployment-spec)
10. [Migration Plan](#migration-plan)

---

## Overview

### Purpose
This document specifies the technical architecture, implementation requirements, and standards for the Configuration Manager frontend application. It serves as the authoritative reference for development, code review, and quality assurance.

### Scope
- React SPA application (`/client/` directory)
- Component architecture and state management
- API integration layer
- Security implementation
- Performance optimization
- Accessibility compliance
- Testing strategy

### Technology Stack

#### Core
- **Framework**: React 18.2.0
- **Language**: TypeScript 5.x (migration required)
- **Build Tool**: Vite 5.x
- **Routing**: React Router v6
- **Styling**: Tailwind CSS 3.x

#### State Management
- **API State**: TanStack Query (React Query) v5
- **Global State**: React Context + useReducer
- **Form State**: React Hook Form (recommended addition)

#### Development
- **Testing**: Vitest + React Testing Library
- **Linting**: ESLint + Prettier
- **Type Checking**: TypeScript strict mode

---

## Architecture Specifications

### 1. Project Structure

```
client/
├── public/
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service worker
├── src/
│   ├── __tests__/             # Test utilities
│   ├── api/                   # API layer (new)
│   │   ├── client.ts          # Axios instance
│   │   ├── endpoints/         # API endpoint definitions
│   │   │   ├── auth.ts
│   │   │   ├── configs.ts
│   │   │   └── users.ts
│   │   └── types/             # API type definitions
│   ├── components/            # Reusable components
│   │   ├── common/            # Shared UI components
│   │   ├── config/            # Configuration-specific
│   │   ├── layout/            # Layout components
│   │   └── modals/            # Modal dialogs
│   ├── constants/             # App constants
│   │   ├── config.ts          # Config types/statuses
│   │   ├── routes.ts          # Route definitions
│   │   └── validation.ts      # Validation rules
│   ├── contexts/              # React contexts
│   │   ├── AuthContext.tsx
│   │   ├── ConfigContext.tsx  # New
│   │   ├── ThemeContext.tsx
│   │   └── ToastContext.tsx
│   ├── hooks/                 # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useConfiguration.ts
│   │   ├── useDebounce.ts
│   │   └── useKeyboardShortcuts.ts
│   ├── pages/                 # Route pages
│   │   ├── Dashboard/         # Dashboard feature
│   │   │   ├── index.tsx
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── Login.tsx
│   │   └── NotFound.tsx
│   ├── services/              # Business logic
│   │   ├── auth.service.ts
│   │   ├── config.service.ts
│   │   ├── storage.service.ts
│   │   └── websocket.service.ts
│   ├── types/                 # TypeScript types
│   │   ├── api.types.ts
│   │   ├── config.types.ts
│   │   └── user.types.ts
│   ├── utils/                 # Utility functions
│   │   ├── date.ts
│   │   ├── logger.ts
│   │   ├── validation.ts
│   │   └── format.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── .env.example               # Environment template
├── .eslintrc.cjs              # ESLint config
├── .prettierrc                # Prettier config
├── tsconfig.json              # TypeScript config
├── vite.config.ts             # Vite config
└── vitest.config.ts           # Test config
```

### 2. State Management Architecture

```typescript
// Global State Structure
interface AppState {
  auth: AuthState;
  config: ConfigState;
  ui: UIState;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}

interface ConfigState {
  selectedConfig: Configuration | null;
  configurations: Configuration[];
  expandedNodes: Set<string>;
  searchTerm: string;
}

interface UIState {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  activeModal: string | null;
}
```

**State Management Strategy**:
- **Server State**: TanStack Query (API data, caching)
- **UI State**: React Context (theme, modals, navigation)
- **Form State**: React Hook Form (forms validation)
- **Component State**: useState (local component state)

### 3. Component Architecture

#### Component Categories

1. **Page Components** (`/pages/`)
   - Top-level route components
   - Compose feature components
   - Handle page-level state

2. **Feature Components** (`/components/[feature]/`)
   - Complex, feature-specific components
   - Example: ConfigurationEditor, ConfigurationTree

3. **Common Components** (`/components/common/`)
   - Reusable UI elements
   - Example: Button, Input, Modal, Toast

4. **Layout Components** (`/components/layout/`)
   - Page structure components
   - Example: Header, Sidebar, Container

#### Component Design Principles

```typescript
// Example: Proper component structure
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  'aria-label'?: string;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  onClick,
  'aria-label': ariaLabel,
}) => {
  // Implementation
};

export default React.memo(Button);
```

**Requirements**:
- TypeScript interfaces for all props
- PropTypes or TypeScript for validation
- Memoization for expensive components
- Proper accessibility attributes
- Error boundaries for error handling

---

## Security Implementation Spec

### 1. Authentication & Authorization

#### 1.1 Token Management

**Requirements**:
- JWT tokens with expiration
- Automatic token refresh
- Secure token storage
- Token revocation support

**Implementation**:

```typescript
// services/auth.service.ts
interface TokenPayload {
  user_id: string;
  username: string;
  role: UserRole;
  exp: number;
  iat: number;
}

class AuthService {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

  static setToken(token: string): void {
    // Use secure storage (httpOnly cookie preferred)
    sessionStorage.setItem(this.TOKEN_KEY, token);
  }

  static getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  static decodeToken(token: string): TokenPayload | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch {
      return null;
    }
  }

  static isTokenExpired(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload) return true;
    return payload.exp * 1000 < Date.now();
  }

  static shouldRefreshToken(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload) return false;
    return payload.exp * 1000 - Date.now() < this.REFRESH_THRESHOLD;
  }

  static async refreshToken(): Promise<string> {
    // Implementation
  }
}
```

#### 1.2 Environment Variables

**Required Variables** (`.env.example`):

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3004
VITE_WS_URL=ws://localhost:3004

# Feature Flags
VITE_ENABLE_DEMO_CREDENTIALS=false
VITE_ENABLE_3D_PREVIEW=true
VITE_ENABLE_PWA=false

# Demo Credentials (Dev only)
VITE_DEMO_USERNAME=
VITE_DEMO_PASSWORD=

# Analytics
VITE_ANALYTICS_ENABLED=false
VITE_SENTRY_DSN=

# Build
VITE_BUILD_VERSION=${npm_package_version}
VITE_BUILD_DATE=${BUILD_DATE}
```

**Validation**:
```typescript
// utils/env.ts
const requiredEnvVars = [
  'VITE_API_BASE_URL',
] as const;

export function validateEnv(): void {
  for (const envVar of requiredEnvVars) {
    if (!import.meta.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}
```

#### 1.3 Content Security Policy

**Implementation** (`index.html`):

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https: blob:;
  font-src 'self' data:;
  connect-src 'self' ws://localhost:* http://localhost:*;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
">
```

**Note**: Adjust `unsafe-inline` and `unsafe-eval` as build process improves

### 2. Input Validation & Sanitization

#### 2.1 File Upload Validation

```typescript
// constants/validation.ts
export const ALLOWED_FILE_TYPES = {
  json: ['application/json', 'text/json'],
  image: ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'],
  document: ['application/pdf', 'text/plain'],
  archive: ['application/zip', 'application/x-zip-compressed'],
} as const;

export const MAX_FILE_SIZE = {
  json: 10 * 1024 * 1024,     // 10MB
  image: 5 * 1024 * 1024,      // 5MB
  document: 20 * 1024 * 1024,  // 20MB
  archive: 50 * 1024 * 1024,   // 50MB
} as const;

// utils/validation.ts
export function validateFile(
  file: File,
  category: keyof typeof ALLOWED_FILE_TYPES
): { valid: boolean; error?: string } {
  // Check file type
  const allowedTypes = ALLOWED_FILE_TYPES[category];
  if (!allowedTypes.includes(file.type as any)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
    };
  }

  // Check file size
  const maxSize = MAX_FILE_SIZE[category];
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Max size: ${maxSize / (1024 * 1024)}MB`,
    };
  }

  return { valid: true };
}
```

#### 2.2 XSS Prevention

```typescript
// utils/sanitize.ts
import DOMPurify from 'dompurify';

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target'],
  });
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### 3. Secure Logging

```typescript
// utils/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

class Logger {
  private static isDevelopment = import.meta.env.DEV;

  private static sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized = { ...context };
    // Remove sensitive fields
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret'];
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '***REDACTED***';
      }
    }
    return sanitized;
  }

  static debug(message: string, context?: Record<string, any>): void {
    if (!this.isDevelopment) return;
    console.debug(message, context ? this.sanitizeContext(context) : '');
  }

  static info(message: string, context?: Record<string, any>): void {
    console.info(message, context ? this.sanitizeContext(context) : '');
  }

  static warn(message: string, context?: Record<string, any>): void {
    console.warn(message, context ? this.sanitizeContext(context) : '');
  }

  static error(message: string, error?: Error, context?: Record<string, any>): void {
    console.error(message, error, context ? this.sanitizeContext(context) : '');
    // Send to error tracking service (Sentry, etc.)
  }
}

export default Logger;
```

---

## Component Specifications

### 1. Dashboard Component Breakdown

#### Current State
- Single file: 1343 lines
- Multiple responsibilities
- Difficult to maintain

#### Specified Architecture

```
Dashboard/
├── index.tsx                    # Main orchestrator (200 lines)
├── DashboardLayout.tsx          # Layout wrapper
├── components/
│   ├── DashboardHeader.tsx      # Top navigation/actions
│   ├── ConfigurationSidebar.tsx # Left sidebar with tree
│   ├── ConfigurationPanel.tsx   # Main content area
│   └── PathQueryPanel.tsx       # Bottom query panel
├── hooks/
│   ├── useConfigurationManagement.ts
│   ├── useConfigurationActions.ts
│   └── useConfigurationTree.ts
└── types.ts                     # Local types
```

#### Dashboard Component Spec

```typescript
// Dashboard/index.tsx
import { ConfigProvider } from './contexts/ConfigContext';
import { DashboardLayout } from './DashboardLayout';
import { DashboardHeader } from './components/DashboardHeader';
import { ConfigurationSidebar } from './components/ConfigurationSidebar';
import { ConfigurationPanel } from './components/ConfigurationPanel';
import { PathQueryPanel } from './components/PathQueryPanel';

const Dashboard: React.FC = () => {
  return (
    <ConfigProvider>
      <DashboardLayout>
        <DashboardHeader />
        <div className="flex flex-1 overflow-hidden">
          <ConfigurationSidebar />
          <ConfigurationPanel />
        </div>
        <PathQueryPanel />
      </DashboardLayout>
    </ConfigProvider>
  );
};

export default Dashboard;
```

#### Custom Hook Specifications

```typescript
// hooks/useConfigurationManagement.ts
interface UseConfigurationManagementReturn {
  selectedConfig: Configuration | null;
  configurations: Configuration[];
  loading: boolean;
  error: Error | null;
  selectConfig: (config: Configuration) => Promise<void>;
  refreshConfigurations: () => Promise<void>;
}

export function useConfigurationManagement(): UseConfigurationManagementReturn {
  const { data: configurations, isLoading, error, refetch } = useQuery({
    queryKey: ['configurations'],
    queryFn: configService.getAll,
  });

  const [selectedConfig, setSelectedConfig] = useState<Configuration | null>(null);

  const selectConfig = useCallback(async (config: Configuration) => {
    // Load configuration data
    // Update session storage
    // Set selected config
  }, []);

  const refreshConfigurations = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    selectedConfig,
    configurations: configurations || [],
    loading: isLoading,
    error,
    selectConfig,
    refreshConfigurations,
  };
}
```

### 2. Settings Modal Decomposition

#### Specified Architecture

```
SettingsModal/
├── index.tsx                    # Main modal (150 lines)
├── SettingsTabs.tsx             # Tab navigation
├── tabs/
│   ├── UsersSettings.tsx        # User management (300 lines)
│   ├── DatabaseSettings.tsx     # Database config (400 lines)
│   ├── BackupSettings.tsx       # Backup/restore (350 lines)
│   └── FileSystemSettings.tsx   # Storage config (250 lines)
├── hooks/
│   ├── useUserManagement.ts
│   ├── useDatabaseManagement.ts
│   └── useBackupManagement.ts
└── components/
    ├── DatabaseConnectionCard.tsx
    ├── BackupListItem.tsx
    └── UserTableRow.tsx
```

#### Settings Modal Spec

```typescript
// SettingsModal/index.tsx
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRefresh?: () => void;
  selectedConfigId?: string;
}

const TABS = [
  { id: 'users', label: 'Users', icon: UsersIcon },
  { id: 'database', label: 'Database', icon: ServerIcon },
  { id: 'backup', label: 'Backup & Restore', icon: ShieldCheckIcon },
  { id: 'filesystem', label: 'File System', icon: CloudIcon },
] as const;

type TabId = typeof TABS[number]['id'];

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onDataRefresh,
  selectedConfigId,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('users');
  const [dataChanged, setDataChanged] = useState(false);

  const handleClose = useCallback(() => {
    if (dataChanged && onDataRefresh) {
      onDataRefresh();
    }
    onClose();
  }, [dataChanged, onDataRefresh, onClose]);

  if (!isOpen) return null;

  return (
    <Modal onClose={handleClose} size="xl">
      <ModalHeader title="System Settings" onClose={handleClose} />
      <SettingsTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      <ModalBody>
        {activeTab === 'users' && <UsersSettings />}
        {activeTab === 'database' && <DatabaseSettings onDataChange={setDataChanged} />}
        {activeTab === 'backup' && <BackupSettings onDataChange={setDataChanged} />}
        {activeTab === 'filesystem' && <FileSystemSettings />}
      </ModalBody>
    </Modal>
  );
};
```

### 3. Common Component Library

#### Button Component

```typescript
// components/common/Button/Button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon: Icon,
      iconPosition = 'left',
      fullWidth = false,
      disabled,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    const variantStyles = {
      primary: 'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500',
      secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 focus:ring-gray-500',
      danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
      ghost: 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          (disabled || loading) && 'opacity-50 cursor-not-allowed',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <LoadingSpinner size="sm" />
        ) : (
          <>
            {Icon && iconPosition === 'left' && <Icon className="w-4 h-4 mr-2" />}
            {children}
            {Icon && iconPosition === 'right' && <Icon className="w-4 h-4 ml-2" />}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
```

#### Modal Component

```typescript
// components/common/Modal/Modal.tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true,
  children,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap
  useEffect(() => {
    if (isOpen) {
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4',
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={modalRef}
          className={cn(
            'relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full',
            sizeClasses[size]
          )}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              {title && (
                <div>
                  <h2 id="modal-title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                  </h2>
                  {description && (
                    <p id="modal-description" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {description}
                    </p>
                  )}
                </div>
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="Close modal"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
};
```

---

## API & Data Layer Spec

### 1. API Client Configuration

```typescript
// api/client.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { AuthService } from '@/services/auth.service';
import { Logger } from '@/utils/logger';

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
  }> = [];

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = AuthService.getToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Handle 401 with token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then(() => this.client(originalRequest))
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const newToken = await AuthService.refreshToken();
            this.processQueue(null);
            return this.client(originalRequest);
          } catch (refreshError) {
            this.processQueue(refreshError);
            AuthService.logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private processQueue(error: any): void {
    this.failedQueue.forEach((promise) => {
      if (error) {
        promise.reject(error);
      } else {
        promise.resolve();
      }
    });
    this.failedQueue = [];
  }

  public getInstance(): AxiosInstance {
    return this.client;
  }
}

export const apiClient = new ApiClient().getInstance();
```

### 2. API Endpoint Definitions

```typescript
// api/endpoints/configs.ts
import { apiClient } from '../client';
import type { Configuration, ConfigurationListResponse, ConfigurationResponse } from '@/types/api.types';

export const configsApi = {
  getAll: async (includeArchived = false): Promise<ConfigurationListResponse> => {
    const response = await apiClient.get('/configs', {
      params: { includeArchived: includeArchived.toString() },
    });
    return response.data;
  },

  getById: async (id: string, includeProvenance = false): Promise<ConfigurationResponse> => {
    const response = await apiClient.get(`/configs/${id}`, {
      params: { provenance: includeProvenance.toString() },
    });
    return response.data;
  },

  getRawById: async (id: string): Promise<ConfigurationResponse> => {
    const response = await apiClient.get(`/configs/${id}`, {
      params: { raw: 'true' },
    });
    return response.data;
  },

  create: async (data: Partial<Configuration>): Promise<ConfigurationResponse> => {
    const response = await apiClient.post('/configs', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Configuration>): Promise<ConfigurationResponse> => {
    const response = await apiClient.put(`/configs/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/configs/${id}`);
  },

  archive: async (id: string, archiveChildren = true): Promise<void> => {
    await apiClient.post(`/configs/${id}/archive`, { archiveChildren });
  },

  restore: async (id: string): Promise<void> => {
    await apiClient.post(`/configs/${id}/restore`);
  },

  commit: async (id: string): Promise<void> => {
    await apiClient.post(`/configs/${id}/commit`);
  },
};
```

### 3. React Query Integration

```typescript
// hooks/useConfigurations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configsApi } from '@/api/endpoints/configs';
import type { Configuration } from '@/types/api.types';

export const QUERY_KEYS = {
  configurations: ['configurations'] as const,
  configuration: (id: string) => ['configuration', id] as const,
  rawConfiguration: (id: string) => ['rawConfiguration', id] as const,
};

export function useConfigurations(includeArchived = false) {
  return useQuery({
    queryKey: [...QUERY_KEYS.configurations, includeArchived],
    queryFn: () => configsApi.getAll(includeArchived),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useConfiguration(id: string | undefined, includeProvenance = false) {
  return useQuery({
    queryKey: [...QUERY_KEYS.configuration(id!), includeProvenance],
    queryFn: () => configsApi.getById(id!, includeProvenance),
    enabled: !!id,
  });
}

export function useCreateConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: configsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.configurations });
    },
  });
}

export function useUpdateConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Configuration> }) =>
      configsApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.configuration(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.configurations });
    },
  });
}

export function useDeleteConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: configsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.configurations });
    },
  });
}
```

---

## Performance Requirements

### 1. Bundle Size Targets

| Metric | Target | Maximum |
|--------|--------|---------|
| Initial JS Bundle | < 200 KB | 300 KB |
| Initial CSS Bundle | < 50 KB | 80 KB |
| Total Initial Load | < 250 KB | 380 KB |
| Lazy Loaded Chunks | < 50 KB each | 100 KB each |

### 2. Performance Budgets

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@heroicons/react'],
          'query-vendor': ['@tanstack/react-query'],
          '3d-vendor': ['three'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
  // Performance hints
  build: {
    reportCompressedSize: true,
  },
});
```

### 3. Code Splitting Strategy

```typescript
// Lazy load routes
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Settings = lazy(() => import('@/pages/Settings'));

// Lazy load heavy components
const VrmlPreview = lazy(() => import('@/components/VrmlPreview'));
const ConfigurationEditor = lazy(() => import('@/components/ConfigurationEditor'));

// Lazy load modals
const SettingsModal = lazy(() => import('@/components/modals/SettingsModal'));
```

### 4. Render Optimization

```typescript
// Use React.memo for expensive components
export default React.memo(ConfigurationTree, (prevProps, nextProps) => {
  return (
    prevProps.selectedId === nextProps.selectedId &&
    prevProps.configurations === nextProps.configurations
  );
});

// Use useMemo for expensive computations
const filteredConfigs = useMemo(
  () => configurations.filter(config => 
    config.name.toLowerCase().includes(searchTerm.toLowerCase())
  ),
  [configurations, searchTerm]
);

// Use useCallback for event handlers
const handleSelect = useCallback((config: Configuration) => {
  setSelectedConfig(config);
}, []);
```

### 5. Image Optimization

```typescript
// Use modern formats
<picture>
  <source srcSet="/image.webp" type="image/webp" />
  <source srcSet="/image.jpg" type="image/jpeg" />
  <img src="/image.jpg" alt="Description" loading="lazy" />
</picture>

// Lazy load images
import { LazyLoadImage } from 'react-lazy-load-image-component';

<LazyLoadImage
  src="/large-image.jpg"
  alt="Description"
  effect="blur"
  placeholderSrc="/placeholder.jpg"
/>
```

---

## Accessibility Requirements

### 1. WCAG 2.1 Level AA Compliance

#### Required Standards

**Perceivable**:
- All non-text content has text alternatives
- Color contrast ratio of at least 4.5:1 for normal text
- Color contrast ratio of at least 3:1 for large text
- Text can be resized up to 200% without loss of functionality

**Operable**:
- All functionality available via keyboard
- No keyboard traps
- Skip navigation links provided
- Descriptive page titles
- Focus order is logical
- Link purpose clear from context

**Understandable**:
- Page language declared (`<html lang="en">`)
- Error messages are clear and helpful
- Labels and instructions provided for inputs
- Consistent navigation

**Robust**:
- Valid HTML markup
- ARIA attributes used correctly
- Compatible with assistive technologies

### 2. Keyboard Navigation Spec

```typescript
// hooks/useKeyboardNavigation.ts
interface KeyboardNavigationOptions {
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onSpace?: () => void;
}

export function useKeyboardNavigation(options: KeyboardNavigationOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          options.onArrowUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          options.onArrowDown?.();
          break;
        case 'ArrowLeft':
          options.onArrowLeft?.();
          break;
        case 'ArrowRight':
          options.onArrowRight?.();
          break;
        case 'Enter':
          options.onEnter?.();
          break;
        case 'Escape':
          options.onEscape?.();
          break;
        case ' ':
          e.preventDefault();
          options.onSpace?.();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [options]);
}

// Usage in ConfigurationTree
const ConfigurationTree = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useKeyboardNavigation({
    onArrowDown: () => setSelectedIndex(prev => Math.min(prev + 1, items.length - 1)),
    onArrowUp: () => setSelectedIndex(prev => Math.max(prev - 1, 0)),
    onEnter: () => selectItem(items[selectedIndex]),
  });

  return (
    <div role="tree" aria-label="Configuration tree">
      {items.map((item, index) => (
        <div
          key={item.id}
          role="treeitem"
          tabIndex={index === selectedIndex ? 0 : -1}
          aria-selected={index === selectedIndex}
        >
          {item.name}
        </div>
      ))}
    </div>
  );
};
```

### 3. ARIA Implementation

```typescript
// Required ARIA attributes for interactive elements

// Buttons
<button
  aria-label="Edit configuration"
  aria-describedby="edit-help-text"
>
  <PencilIcon />
</button>

// Tree navigation
<div
  role="tree"
  aria-label="Configuration hierarchy"
  aria-multiselectable="false"
>
  <div
    role="treeitem"
    aria-expanded={isExpanded}
    aria-level={level}
    aria-posinset={position}
    aria-setsize={totalItems}
  >
    {/* Content */}
  </div>
</div>

// Live regions for dynamic content
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {statusMessage}
</div>

// Alerts
<div
  role="alert"
  aria-live="assertive"
>
  {errorMessage}
</div>

// Dialogs
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Confirm Delete</h2>
  <p id="dialog-description">Are you sure you want to delete this configuration?</p>
</div>
```

### 4. Focus Management

```typescript
// hooks/useFocusTrap.ts
export function useFocusTrap(ref: React.RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !ref.current) return;

    const element = ref.current;
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstFocusable?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    element.addEventListener('keydown', handleTabKey);
    return () => element.removeEventListener('keydown', handleTabKey);
  }, [isActive, ref]);
}
```

---

## Testing Requirements

### 1. Testing Strategy

#### Test Coverage Targets

| Type | Coverage Target |
|------|-----------------|
| Unit Tests | 70% |
| Integration Tests | 50% |
| E2E Tests | Critical paths only |

#### Testing Pyramid

```
     /\
    /E2E\       10% - Critical user flows
   /------\
  / Integ  \    30% - Component integration
 /----------\
/   Unit     \  60% - Business logic, utilities
/--------------\
```

### 2. Unit Testing Spec

```typescript
// Example: Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Button from './Button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading spinner when loading', () => {
    render(<Button loading>Click me</Button>);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Click me')).not.toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies correct variant styles', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary-600');

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-red-600');
  });
});
```

### 3. Integration Testing Spec

```typescript
// Example: Dashboard.integration.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { server } from '@/test/mocks/server';
import { rest } from 'msw';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      {children}
    </BrowserRouter>
  </QueryClientProvider>
);

describe('Dashboard Integration', () => {
  it('loads and displays configurations', async () => {
    render(<Dashboard />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('prod_analytics')).toBeInTheDocument();
      expect(screen.getByText('prod_ecommerce')).toBeInTheDocument();
    });
  });

  it('selects and displays configuration details', async () => {
    const user = userEvent.setup();
    render(<Dashboard />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('prod_analytics')).toBeInTheDocument();
    });

    await user.click(screen.getByText('prod_analytics'));

    await waitFor(() => {
      expect(screen.getByText('Configuration Data')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    server.use(
      rest.get('/api/configs', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'Server error' }));
      })
    );

    render(<Dashboard />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/failed to load configurations/i)).toBeInTheDocument();
    });
  });
});
```

### 4. Test Setup

```typescript
// test/setup.ts
import '@testing-library/jest-dom';
import { server } from './mocks/server';

// Start MSW server before all tests
beforeAll(() => server.listen());

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Clean up after all tests
afterAll(() => server.close());

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
```

```typescript
// test/mocks/server.ts
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const handlers = [
  rest.get('/api/configs', (req, res, ctx) => {
    return res(
      ctx.json({
        configs: [
          {
            id: '1',
            name: 'prod_analytics',
            type: 'PRODUCT',
            status: 'COMMITTED',
          },
          {
            id: '2',
            name: 'prod_ecommerce',
            type: 'PRODUCT',
            status: 'COMMITTED',
          },
        ],
      })
    );
  }),

  rest.get('/api/configs/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(
      ctx.json({
        id,
        name: 'prod_analytics',
        type: 'PRODUCT',
        data: { key: 'value' },
      })
    );
  }),
];

export const server = setupServer(...handlers);
```

---

## Build & Deployment Spec

### 1. Build Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'analyze' && visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:3004',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: mode === 'development',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'ui-vendor': ['@heroicons/react'],
          '3d-vendor': ['three'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
    },
  },
}));
```

### 2. Environment Configuration

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3004
VITE_WS_URL=ws://localhost:3004
VITE_ENABLE_DEMO_CREDENTIALS=true
VITE_ENABLE_3D_PREVIEW=true

# .env.production
VITE_API_BASE_URL=https://api.production.com
VITE_WS_URL=wss://api.production.com
VITE_ENABLE_DEMO_CREDENTIALS=false
VITE_ENABLE_3D_PREVIEW=true

# .env.test
VITE_API_BASE_URL=http://localhost:3004
VITE_ENABLE_DEMO_CREDENTIALS=false
```

### 3. Build Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "build:analyze": "vite build --mode analyze",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint src --ext ts,tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,md}\"",
    "type-check": "tsc --noEmit",
    "deps:check": "npm outdated",
    "deps:update": "npm update",
    "deps:audit": "npm audit"
  }
}
```

### 4. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
        working-directory: ./client
      
      - name: Type check
        run: npm run type-check
        working-directory: ./client
      
      - name: Lint
        run: npm run lint
        working-directory: ./client
      
      - name: Test
        run: npm run test:coverage
        working-directory: ./client
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          directory: ./client/coverage

  build:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
        working-directory: ./client
      
      - name: Build
        run: npm run build
        working-directory: ./client
        env:
          VITE_API_BASE_URL: ${{ secrets.API_BASE_URL }}
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: ./client/dist
```

---

## Migration Plan

### Phase 1: Foundation (Weeks 1-2)

#### Week 1: Security Hardening
- [ ] Remove hardcoded credentials
- [ ] Add environment variable configuration
- [ ] Implement CSP headers
- [ ] Remove production source maps
- [ ] Clean up console logging

**Deliverables**:
- Updated `Login.jsx` with environment variables
- `.env.example` file
- CSP meta tags in `index.html`
- Logger utility

#### Week 2: Build Setup
- [ ] Configure TypeScript
- [ ] Setup ESLint and Prettier
- [ ] Add testing infrastructure
- [ ] Configure build optimizations

**Deliverables**:
- `tsconfig.json`
- `.eslintrc.cjs`
- `.prettierrc`
- `vitest.config.ts`

### Phase 2: Architecture (Weeks 3-6)

#### Week 3-4: API Layer
- [ ] Create API client with interceptors
- [ ] Define endpoint modules
- [ ] Integrate React Query
- [ ] Add TypeScript types for API

**Deliverables**:
- `api/client.ts`
- `api/endpoints/` directory
- `hooks/useConfigurations.ts`
- API type definitions

#### Week 5-6: Component Refactoring
- [ ] Break down Dashboard component
- [ ] Break down SettingsModal component
- [ ] Create common component library
- [ ] Extract custom hooks

**Deliverables**:
- Refactored Dashboard
- Refactored SettingsModal
- Common components (Button, Modal, etc.)
- Custom hooks library

### Phase 3: Performance (Weeks 7-10)

#### Week 7-8: Optimization
- [ ] Implement code splitting
- [ ] Add lazy loading
- [ ] Optimize re-renders with memoization
- [ ] Add bundle analysis

**Deliverables**:
- Lazy loaded routes
- React.memo implementations
- Bundle size reports

#### Week 9-10: Caching & State
- [ ] Implement React Query caching
- [ ] Optimize state management
- [ ] Add request deduplication
- [ ] Performance monitoring

**Deliverables**:
- Query configurations
- Optimized state structure
- Performance benchmarks

### Phase 4: Quality (Weeks 11-14)

#### Week 11-12: Testing
- [ ] Write unit tests (target: 70% coverage)
- [ ] Write integration tests
- [ ] Add E2E tests for critical paths
- [ ] Setup CI/CD pipeline

**Deliverables**:
- Test suites
- Coverage reports
- CI/CD pipeline

#### Week 13-14: Accessibility
- [ ] Keyboard navigation
- [ ] ARIA attributes
- [ ] Focus management
- [ ] Accessibility audit

**Deliverables**:
- Keyboard navigation support
- ARIA compliant components
- Accessibility report

### Phase 5: Enhancement (Weeks 15+)

#### Features
- [ ] PWA support
- [ ] Offline capabilities
- [ ] Keyboard shortcuts
- [ ] Configuration comparison
- [ ] Real-time collaboration

**Deliverables**:
- Service worker
- PWA manifest
- Feature implementations

---

## Success Metrics

### Code Quality Metrics
- [ ] TypeScript coverage: 100%
- [ ] Test coverage: >70%
- [ ] ESLint errors: 0
- [ ] Bundle size: <380KB initial

### Performance Metrics
- [ ] First Contentful Paint: <1.5s
- [ ] Time to Interactive: <3s
- [ ] Lighthouse Score: >90

### Accessibility Metrics
- [ ] WCAG 2.1 AA compliance: 100%
- [ ] Keyboard navigation: Complete
- [ ] Screen reader compatible: Yes

### Security Metrics
- [ ] No hardcoded secrets
- [ ] CSP implemented
- [ ] Security headers configured
- [ ] Dependency vulnerabilities: 0

---

## Appendix

### A. TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    /* Paths */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### B. ESLint Configuration

```javascript
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', 'jsx-a11y'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
```

### C. Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

---

**Document Version**: 1.0.0  
**Last Updated**: November 26, 2025  
**Next Review**: December 26, 2025  

**Approvals Required**:
- [ ] Technical Lead
- [ ] Security Team
- [ ] QA Team
- [ ] Product Owner

