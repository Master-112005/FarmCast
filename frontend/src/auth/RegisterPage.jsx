/**
 * RegisterPage.jsx
 * ------------------------------------------------------
 * FarmCast – Enterprise Registration Screen
 *
 * Tier: 0 (Security Entry Point)
 *
 * Responsibilities:
 * - Collect user details
 * - Trigger AuthContext register
 * - UX-level validation
 *
 * Rules:
 * - No API calls
 * - No routing logic
 * - No token handling
 */

"use strict";

import React, {
  useState,
  useEffect,
  useRef,
} from "react";

import { Link } from "react-router-dom";

/* ======================================================
   CONTEXT
====================================================== */

import { useAuth } from "../context/AuthContext";

/* ======================================================
   HELPERS
====================================================== */

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD_LENGTH = 8;

/* ======================================================
   COMPONENT
====================================================== */

const RegisterPage = () => {
  const { register, loading } = useAuth();

  /* ---------------- STATE ---------------- */

  const [name, setName] = useState("");
  const [email, setEmail] =
    useState("");
  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);
  const [error, setError] = useState("");

  const nameRef = useRef(null);

  /* ---------------- FOCUS FIRST FIELD ---------------- */

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  /* ---------------- SUBMIT ---------------- */

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name || !email || !password) {
      return setError(
        "All fields are required."
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return setError(
        "Enter a valid email address."
      );
    }

    if (
      password.length <
      MIN_PASSWORD_LENGTH
    ) {
      return setError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
    }

    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    } catch {
      setError(
        "Registration failed. Please try again."
      );
    }
  };

  /* ======================================================
     RENDER
  ====================================================== */

  return (
    <main
      className="auth-page"
      aria-label="Register page"
    >
      <section className="auth-card">

        <h1 className="auth-title">
          Create your FarmCast account
        </h1>

        <form
          onSubmit={handleSubmit}
          noValidate
        >
          {/* NAME */}
          <div className="form-group">
            <label htmlFor="name">
              Full name
            </label>

            <input
              ref={nameRef}
              id="name"
              type="text"
              value={name}
              placeholder="Your name"
              onChange={(e) =>
                setName(e.target.value)
              }
              autoComplete="name"
              required
            />
          </div>

          {/* EMAIL */}
          <div className="form-group">
            <label htmlFor="email">
              Email address
            </label>

            <input
              id="email"
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) =>
                setEmail(e.target.value)
              }
              autoComplete="email"
              required
            />
          </div>

          {/* PASSWORD */}
          <div className="form-group">
            <label htmlFor="password">
              Password
            </label>

            <div className="password-wrapper">
              <input
                id="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                placeholder="Create a password"
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                autoComplete="new-password"
                required
              />

              <button
                type="button"
                className="password-toggle"
                aria-label="Toggle password visibility"
                onClick={() =>
                  setShowPassword(
                    (v) => !v
                  )
                }
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>

            <small className="form-hint">
              Minimum {MIN_PASSWORD_LENGTH} characters
            </small>
          </div>

          {/* ERROR */}
          {error && (
            <div
              className="form-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* SUBMIT */}
          <button
            type="submit"
            className="primary-btn"
            disabled={loading}
            aria-busy={loading}
          >
            {loading
              ? "Creating account…"
              : "Create account"}
          </button>
        </form>

        {/* FOOTER */}
        <div className="auth-footer">
          <span>
            Already have an account?
          </span>
          <Link to="/login">
            Sign in
          </Link>
        </div>

      </section>
    </main>
  );
};

export default RegisterPage;
