"use strict";

import React, {
  useState,
  useRef,
  useEffect,
} from "react";

import {
  Link,
  useLocation,
} from "react-router-dom";



import { useAuth } from "../context/AuthContext";



const LoginPage = () => {
  const { login, loading } = useAuth();
  const location = useLocation();



  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    location.state?.message || ""
  );

  const emailRef = useRef(null);



  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    }

    emailRef.current?.focus();
  }, [location.state?.email]);



  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

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
          {}
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

          {}
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

          {}
          {error && (
            <div
              className="form-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              className="form-success"
              role="status"
            >
              {notice}
            </div>
          )}

          {}
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

        {}
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
