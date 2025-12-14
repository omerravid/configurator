# Keyboard Shortcuts - Troubleshooting & Fix

## Issue
Keyboard shortcuts were not triggering because `useShortcuts` hook was registering shortcuts but not setting up the global event listener.

## Root Cause
The `useShortcuts` hook only called `globalRegistry.register()` but didn't attach a `keydown` event listener to the document. The shortcuts were registered in memory but never checked against actual keyboard events.

## Fix Applied

### 1. Updated `useShortcuts` Hook
**File:** `client/src/utils/shortcuts.js`

Added the global keydown event listener inside the `useShortcuts` hook:

```javascript
export const useShortcuts = (shortcuts, options = {}) => {
  useEffect(() => {
    // Register all shortcuts
    Object.entries(shortcuts).forEach(([keys, config]) => {
      const handler = typeof config === 'function' ? config : config.handler;
      const opts = typeof config === 'object' ? config : {};
      
      globalRegistry.register(keys, handler, { ...options, ...opts });
    });

    // Setup global event listener (THIS WAS MISSING!)
    const handler = (event) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target;
      const tagName = target.tagName.toLowerCase();
      
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        if (event.key !== 'Escape') {
          return;
        }
      }

      const shortcut = globalRegistry.match(event);
      
      if (shortcut) {
        if (shortcut.preventDefault) {
          event.preventDefault();
        }
        
        try {
          shortcut.handler(event);
          logger.debug('Keyboard shortcut triggered', { keys: shortcut.keys });
        } catch (error) {
          logger.error('Keyboard shortcut handler failed', error);
        }
      }
    };

    document.addEventListener('keydown', handler);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handler);
      Object.keys(shortcuts).forEach(keys => {
        globalRegistry.unregister(keys);
      });
    };
  }, [shortcuts, options]);
};
```

### 2. Fixed Import Path
**File:** `client/src/components/CommandPalette.jsx`

Updated import to use the correct `accessibility.jsx` file (not `.js`):

```javascript
import { useFocusTrap } from '../utils/accessibility.jsx';
```

The `.jsx` file already existed with all the necessary accessibility utilities including `useFocusTrap`.

## Testing After Fix

### Quick Test
1. Refresh your browser (hard refresh: Ctrl+Shift+R)
2. Try these shortcuts:

**Ctrl+Shift+L (or Cmd+Shift+L on Mac):**
- Should toggle theme
- Should show success notification

**? (question mark):**
- Should open shortcuts help dialog
- Should show all 6 registered shortcuts

**Ctrl+K (or Cmd+K):**
- Should show info notification about command palette

**Escape:**
- Should close any open dialog
- Works even in input fields

### Debug in Console
If shortcuts still don't work, check in browser console:

```javascript
// Check if shortcuts are registered
window.__keyboardShortcuts.getAll()

// Should return array of 6 shortcuts

// Check if listener is working
document.addEventListener('keydown', (e) => {
  console.log('Key pressed:', {
    key: e.key,
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
    meta: e.metaKey
  });
});
```

### Expected Behavior Now

| Shortcut | Expected Result |
|----------|----------------|
| `Ctrl+Shift+L` | Theme toggles + success notification |
| `?` | Opens help dialog with shortcuts list |
| `Ctrl+K` | Shows "Command palette available after Step 3" notification |
| `Ctrl+,` | Shows "Settings shortcut available in Dashboard" notification |
| `Ctrl+R` | Console logs "Refresh shortcut triggered" (doesn't reload page) |
| `Escape` | Closes dialogs (if any open) |

### Input Field Protection
Type in any input field - shortcuts should NOT trigger (except Escape).

## Files Modified
1. ✅ `client/src/utils/shortcuts.js` - Fixed useShortcuts hook to add event listener
2. ✅ `client/src/components/CommandPalette.jsx` - Fixed import path to use accessibility.jsx

## Status
✅ **Fix Complete** - Shortcuts should now work correctly

Please test and confirm!

