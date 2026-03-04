/**
 * main.jsx
 * FarmCast Frontend Entry Point (CRITICAL)
 *
 * Responsibilities:
 * - React root mounting
 * - StrictMode enforcement
 * - Zero business logic
 *
 * ❌ No providers here (handled by AppProviders)
 * ❌ No routing
 * ❌ No side effects
 */

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./app/App";

/* ======================================================
   GLOBAL STYLES (ONCE)
====================================================== */

import "./index.css";

/* ======================================================
   NOISY BROWSER EXTENSION REJECTION GUARD
====================================================== */

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const message = String(
      reason?.message || reason || ""
    );

    if (
      message.includes(
        "A listener indicated an asynchronous response by returning true"
      ) ||
      message.includes(
        "message channel closed before a response was received"
      )
    ) {
      event.preventDefault();
    }
  });
}

/* ======================================================
   ROOT MOUNT
====================================================== */

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("❌ Root element (#root) not found in index.html");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
