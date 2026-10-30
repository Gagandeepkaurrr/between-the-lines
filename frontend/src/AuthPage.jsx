import "./AuthPage.css";
import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Icon, ShelfPreview, ErrorMessage } from "./components";

export default function AuthPage({ mode }) {
  const signup = mode === "signup";
  const { user, authenticate } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/shelf" replace />;
  async function submit(event) {
    event.preventDefault();
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    values.email = values.email.trim();
    if (signup && values.password !== values.confirm_password) {
      setError("Your passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await authenticate(mode, values);
      navigate("/shelf");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-aside">
        <span className="eyebrow">YOUR NEXT CHAPTER</span>
        <h1>
          A life in books.
          <br />
          <em>A space of your own.</em>
        </h1>
        <ShelfPreview />
      </section>
      <section className="auth-card">
        <span className="eyebrow">BETWEEN THE LINES</span>
        <h2>{signup ? "Make yourself at home." : "Welcome back, reader."}</h2>
        <p className="muted">
          {signup
            ? "Your personal reading journey starts here."
            : "Your bookshelf is right where you left it."}
        </p>
        <ErrorMessage message={error} />
        <form onSubmit={submit}>
          {signup && (
            <label>
              Your name
              <input
                name="name"
                autoComplete="name"
                placeholder="How should we call you?"
                required
                maxLength={100}
              />
            </label>
          )}
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              maxLength={254}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              placeholder={signup ? "At least 8 characters" : "Your password"}
              minLength={signup ? 8 : 1}
              maxLength={128}
              required
            />
          </label>
          {signup && (
            <label>
              Confirm password
              <input
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                placeholder="One more time"
                required
                maxLength={128}
              />
            </label>
          )}
          <button className="button full" disabled={busy}>
            {busy ? "One moment…" : signup ? "Create my journal" : "Log in"}
            <Icon name="arrow" size={18} />
          </button>
        </form>
        <p className="auth-switch">
          {signup ? "Already have a journal?" : "New to Between the Lines?"}{" "}
          <Link to={signup ? "/login" : "/signup"}>
            {signup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </section>
    </main>
  );
}
