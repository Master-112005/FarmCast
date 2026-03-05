"use strict";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";



export const VIEWS = Object.freeze({
  DEVICE: "device",
  PREDICTOR: "predictor",
  COMMUNITY: "community",
  PROFILE: "profile",
  ADMIN: "admin",
});



const STORAGE_KEY = "farmcast.ui.activeView";



const ViewContext = createContext(null);



const isValidView = (value) =>
  Object.values(VIEWS).includes(value);

const isPersistableView = (value) =>
  value &&
  value !== VIEWS.PROFILE &&
  value !== VIEWS.ADMIN;

const getStoredView = () => {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPersistableView(stored) ? stored : null;
  } catch {
    return null;
  }
};



export const ViewProvider = ({ children }) => {
  const [view, setViewState] = useState(() => {
    const stored = getStoredView();
    return isValidView(stored)
      ? stored
      : VIEWS.DEVICE;
  });

  /* ---------- Safe Setter ---------- */
  const setView = useCallback((nextView) => {
    if (!isValidView(nextView)) return;

    setViewState(nextView);

    try {
      if (isPersistableView(nextView)) {
        localStorage.setItem(STORAGE_KEY, nextView);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore persistence failure */
    }
  }, []);

  /* ---------- Navigation Helpers ---------- */
  const goDevice = useCallback(
    () => setView(VIEWS.DEVICE),
    [setView]
  );

  const goPredictor = useCallback(
    () => setView(VIEWS.PREDICTOR),
    [setView]
  );

  const goProfile = useCallback(
    () => setView(VIEWS.PROFILE),
    [setView]
  );

  const goCommunity = useCallback(
    () => setView(VIEWS.COMMUNITY),
    [setView]
  );

  const goAdmin = useCallback(
    () => setView(VIEWS.ADMIN),
    [setView]
  );

  /* ---------- Derived Flags ---------- */
  const isDevice = view === VIEWS.DEVICE;
  const isPredictor = view === VIEWS.PREDICTOR;
  const isCommunity =
    view === VIEWS.COMMUNITY;
  const isProfile = view === VIEWS.PROFILE;
  const isAdmin = view === VIEWS.ADMIN;

  /* ---------- Memoized Context ---------- */
  const value = useMemo(
    () => ({
      view,
      setView,

      goDevice,
      goPredictor,
      goCommunity,
      goProfile,
      goAdmin,

      isDevice,
      isPredictor,
      isCommunity,
      isProfile,
      isAdmin,

      VIEWS,
    }),
    [
      view,
      setView,
      goDevice,
      goPredictor,
      goCommunity,
      goProfile,
      goAdmin,
      isDevice,
      isPredictor,
      isCommunity,
      isProfile,
      isAdmin,
    ]
  );

  return (
    <ViewContext.Provider value={value}>
      {children}
    </ViewContext.Provider>
  );
};



export const useView = () => {
  const ctx = useContext(ViewContext);

  if (!ctx) {
    throw new Error(
      "useView must be used within <ViewProvider>"
    );
  }

  return ctx;
};
