import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export const statuses = {
  want_to_read: "Want to read",
  currently_reading: "Currently reading",
  finished: "Finished",
};

export function BackgroundStickers() {
  const [stickers] = useState(() => {
    // Rectangles on the original 1024 x 572 sheet: [x, y, width, height].
    // CSS shows one rectangle at a time; the supplied image stays unchanged.
    const pictures = [
      [24, 30, 145, 150],
      [176, 40, 158, 135],
      [338, 25, 158, 160],
      [510, 26, 180, 170],
      [700, 27, 142, 165],
      [850, 25, 150, 170],
      [24, 211, 152, 153],
      [218, 211, 227, 158],
      [458, 203, 158, 175],
      [648, 245, 199, 100],
      [863, 211, 129, 154],
      [340, 409, 102, 136],
      [460, 411, 130, 130],
      [600, 408, 122, 140],
      [863, 391, 139, 159],
    ];
    for (let i = pictures.length - 1; i > 0; i--) {
      const other = Math.floor(Math.random() * (i + 1));
      [pictures[i], pictures[other]] = [pictures[other], pictures[i]];
    }
    return pictures.slice(0, 12).map(([x, y, width, height], index) => {
      const scale = (56 + Math.random() * 7) / Math.max(width, height);
      return {
        width: width * scale,
        height: height * scale,
        backgroundSize: `${1024 * scale}px ${572 * scale}px`,
        backgroundPosition: `${-x * scale}px ${-y * scale}px`,
        top: `${14 + Math.floor(index / 2) * 13 + Math.random() * 3}%`,
        ...(index % 2 === 0 ? { left: 3 } : { right: 3 }),
        transform: `rotate(${Math.random() * 12 - 6}deg)`,
      };
    });
  });
  return (
    <div className="background-stickers" aria-hidden="true">
      {stickers.map((style, index) => (
        <span key={index} style={style} />
      ))}
    </div>
  );
}

export function Icon({ name = "book", size = 22 }) {
  const paths = {
    book: (
      <>
        <path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z" />
        <path d="M12 5v15" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    leaf: (
      <>
        <path d="M20 3C8 1 1 8 6 17c9 5 16-2 14-14Z" />
        <path d="M3 21 16 8" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-icon">
        <Icon size={28} />
      </span>
      <span>
        Between the Lines<small>A PERSONAL READING JOURNAL</small>
      </span>
    </Link>
  );
}

export function Header() {
  const { user, logout } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await logout();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header>
        <Brand />
        <nav aria-label="Main navigation">
          {user ? (
            <>
              <Link className="nav-active" to="/shelf">
                My bookshelf
              </Link>
              <span className="nav-name">Hello, {user.name.split(" ")[0]}</span>
              <button className="text-button" onClick={signOut} disabled={busy}>
                {busy ? "Logging out…" : "Log out"}
              </button>
            </>
          ) : (
            <>
              <Link className="text-link" to="/login">
                Log in
              </Link>
              <Link className="button small" to="/signup">
                Start your journal <Icon name="arrow" size={16} />
              </Link>
            </>
          )}
        </nav>
      </header>
      {error && <ErrorMessage message={error} />}
    </>
  );
}

export function ErrorMessage({ message }) {
  return message ? (
    <div className="error" role="alert">
      {message}
    </div>
  ) : null;
}

export function Cover({ book, className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [book.cover_url]);
  return (
    <div className={`cover ${className}`}>
      {book.cover_url && !failed ? (
        <img
          src={book.cover_url}
          alt={`Cover of ${book.title}`}
          onError={() => setFailed(true)}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="cover-fallback">
          <Icon size={30} />
          <span>{book.title}</span>
          <small>{book.author}</small>
        </div>
      )}
    </div>
  );
}

export function ShelfPreview() {
  // Decorative spines only, never saved bookshelf data.
  return (
    <div className="preview" aria-label="Illustration of a wooden bookshelf">
      <div className="preview-glow" />
      <span className="preview-note">
        A little space for your next chapter.
      </span>
      <div className="spines" aria-hidden="true">
        {["A story", "to get", "lost in", "and words", "to keep"].map(
          (text, i) => (
            <div key={text} className={`spine spine-${i}`}>
              <span>{text}</span>
              <i>BETWEEN THE LINES</i>
            </div>
          ),
        )}
      </div>
      <div className="wood-shelf" />
      <span className="preview-caption">
        <Icon name="leaf" size={16} /> Your stories belong here
      </span>
    </div>
  );
}

export function Protected({ children }) {
  const { user, loading, connectionError, restoreSession } = useAuth();
  if (loading) return <main className="state">Opening your journal…</main>;
  if (connectionError)
    return (
      <main className="state">
        <ErrorMessage message={connectionError} />
        <button className="button" onClick={restoreSession}>
          Try again
        </button>
      </main>
    );
  return user ? children : <Navigate to="/login" replace />;
}
