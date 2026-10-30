import "./BookDetails.css";
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "./api";
import { useAuth } from "./AuthContext";
import { Icon, Cover, ErrorMessage, statuses } from "./components";

export default function BookDetails() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function load() {
    setError("");
    setLoading(true);
    try {
      const result = await api(`/books/${id}`);
      setBook(result);
      setForm({
        status: result.status,
        rating: result.rating,
        favourite_quote: result.favourite_quote,
        notes: result.notes,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [id]);
  const dirty =
    book &&
    form &&
    ["status", "rating", "favourite_quote", "notes"].some(
      (key) => book[key] !== form[key],
    );
  useEffect(() => {
    function warn(e) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSuccess("");
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      setBook(
        await api(`/books/${id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        }),
      );
      setSuccess("Your thoughts have been saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api(`/books/${id}`, { method: "DELETE" });
      navigate("/shelf");
    } catch (e) {
      setError(e.message);
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <main className="state">Opening this chapter…</main>;
  if (!book)
    return (
      <main className="state">
        <ErrorMessage message={error} />
        <button className="text-button" onClick={load}>
          Try again
        </button>
        <Link to="/shelf">Back to bookshelf</Link>
      </main>
    );
  return (
    <main className="details-page">
      <Link
        className="back-link"
        to="/shelf"
        onClick={(e) => {
          if (
            dirty &&
            !window.confirm("Leave without saving your journal changes?")
          )
            e.preventDefault();
        }}
      >
        ← Back to your bookshelf
      </Link>
      <div className="details-layout">
        <aside className="book-summary">
          <div className="detail-cover-stage">
            <Cover book={book} />
            <div className="wood-shelf" />
          </div>
          <span className={`status-badge ${book.status}`}>
            {statuses[book.status]}
          </span>
          <h1>{book.title}</h1>
          <p className="book-author">by {book.author}</p>
          {book.genre && <span className="genre">{book.genre}</span>}
          <p className="summary-note">
            A book is a conversation.
            <br />
            This is your side of it.
          </p>
        </aside>
        <section className="journal">
          <span className="eyebrow">BETWEEN YOU AND THE PAGE</span>
          <h2>Your reading journal</h2>
          <p className="muted">The parts of the story that belong to you.</p>
          <ErrorMessage message={error} />
          {success && (
            <div className="success" role="status">
              ✓ {success}
            </div>
          )}
          <BookProgress key={book.id} userId={user.id} bookId={book.id} />
          <form onSubmit={save}>
            <div className="journal-top">
              <label>
                Reading status
                <select
                  value={form.status}
                  onChange={(e) => change("status", e.target.value)}
                >
                  {Object.entries(statuses).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="rating">
                <legend>Your rating</legend>
                <div>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      className={n <= form.rating ? "filled" : ""}
                      aria-label={`Rate ${n} out of 5 stars`}
                      aria-pressed={form.rating === n}
                      onClick={() => change("rating", n)}
                    >
                      ★
                    </button>
                  ))}
                  {form.rating > 0 && (
                    <button
                      className="clear-rating"
                      type="button"
                      onClick={() => change("rating", 0)}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </fieldset>
            </div>
            <label>
              A line to remember
              <span className="label-hint">Your favourite quote</span>
              <textarea
                className="quote-input"
                value={form.favourite_quote}
                onChange={(e) => change("favourite_quote", e.target.value)}
                placeholder="Some words deserve to be kept…"
                rows={4}
                maxLength={10000}
              />
            </label>
            <label>
              Thoughts in the margins
              <span className="label-hint">
                Your notes, reflections, and little discoveries
              </span>
              <textarea
                value={form.notes}
                onChange={(e) => change("notes", e.target.value)}
                placeholder="How did this book make you feel? What will stay with you?"
                rows={9}
                maxLength={15000}
              />
            </label>
            <div className="journal-actions">
              <button className="button" disabled={busy}>
                {busy ? "One moment…" : "Save changes"}
                <Icon name="arrow" size={18} />
              </button>
              <button
                className="delete-button"
                type="button"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                Delete book
              </button>
            </div>
            {confirmDelete && (
              <div className="delete-confirm" role="alert">
                <strong>Remove this book from your shelf?</strong>
                <p>
                  Its rating, quote, and journal notes will also be permanently
                  deleted.
                </p>
                <button
                  type="button"
                  className="button danger small"
                  onClick={remove}
                  disabled={busy}
                >
                  {busy ? "Deleting…" : "Yes, delete book"}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                >
                  Keep this book
                </button>
              </div>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}

// Page tracking is frontend-only, saved separately for each account and book.
function BookProgress({ userId, bookId }) {
  const storageKey = `between-the-lines:book-progress:${userId}:${bookId}`;
  const [saved, setSaved] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey));
      if (
        value &&
        Number.isInteger(value.current) &&
        Number.isInteger(value.total) &&
        value.total >= 1 &&
        value.total <= 100000 &&
        value.current >= 0 &&
        value.current <= value.total
      )
        return value;
    } catch {
      // Missing or invalid browser data simply starts with an empty tracker.
    }
    return null;
  });
  const [current, setCurrent] = useState(saved?.current ?? 0);
  const [total, setTotal] = useState(saved?.total ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const percentage = saved
    ? Math.round((saved.current / saved.total) * 100)
    : 0;

  function saveProgress(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    const pages = { current: Number(current), total: Number(total) };
    if (
      !Number.isInteger(pages.current) ||
      !Number.isInteger(pages.total) ||
      pages.total < 1 ||
      pages.total > 100000 ||
      pages.current < 0 ||
      pages.current > pages.total
    ) {
      setError(
        "Enter whole page numbers. The current page must be between 0 and the total pages.",
      );
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(pages));
      setSaved(pages);
      setMessage("Page progress saved in this browser.");
    } catch {
      setError(
        "Your browser could not save progress. Please allow site storage and try again.",
      );
    }
  }

  return (
    <section className="book-progress" aria-labelledby="book-progress-heading">
      <h3 id="book-progress-heading">Book completion</h3>
      <p className="goal-note">
        Page counts are saved only in this browser. Set reading status
        separately below.
      </p>
      <form className="book-progress-form" onSubmit={saveProgress}>
        <label>
          Current page
          <input
            type="number"
            min="0"
            max={total || 100000}
            step="1"
            required
            value={current}
            onChange={(event) => {
              setCurrent(event.target.value);
              setMessage("");
              setError("");
            }}
          />
        </label>
        <label>
          Total pages
          <input
            type="number"
            min="1"
            max="100000"
            step="1"
            required
            placeholder="e.g. 300"
            value={total}
            onChange={(event) => {
              setTotal(event.target.value);
              setMessage("");
              setError("");
            }}
          />
        </label>
        <button className="button small">Save progress</button>
      </form>
      {saved ? (
        <>
          <div className="goal-progress-label">
            <span>
              {saved.current} of {saved.total} pages read
            </span>
            <span>{percentage}%</span>
          </div>
          <progress
            className="goal-progress"
            value={saved.current}
            max={saved.total}
            aria-label="Book completion progress"
          >
            {percentage}%
          </progress>
          {saved.current === saved.total && (
            <p className="goal-note">
              Last page reached. You can mark this book Finished below.
            </p>
          )}
        </>
      ) : (
        <p className="goal-note">
          Enter your page counts to start tracking this book.
        </p>
      )}
      <ErrorMessage message={error} />
      {message && (
        <p className="goal-saved" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
