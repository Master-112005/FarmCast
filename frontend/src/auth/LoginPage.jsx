"use strict";

import React, {
  useState,
  useRef,
  useEffect,
} from "react";

import { Link } from "react-router-dom";



import { useAuth } from "../context/AuthContext";



const LoginPage = () => {
  const { login, loading } = useAuth();

  /* ---------------- STATE ---------------- */

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [error, setError] = useState("");

  const emailRef = useRef(null);

  /* ---------------- FOCUS FIRST FIELD ---------------- */

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  /* ---------------- SUBMIT ---------------- */

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      return setError(
        "Email and password are required."
      );
    }

    try {
      await login({
        email: email.trim(),
        password,
      });
    } catch {
      setError(
        "Invalid email or password."
      );
    }
  };

  

  return (
    <main
      className="auth-page"
      aria-label="Login page"
    >
      <section className="auth-card">

        <h1 className="auth-title">
          Sign in to FarmCast
        </h1>

        <form
          onSubmit={handleSubmit}
          noValidate
        >
          {/* EMAIL */}
          <div className="form-group">
            <label htmlFor="email">
              Email address
            </label>

            <input
              ref={emailRef}
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

            <input
              id="password"
              type="password"
              value={password}
              placeholder="Enter your password"
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              autoComplete="current-password"
              required
            />
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
              ? "Signing in…"
              : "Sign In"}
          </button>
        </form>

        {/* FOOTER */}
        <div className="auth-footer">
          <span>
            Don’t have an account?
          </span>
          <Link to="/register">
            Create one
          </Link>
        </div>

      </section>
    </main>
  );
};

export default LoginPage;
