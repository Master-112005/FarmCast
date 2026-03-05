"use strict";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

import {
  loginUser,
  registerUser,
  logoutUser,
} from "../services/userService";
import { STORAGE_KEYS } from "../utils/constants";



const STORAGE = Object.freeze({
  USER: STORAGE_KEYS?.USER || "farmcast.auth.user",
  TOKEN: STORAGE_KEYS?.TOKEN || "farmcast.auth.token",
  REFRESH_TOKEN:
    STORAGE_KEYS?.REFRESH_TOKEN ||
    "farmcast.auth.refreshToken",
});



const AuthContext = createContext(null);



const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};



export const AuthProvider = ({ children }) => {
  /* -------------------------------
     STATE
  -------------------------------- */

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  /* -------------------------------
     SESSION RESTORE (ONCE)
  -------------------------------- */

  useEffect(() => {
    const restoreSession = () => {
      const storedUser = safeParse(
        localStorage.getItem(STORAGE.USER)
      );

      const storedToken =
        localStorage.getItem(STORAGE.TOKEN);

      if (storedUser && storedToken) {
        setUser(storedUser);
        setToken(storedToken);
      }

      setBootstrapping(false);
    };

    restoreSession();
  }, []);

  /* -------------------------------
     INTERNAL PERSIST
  -------------------------------- */

  const persistSession = useCallback((user, token) => {
    localStorage.setItem(
      STORAGE.USER,
      JSON.stringify(user)
    );
    localStorage.setItem(
      STORAGE.TOKEN,
      token
    );

    setUser(user);
    setToken(token);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE.USER);
    localStorage.removeItem(STORAGE.TOKEN);
    localStorage.removeItem(STORAGE.REFRESH_TOKEN);

    setUser(null);
    setToken(null);
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      clearSession();
      setShowWelcome(false);
    };

    window.addEventListener(
      "farmcast:auth-expired",
      handleSessionExpired
    );

    return () => {
      window.removeEventListener(
        "farmcast:auth-expired",
        handleSessionExpired
      );
    };
  }, [clearSession]);

  /* -------------------------------
     USER UPDATE (PROFILE SYNC)
  -------------------------------- */

  const updateUser = useCallback((patch) => {
    if (!patch) return;

    setUser((prev) => {
      const next = {
        ...(prev || {}),
        ...patch,
      };

      try {
        localStorage.setItem(
          STORAGE.USER,
          JSON.stringify(next)
        );
      } catch {
        // ignore storage write failures
      }

      return next;
    });
  }, []);

  /* -------------------------------
     REGISTER
  -------------------------------- */

  const register = useCallback(async (payload) => {
    setLoading(true);

    try {
      const res = await registerUser(payload);

      if (!res?.success) {
        throw new Error(
          res?.error || "Registration failed"
        );
      }

      return res.data;
    } finally {
      setLoading(false);
    }
  }, []);

  /* -------------------------------
     LOGIN
  -------------------------------- */

  const login = useCallback(async (credentials) => {
    setLoading(true);

    try {
      const res = await loginUser(credentials);

      if (!res?.success) {
        throw new Error(
          res?.error || "Login failed"
        );
      }

      const { user, token } = res.data;

      persistSession(user, token);
      setShowWelcome(true);

      return user;
    } finally {
      setLoading(false);
    }
  }, [persistSession]);

  /* -------------------------------
     LOGOUT
  -------------------------------- */

  const logout = useCallback(() => {
    try {
      logoutUser();
    } finally {
      clearSession();
      setShowWelcome(false);
    }
  }, [clearSession]);

  const clearWelcome = useCallback(() => {
    setShowWelcome(false);
  }, []);

  /* -------------------------------
     DERIVED
  -------------------------------- */

  const isAuthenticated = Boolean(
    user && token
  );

  const role = user?.role || "guest";

  const hasRole = useCallback(
    (allowed = []) =>
      allowed.includes(role),
    [role]
  );

  /* -------------------------------
     CONTEXT VALUE
  -------------------------------- */

  const value = useMemo(
    () => ({
      user,
      token,
      role,

      bootstrapping,
      loading,
      showWelcome,

      isAuthenticated,

      hasRole,

      register,
      login,
      logout,
      updateUser,
      clearWelcome,
    }),
    [
      user,
      token,
      role,
      bootstrapping,
      loading,
      showWelcome,
      isAuthenticated,
      hasRole,
      register,
      login,
      logout,
      updateUser,
      clearWelcome,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};



export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      "useAuth must be used within AuthProvider"
    );
  }

  return ctx;
};
