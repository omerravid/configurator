import React, { Suspense, lazy, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { NotificationProvider, useNotifications } from "./context/NotificationContext";
import { CommandRegistryProvider, useCommandRegistry } from "./context/CommandRegistryContext";
import LoadingSpinner from "./components/LoadingSpinner";
import ErrorBoundary from "./components/ErrorBoundary";
import GlobalShortcuts from "./components/GlobalShortcuts";
import CommandPalette from "./components/CommandPalette";

// Lazy load pages for code splitting
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
    <LoadingSpinner />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AppRoutes = () => {
  const { isAuthenticated, logout } = useAuth();
  const { toggleTheme } = useTheme();
  const notifications = useNotifications();
  const { getAllCommands } = useCommandRegistry();
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global app commands (available everywhere)
  const globalCommands = [
    {
      id: 'toggle-theme',
      label: 'Toggle Dark/Light Theme',
      description: 'Switch between dark and light mode',
      category: 'Appearance',
      shortcut: 'ctrl+shift+l',
      action: () => {
        toggleTheme();
        notifications.success('Theme toggled');
      },
    },
    {
      id: 'logout',
      label: 'Logout',
      description: 'Sign out of your account',
      category: 'Account',
      action: () => {
        logout();
        navigate('/login');
        notifications.info('Logged out successfully');
      },
    },
    {
      id: 'go-home',
      label: 'Go to Dashboard',
      description: 'Navigate to main dashboard',
      category: 'Navigation',
      action: () => {
        navigate('/');
      },
    },
    {
      id: 'show-shortcuts',
      label: 'Show Keyboard Shortcuts',
      description: 'View all available keyboard shortcuts',
      category: 'Help',
      shortcut: '?',
      action: () => {
        // This is handled by GlobalShortcuts
        notifications.info('Press ? to show shortcuts');
      },
    },
  ];

  return (
    <GlobalShortcuts
      onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      onOpenSettings={() => {
        // Will be handled by Dashboard
        console.log('Settings shortcut triggered');
      }}
      onRefresh={() => {
        window.location.reload();
      }}
    >
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" /> : <Login />}
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={[...globalCommands, ...getAllCommands()]}
        onExecute={(command) => {
          console.log('Command executed:', command.id);
        }}
      />
    </GlobalShortcuts>
  );
};

function App() {
  return (
    <ErrorBoundary name="AppRoot">
      <ThemeProvider>
        <NotificationProvider position="top-right" maxNotifications={5}>
          <ToastProvider>
            <AuthProvider>
              <CommandRegistryProvider>
                <Router>
                  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
                    <AppRoutes />
                  </div>
                </Router>
              </CommandRegistryProvider>
            </AuthProvider>
          </ToastProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
