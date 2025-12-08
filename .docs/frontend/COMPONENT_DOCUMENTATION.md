# Component Documentation

## Overview

This document provides comprehensive documentation for the Configuration Manager frontend components, including usage examples, props, and best practices.

## Table of Contents

- [Core Components](#core-components)
- [Utility Components](#utility-components)
- [Context Providers](#context-providers)
- [Hooks and Utilities](#hooks-and-utilities)

---

## Core Components

### ErrorBoundary

Error boundary component that catches JavaScript errors in child components and displays a fallback UI.

**Location**: `src/components/ErrorBoundary.jsx`

**Usage**:
```jsx
import ErrorBoundary from '@/components/ErrorBoundary';

<ErrorBoundary name="Dashboard" onError={(error, errorInfo) => logError(error)}>
  <Dashboard />
</ErrorBoundary>
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| children | node | required | Child components to wrap |
| fallback | node | null | Custom fallback UI |
| title | string | "Something went wrong" | Error title |
| message | string | Default message | User-facing error message |
| name | string | "ErrorBoundary" | Identifier for logging |
| showReloadButton | bool | true | Show page reload button |
| onError | func | null | Callback when error occurs |
| onReset | func | null | Callback on "Try Again" click |

**Example - Custom Fallback**:
```jsx
<ErrorBoundary
  fallback={
    <div>
      <h1>Oops! Something went wrong</h1>
      <button onClick={() => window.location.reload()}>Reload</button>
    </div>
  }
>
  <MyComponent />
</ErrorBoundary>
```

---

### VirtualList

High-performance virtual scrolling component for large lists.

**Location**: `src/components/VirtualList.jsx`

**Usage**:
```jsx
import VirtualList from '@/components/VirtualList';

<VirtualList
  items={configurations}
  itemHeight={60}
  overscan={3}
  renderItem={(item, index) => (
    <ConfigurationItem config={item} index={index} />
  )}
/>
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| items | array | [] | Array of items to render |
| itemHeight | number | required | Fixed height of each item (px) |
| renderItem | func | required | Render function for each item |
| overscan | number | 3 | Number of items to render outside viewport |
| className | string | '' | Additional CSS classes |
| emptyMessage | string | "No items to display" | Message when list is empty |

**Performance**:
- Handles 10,000+ items at 60 FPS
- Constant memory usage regardless of list size
- Only renders visible items + overscan

---

### ConfigurationTree

Hierarchical tree view of configurations with expand/collapse.

**Location**: `src/components/ConfigurationTree.jsx`

**Features**:
- Expand/collapse with state persistence
- Drag-and-drop component integration
- Context menu operations
- Type-specific icons and colors

**Usage**:
```jsx
<ConfigurationTree
  configurations={allConfigs}
  selectedConfig={selectedConfig}
  onSelect={handleSelect}
  onAddComponent={handleAddComponent}
/>
```

---

### InteractiveJSONViewer

JSON viewer with provenance tooltips and inline editing.

**Location**: `src/components/InteractiveJSONViewer.jsx`

**Features**:
- Flat and structural view modes
- Provenance tooltips showing data sources
- Inline editing with validation
- Binary file previews
- Rules management

**Usage**:
```jsx
<InteractiveJSONViewer
  data={resolvedData}
  onDataChange={handleDataChange}
  selectedConfig={selectedConfig}
  isEditable={canEdit()}
/>
```

---

## Utility Components

### SkipToContent

Accessibility component for keyboard users to skip navigation.

**Location**: `src/utils/accessibility.js`

**Usage**:
```jsx
import { SkipToContent } from '@/utils/accessibility';

<SkipToContent targetId="main-content" />
<nav>...</nav>
<main id="main-content" tabIndex="-1">
  ...
</main>
```

---

### LiveRegion

ARIA live region for announcing dynamic content to screen readers.

**Location**: `src/utils/accessibility.js`

**Usage**:
```jsx
import { LiveRegion } from '@/utils/accessibility';

<LiveRegion priority="polite" message="Configuration saved successfully" />

// Or with children
<LiveRegion priority="assertive">
  {errorMessage}
</LiveRegion>
```

---

## Context Providers

### AuthContext

Manages authentication state and operations.

**Location**: `src/context/AuthContext.jsx`

**Usage**:
```jsx
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
  const { user, login, logout, isAuthenticated } = useAuth();
  
  return (
    <div>
      {isAuthenticated ? (
        <>
          <p>Welcome, {user.username}!</p>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <button onClick={() => login(username, password)}>Login</button>
      )}
    </div>
  );
}
```

**API**:
- `user`: Current user object
- `isAuthenticated`: Boolean auth status
- `loading`: Boolean loading state
- `error`: Error message if any
- `login(username, password)`: Login function
- `register(username, password, role)`: Register function
- `logout()`: Logout function

---

### ThemeContext

Manages dark/light theme state.

**Location**: `src/context/ThemeContext.jsx`

**Usage**:
```jsx
import { useTheme } from '@/context/ThemeContext';

function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();
  
  return (
    <button onClick={toggleTheme}>
      {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
    </button>
  );
}
```

---

### ToastContext

Manages toast notifications.

**Location**: `src/context/ToastContext.jsx`

**Usage**:
```jsx
import { useToast } from '@/context/ToastContext';

function MyComponent() {
  const { showToast } = useToast();
  
  const handleSave = async () => {
    try {
      await saveData();
      showToast('Saved successfully!', 'success');
    } catch (error) {
      showToast('Failed to save', 'error');
    }
  };
}
```

**Toast Types**:
- `success`: Green success message
- `error`: Red error message
- `warning`: Yellow warning message
- `info`: Blue info message (default)

---

## Hooks and Utilities

### useFocusTrap

Trap focus within a container (e.g., modals).

**Usage**:
```jsx
import { useFocusTrap } from '@/utils/accessibility';

function Modal({ isOpen, onClose }) {
  const modalRef = useRef(null);
  useFocusTrap(modalRef, isOpen);
  
  return (
    <div ref={modalRef}>
      <h2>Modal Title</h2>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

---

### useKeyboardNavigation

Handle keyboard navigation for lists.

**Usage**:
```jsx
import { useKeyboardNavigation } from '@/utils/accessibility';

function List({ items }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { handleKeyDown } = useKeyboardNavigation(items, selectedIndex, setSelectedIndex);
  
  return (
    <div onKeyDown={handleKeyDown} tabIndex="0">
      {items.map((item, index) => (
        <div key={index} className={index === selectedIndex ? 'selected' : ''}>
          {item.name}
        </div>
      ))}
    </div>
  );
}
```

---

### useEscapeKey

Handle Escape key press.

**Usage**:
```jsx
import { useEscapeKey } from '@/utils/accessibility';

function Modal({ onClose }) {
  useEscapeKey(onClose, true);
  
  return <div>...</div>;
}
```

---

### cachedRequest

Make cached API requests.

**Usage**:
```jsx
import { cachedRequest } from '@/utils/cache';

const data = await cachedRequest(
  () => configAPI.getAll(),
  {
    key: 'configs-all',
    ttl: 5 * 60 * 1000, // 5 minutes
    forceRefresh: false
  }
);
```

---

### logger

Secure logging with sensitive data sanitization.

**Usage**:
```jsx
import { logger } from '@/utils/logger';

logger.debug('Component rendered', { props }); // Only in development
logger.info('User action', { action: 'save' }); // Only in development
logger.warn('Deprecated API used'); // Only in development
logger.error('API failed', error, { endpoint }); // Always logged
```

---

### validation

Input validation and sanitization.

**Usage**:
```jsx
import { validatePassword, sanitizeString, validateJSON } from '@/utils/validation';

// Password validation
const pwdCheck = validatePassword(userInput);
if (!pwdCheck.valid) {
  setError(pwdCheck.message);
}

// HTML sanitization
const safeText = sanitizeString(userInput);

// JSON validation
const jsonCheck = validateJSON(jsonString);
if (jsonCheck.valid) {
  const data = jsonCheck.parsed;
}
```

---

## Best Practices

### Error Handling

1. **Wrap critical sections in ErrorBoundary**:
```jsx
<ErrorBoundary name="ConfigList">
  <ConfigurationList />
</ErrorBoundary>
```

2. **Use try-catch for async operations**:
```jsx
try {
  await apiCall();
  showToast('Success!', 'success');
} catch (error) {
  logger.error('API failed', error);
  showToast('Failed', 'error');
}
```

### Accessibility

1. **Use semantic HTML**:
```jsx
<button>Click me</button> // ✅ Good
<div onClick={...}>Click me</div> // ❌ Bad
```

2. **Add ARIA labels**:
```jsx
<button aria-label="Close modal" onClick={onClose}>
  <XIcon />
</button>
```

3. **Support keyboard navigation**:
```jsx
<div
  tabIndex="0"
  onKeyDown={handleKeyDown}
  role="button"
  aria-pressed={isPressed}
>
```

### Performance

1. **Use VirtualList for large datasets**:
```jsx
// ✅ Good for 1000+ items
<VirtualList items={largeArray} itemHeight={50} renderItem={...} />

// ❌ Bad for 1000+ items
{largeArray.map(item => <Item key={item.id} {...item} />)}
```

2. **Cache API calls**:
```jsx
// ✅ Good
const data = await cachedRequest(() => api.getAll(), { key: 'data', ttl: 300000 });

// ❌ Bad (uncached)
const data = await api.getAll();
```

3. **Use React.memo for expensive components**:
```jsx
const MyComponent = React.memo(({ data }) => {
  // Expensive render
});
```

### Security

1. **Sanitize user input**:
```jsx
import { sanitizeString } from '@/utils/validation';
const safe = sanitizeString(userInput);
```

2. **Validate before submission**:
```jsx
const validation = validatePassword(password);
if (!validation.valid) {
  return setError(validation.message);
}
```

3. **Use secure logging**:
```jsx
// ✅ Good - automatically sanitizes
logger.debug('User data', { username, password });
// Logs: { username: 'john', password: '***REDACTED***' }

// ❌ Bad
console.log({ username, password });
```

---

## Component Checklist

When creating new components, ensure they:

- [ ] Have PropTypes defined
- [ ] Are wrapped in ErrorBoundary (if critical)
- [ ] Support keyboard navigation
- [ ] Have appropriate ARIA attributes
- [ ] Use semantic HTML
- [ ] Handle loading and error states
- [ ] Are accessible (tested with screen reader)
- [ ] Have JSDoc comments
- [ ] Follow naming conventions
- [ ] Use utility functions (logger, validation)
- [ ] Are performance-optimized (memo, virtualization)

---

## Testing Components

See `PHASE3_CODE_QUALITY_IMPLEMENTATION.md` for testing guidelines and examples.

---

**Last Updated**: 2025-12-08  
**Version**: 1.0

