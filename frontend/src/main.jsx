import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { BackgroundStickers, Header, Protected } from "./components";
import AuthPage from "./AuthPage";
import Bookshelf from "./Bookshelf";
import BookDetails from "./BookDetails";
import "./styles.css";

function App() {
  return (
    <>
      <BackgroundStickers />
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/signup"
          element={<AuthPage key="signup" mode="signup" />}
        />
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route
          path="/shelf"
          element={
            <Protected>
              <Bookshelf />
            </Protected>
          }
        />
        <Route
          path="/books/:id"
          element={
            <Protected>
              <BookDetails />
            </Protected>
          }
        />
        <Route
          path="*"
          element={
            <main className="state">
              <h2>This page isn’t on the shelf.</h2>
              <Link className="button" to="/">
                Go home
              </Link>
            </main>
          }
        />
      </Routes>
      <footer>
        <span>Between the Lines</span>
        <p>A little home for the books that make us.</p>
        <span className="footer-mark">READ. REFLECT. REPEAT.</span>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>,
);
