import "./SearchModal.css";
import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Icon, Cover, ErrorMessage } from "./components";

export default function SearchModal({ books, onAdded, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState("");
  const modal = useRef(null);
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal.current.querySelector("input").focus();
    function keydown(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = [
          ...modal.current.querySelectorAll(
            "button:not(:disabled), input, a[href]",
          ),
        ];
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keydown);
    };
  }, []);
  async function search(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError("");
    try {
      setResults(await api(`/search?q=${encodeURIComponent(query.trim())}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function add(book) {
    setAdding(book.google_books_id);
    setError("");
    try {
      const savedBook = await api("/books", {
        method: "POST",
        body: JSON.stringify(book),
      });
      onAdded(savedBook);
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding("");
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={modal}
        className="search-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-heading"
      >
        <button
          className="close-button"
          onClick={onClose}
          aria-label="Close book search"
        >
          ×
        </button>
        <span className="eyebrow">YOUR NEXT GOOD READ</span>
        <h2 id="search-heading">Make room for a new story.</h2>
        <p className="muted">Search millions of books by title or author.</p>
        <form className="book-search-form" onSubmit={search}>
          <label className="search-input">
            <Icon name="search" size={20} />
            <input
              placeholder="A title, an author, a new adventure…"
              aria-label="Search Open Library"
              value={query}
              maxLength={200}
              onChange={(e) => setQuery(e.target.value)}
              required
            />
          </label>
          <button className="button" disabled={busy}>
            {busy ? "Searching…" : "Search"}
          </button>
        </form>
        <ErrorMessage message={error} />
        <div className="search-results" aria-live="polite">
          {results === null ? (
            <div className="search-intro">
              <Icon size={42} />
              <p>What will you read next?</p>
              <small>
                Book information and covers provided by Open Library.
              </small>
            </div>
          ) : results.length === 0 ? (
            <div className="state">
              No books found. Try another title or author.
            </div>
          ) : (
            results.map((book) => {
              const saved = books.some(
                (item) => item.google_books_id === book.google_books_id,
              );
              return (
                <article className="search-result" key={book.google_books_id}>
                  <Cover book={book} />
                  <div>
                    <h3>{book.title}</h3>
                    <p>{book.author}</p>
                    <small>{book.genre}</small>
                  </div>
                  <button
                    className={saved ? "added-button" : "button outline small"}
                    disabled={saved || Boolean(adding)}
                    onClick={() => add(book)}
                  >
                    {saved
                      ? "✓ On your shelf"
                      : adding === book.google_books_id
                        ? "Adding…"
                        : "+ Add"}
                  </button>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
