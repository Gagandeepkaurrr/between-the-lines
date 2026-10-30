import "./Bookshelf.css";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { api } from "./api";
import { Icon, Cover, ErrorMessage, statuses } from "./components";
import SearchModal from "./SearchModal";

export default function Bookshelf() {
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [showSearch, setShowSearch] = useState(false);
  const addButton = useRef(null);
  async function load() {
    setError("");
    setLoading(true);
    try {
      setBooks(await api("/books"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  // These counts come from the same books displayed below, so no second API call is needed.
  const stats = {
    total: books.length,
    want_to_read: 0,
    currently_reading: 0,
    finished: 0,
  };
  for (const book of books) stats[book.status] += 1;

  const visible = books.filter((book) => {
    const matchesStatus = filter === "all" || book.status === filter;
    const matchesSearch = `${book.title} ${book.author}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesStatus && matchesSearch;
  });
  visible.sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "rating") return b.rating - a.rating;
    return b.id - a.id;
  });
  const tabs = [["all", "All books"], ...Object.entries(statuses)];
  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE READING, A LITTLE REFLECTION</span>
          <h1>
            Your bookshelf<span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            Every book is a chapter of your story, {user.name.split(" ")[0]}.
          </p>
        </div>
        <button
          ref={addButton}
          className="button"
          onClick={() => setShowSearch(true)}
        >
          <Icon name="plus" size={18} /> Add a book
        </button>
      </div>
      <section className="stats" aria-label="Reading statistics">
        {[
          ["total", "Books on your shelf", "book"],
          ["currently_reading", "Currently reading", "book"],
          ["finished", "Stories finished", "leaf"],
          ["want_to_read", "Waiting to be read", "book"],
        ].map(([key, label, icon], index) => (
          <div className="stat" key={key}>
            <span className={`stat-icon stat-icon-${index}`}>
              <Icon name={icon} />
            </span>
            <div>
              <strong>{loading || error ? "—" : stats[key]}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </section>
      {!loading && !error && (
        <ReadingGoal key={user.id} userId={user.id} finished={stats.finished} />
      )}
      <section className="library">
        <div className="library-toolbar">
          <div
            className="tabs"
            role="group"
            aria-label="Filter by reading status"
          >
            {tabs.map(([key, text]) => (
              <button
                key={key}
                className={filter === key ? "selected" : ""}
                onClick={() => setFilter(key)}
              >
                {text}
                <span>
                  {loading || error
                    ? "—"
                    : stats[key === "all" ? "total" : key]}
                </span>
              </button>
            ))}
          </div>
          <div className="library-controls">
            <label className="search-input">
              <Icon name="search" size={18} />
              <input
                aria-label="Search your shelf by title or author"
                placeholder="Search your shelf…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="sort-label">
              Sort by
              <select
                aria-label="Sort books"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="recent">Recently added</option>
                <option value="title">Title, A–Z</option>
                <option value="rating">Highest rated</option>
              </select>
            </label>
          </div>
        </div>
        <ErrorMessage message={error} />
        {error && (
          <button className="text-button" onClick={load}>
            Try loading again
          </button>
        )}
        {loading ? (
          <div className="state">Dusting off your bookshelf…</div>
        ) : (
          !error &&
          (visible.length ? (
            <>
              <div className="shelf-meta">
                <span>
                  {visible.length} {visible.length === 1 ? "book" : "books"} on
                  this shelf
                </span>
                <span>A world on every page</span>
              </div>
              <div className="book-grid">
                {visible.map((book) => (
                  <Link
                    className="book-card"
                    key={book.id}
                    to={`/books/${book.id}`}
                  >
                    <div className="book-stage">
                      <Cover book={book} />
                    </div>
                    <span className={`status-badge ${book.status}`}>
                      {statuses[book.status]}
                    </span>
                    <h3>{book.title}</h3>
                    <p>{book.author}</p>
                    <div
                      className="tiny-stars"
                      aria-label={
                        book.rating
                          ? `${book.rating} out of 5 stars`
                          : "Not rated"
                      }
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={n <= book.rating ? "filled" : ""}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="empty">
              <div className="empty-illustration">
                <span />
                <Icon size={54} />
                <span />
              </div>
              <span className="eyebrow">ROOM FOR A NEW CHAPTER</span>
              <h2>
                {books.length
                  ? "A different shelf, perhaps?"
                  : "Great stories start with one book."}
              </h2>
              <p>
                {books.length
                  ? "No books match these filters. Try another title or reading status."
                  : "Build a little library of your own. Add your first book and let the story unfold."}
              </p>
              {books.length ? (
                <button
                  className="button"
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                  }}
                >
                  Show all books
                </button>
              ) : (
                <button className="button" onClick={() => setShowSearch(true)}>
                  <Icon name="plus" size={18} /> Find your first book
                </button>
              )}
              <div className="empty-shelf" />
            </div>
          ))
        )}
      </section>
      <div className="shelf-footer">
        <Icon name="leaf" size={17} />
        <span>Read at your own pace. Every page counts.</span>
      </div>
      {showSearch && (
        <SearchModal
          books={books}
          onAdded={(book) => setBooks((savedBooks) => [book, ...savedBooks])}
          onClose={() => {
            setShowSearch(false);
            addButton.current?.focus();
          }}
        />
      )}
    </main>
  );
}

// This feature is browser-only. Each account has its own localStorage key.
function ReadingGoal({ userId, finished }) {
  const storageKey = `between-the-lines:reading-goal:${userId}`;
  const [goal, setGoal] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      return Number.isInteger(saved) && saved >= 1 && saved <= 1000 ? saved : 0;
    } catch {
      return 0;
    }
  });
  const [target, setTarget] = useState(goal || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const percentage = goal
    ? Math.min(100, Math.round((finished / goal) * 100))
    : 0;

  function saveGoal(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const nextGoal = Number(target);
    if (!Number.isInteger(nextGoal) || nextGoal < 1 || nextGoal > 1000) {
      setError("Choose a whole number between 1 and 1,000.");
      return;
    }
    try {
      localStorage.setItem(storageKey, String(nextGoal));
      setGoal(nextGoal);
      setMessage("Reading goal saved in this browser.");
    } catch {
      setError(
        "Your browser could not save the goal. Please allow site storage and try again.",
      );
    }
  }

  return (
    <section className="reading-goal" aria-labelledby="goal-heading">
      <div className="goal-header">
        <div>
          <span className="eyebrow">ONE BOOK AT A TIME</span>
          <h2 id="goal-heading">Your reading goal</h2>
          <p>
            Counts all books marked Finished on your shelf. Your target is saved
            only in this browser.
          </p>
        </div>
        <form className="goal-form" onSubmit={saveGoal}>
          <label htmlFor="goal-target">Books to finish</label>
          <div>
            <input
              id="goal-target"
              type="number"
              min="1"
              max="1000"
              step="1"
              required
              value={target}
              placeholder="e.g. 12"
              onChange={(event) => {
                setTarget(event.target.value);
                setMessage("");
                setError("");
              }}
            />
            <button className="button small">
              {goal ? "Update goal" : "Set goal"}
            </button>
          </div>
        </form>
      </div>
      {goal ? (
        <>
          <div className="goal-progress-label">
            <span>
              <strong>{finished}</strong> of {goal} books finished
            </span>
            <span>{percentage}%</span>
          </div>
          <progress
            className="goal-progress"
            value={Math.min(finished, goal)}
            max={goal}
            aria-label="Reading goal progress"
          >
            {percentage}%
          </progress>
          <p className="goal-note">
            {finished >= goal
              ? "Goal reached. A shelf worth celebrating."
              : `${goal - finished} more ${goal - finished === 1 ? "book" : "books"} to reach your goal.`}
          </p>
        </>
      ) : (
        <p className="goal-note">
          Set a target to start tracking your progress.
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
