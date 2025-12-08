import React, { createContext, useContext, useReducer, useEffect } from "react";
import { authAPI } from "../services/api";
import { logger } from "../utils/logger";
import { getToken, setToken, removeToken } from "../utils/tokenStorage";

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case "LOGIN_START":
      return { ...state, loading: true, error: null };
    case "LOGIN_SUCCESS":
      return {
        ...state,
        loading: false,
        error: null,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
      };
    case "LOGIN_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
        isAuthenticated: false,
      };
    case "LOGOUT":
      return { ...initialState };
    case "SET_USER":
      return { ...state, user: action.payload, isAuthenticated: true };
    default:
      return state;
  }
};

const initialState = {
  isAuthenticated: false,
  user: null,
  token: getToken(),
  loading: false,
  error: null,
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const token = getToken();
    if (token) {
      // Verify token and get user info
      authAPI
        .getCurrentUser()
        .then((response) => {
          dispatch({
            type: "LOGIN_SUCCESS",
            payload: {
              user: response.data.user,
              token,
            },
          });
        })
        .catch((error) => {
          logger.debug("Token validation failed", { message: error.message });
          removeToken();
          dispatch({ type: "LOGOUT" });
          // If we're not already on login page, redirect
          if (window.location.pathname !== "/login") {
            window.location.replace("/login");
          }
        });
    }
  }, []);

  const login = async (username, password) => {
    dispatch({ type: "LOGIN_START" });
    try {
      const response = await authAPI.login(username, password);
      const { token, user } = response.data;

      setToken(token);
      dispatch({
        type: "LOGIN_SUCCESS",
        payload: { user, token },
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Login failed";
      dispatch({ type: "LOGIN_FAILURE", payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const register = async (username, password, role = "USER") => {
    dispatch({ type: "LOGIN_START" });
    try {
      const response = await authAPI.register(username, password, role);
      const { token, user } = response.data;

      setToken(token);
      dispatch({
        type: "LOGIN_SUCCESS",
        payload: { user, token },
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Registration failed";
      dispatch({ type: "LOGIN_FAILURE", payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    removeToken();
    dispatch({ type: "LOGOUT" });
  };

  const value = {
    ...state,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
