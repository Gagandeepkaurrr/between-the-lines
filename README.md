# Between the Lines

A personal reading journal built with **React + Vite**, **FastAPI + Pydantic**, and **MySQL**. Search Open Library, collect books on a wooden bookshelf, and save reading status, ratings, favourite quotes, and notes. Each reader's shelf is private. There is no seeded or fake bookshelf data.

## Simple project map

```text
backend/
  main.py          API routes
  database.py      MySQL connection
  models.py        Database tables
  schemas.py       Pydantic input validation
  auth.py          Passwords and login cookies
  tests/           API tests
frontend/src/
  main.jsx         App routes
  AuthPage.jsx     Login and signup forms
  AuthContext.jsx  Current user and login/logout
  Bookshelf.jsx    Shelf, counts, filters, and reading goal
  BookDetails.jsx  Journal editor and book completion tracker
  SearchModal.jsx  Find and add books
  components.jsx  Shared UI pieces
  api.js           Fetch requests to FastAPI
  styles.css       Shared styles, backgrounds, forms, and progress bars
  AuthPage.css     Login/signup and bookshelf illustration
  Bookshelf.css    Dashboard and reading goal
  BookDetails.css  Journal and page tracker
  SearchModal.css  Book search dialog
```

There are no extra service layers, custom state libraries, or nested feature folders. The shelf counts are calculated from loaded books, and adding a book updates that list directly instead of fetching it again.

## Reading goal (frontend only)

On your bookshelf, enter a target under **Books to finish** and click **Set goal**. The progress bar uses the total books currently marked **Finished**, across all years. Changing a book's status updates progress when you return to the shelf. Filtering or searching your shelf does not change the goal count. The bar stops at 100% when you reach or exceed your target.

The target is saved in browser `localStorage`, using your account ID as part of the key. It survives refresh and logout, but does not sync across browsers or devices. Clearing site data removes it. No goal data is sent to FastAPI or MySQL. We do not label this as a yearly goal because books do not store finish dates.

## Book completion (frontend only)

Open a book, enter **Current page** and **Total pages**, then click **Save progress**. The completion bar displays pages read as a percentage. Current page can be zero but cannot exceed the total. Page counts are stored in browser `localStorage` separately for each account and book, so they survive refresh but do not sync to MySQL or other devices. Page completion does not automatically change the saved reading status; use the existing status dropdown and **Save changes** for that.

## Setup (macOS)

You need Python **3.10 or newer**, Node.js **20.19 or newer** (a current LTS is fine), and MySQL **8 or newer**. Use two terminal windows: one for FastAPI, one for Vite. Keep both running while using the app.

### 1. Install and start MySQL

If you use Homebrew:

```bash
brew install mysql
brew services start mysql
mysql -u root
```

If your root user already has a password, use `mysql -u root -p` instead. You can also install MySQL from its official macOS installer and run the same SQL below in MySQL Workbench.

At the `mysql>` prompt:

```sql
CREATE DATABASE between_the_lines CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'reading_app'@'localhost' IDENTIFIED BY 'choose-your-own-database-password';
GRANT ALL PRIVILEGES ON between_the_lines.* TO 'reading_app'@'localhost';
EXIT;
```

This creates an empty database and a user allowed to access only this database. FastAPI creates the `users` and `books` tables automatically on first startup. No separate table creation command is needed.

### 2. Configure and run the backend

From the project folder:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python -c "import secrets; print(secrets.token_hex(32))"
```

Open `backend/.env` in your editor. Set `DB_PASSWORD` to the database password chosen above. Paste the generated random string into `JWT_SECRET`. Keep the other settings as shown unless your MySQL server uses a different host or port.

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_NAME=between_the_lines
DB_USER=reading_app
DB_PASSWORD=choose-your-own-database-password
JWT_SECRET=paste-the-random-string-here
FRONTEND_ORIGIN=http://localhost:5173
COOKIE_SECURE=false
```

Do not commit `.env` or share its contents. The app deliberately refuses to start without a real JWT secret. Passwords with special characters work because the database URL is built with SQLAlchemy's `URL.create`, rather than joining a URL string by hand.

Run:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). Health check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health).

For later sessions, activate the virtual environment and run the same `uvicorn` command. Tables are retained between restarts.

### 3. Run the frontend

In a **second terminal**, from the project folder:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)**. Use this exact hostname; don't switch between `localhost` and `127.0.0.1` in your browser, because cookies are tied to hostnames and the allowed frontend origin must match.

The frontend `.env` points Vite at `http://127.0.0.1:8000`. Vite forwards requests beginning with `/api` to FastAPI. Restart Vite if you change this file. No API keys or database credentials belong in frontend code.

### 4. Try the complete flow

1. Create an account with your name, email, and a password of at least eight characters. Signup also logs you in.
2. Click **Add a book** and search by title or author.
3. Add a result, close search, and open its cover on your shelf.
4. Choose a reading status, give it a star rating, and write a quote or notes. Click **Save changes**.
5. Refresh. Your login cookie restores your account and the shelf is loaded from MySQL again.
6. Log out and log in again. Your journal entries remain saved.
7. Create a second account to see that it has its own separate shelf.

Deleting a book requires confirmation and also deletes its saved journal entry. Rating `0` means “not rated”; use **Clear** to remove a rating. Shelf search, filters, and sorting operate on the books already loaded from your database. Search in the Add a book dialog calls Open Library.

## Book search (Open Library)

Search and covers now use **Open Library**, with no API key required. The app opens directly on the login page; a reader who is already signed in goes to their shelf.

The backend calls `https://openlibrary.org/search.json` with the title or author you enter and asks for only the fields the UI needs. Covers use `https://covers.openlibrary.org`. Missing metadata and missing covers have fallbacks.

The existing `google_books_id` database column and JSON field are kept to preserve saved books without a database migration. New entries use IDs like `ol:OL66554W`. Older saved Google books remain readable and editable. This is just a legacy field name; Google Books is no longer called and `GOOGLE_BOOKS_API_KEY` can be removed from your local `.env`.

Reference: [Open Library Search API](https://openlibrary.org/dev/docs/api/search).

## How the backend works

Read these files in order:

| File | Purpose |
| --- | --- |
| `backend/database.py` | Reads environment settings, opens a connection pool, gives each request a database session. |
| `backend/models.py` | Describes the actual MySQL `users` and `books` tables. |
| `backend/schemas.py` | Pydantic models validate incoming JSON and control outgoing JSON. |
| `backend/auth.py` | Hashes passwords and signs/checks the login cookie. |
| `backend/main.py` | Plain endpoint functions: read input, check user, query database, return result. |
| `frontend/src/api.js` | The small `fetch` wrapper that connects React to FastAPI. |
| `frontend/src/AuthContext.jsx` | Remembers the current user's public details and restores login after refresh. |
| `frontend/src/main.jsx` | App layout and React Router routes. |
| `frontend/src/AuthPage.jsx` | Signup and login forms. |
| `frontend/src/Bookshelf.jsx` | Saved books, statistics, filters, and sorting. |
| `frontend/src/SearchModal.jsx` | Open Library search and adding a result to your shelf. |
| `frontend/src/BookDetails.jsx` | Reading status, rating, quote, notes, and deletion. |
| `frontend/src/components.jsx` | Small shared UI pieces, cover fallback, and protected route wrapper. |

**SQLAlchemy is the database translator.** `db.add(book)` prepares an INSERT. `db.commit()` saves the transaction. `select(Book).where(...)` prepares a SELECT. `db.refresh(book)` reads database-generated fields such as the ID. A session is closed when the request finishes. Values are bound as parameters rather than inserted into raw SQL strings.

**Pydantic is the input checker.** For example, `BookUpdate.rating` must be an integer from 0 through 5 and `status` must be one of three known strings. Invalid input returns HTTP 422 before the endpoint updates anything. Signup also checks email format and matching passwords.

**Password hashing:** an Argon2 hash is stored instead of the password. On login, `password_hasher.verify` checks the entered password against that hash. Passwords and hashes are never returned to React.

**JWT, explained:** after a successful login, FastAPI creates a signed token containing the user ID, expiry, and a login version. The signature proves that the server issued it; a JWT is signed, not encrypted, so it contains no secrets such as passwords. The token expires after 24 hours.

**Where the token lives:** FastAPI sets an HttpOnly, SameSite=Lax cookie. JavaScript cannot read it. `fetch(..., { credentials: 'include' })` lets the browser send it. The backend's `current_user` dependency validates the token, finds the user in MySQL, and passes that user into protected endpoints. React stores only public user details in memory, and calls `/api/auth/me` on refresh. It does not store tokens in localStorage.

**Logout:** the server increments `users.token_version` and clears the cookie. Older JWTs then fail validation. This deliberately logs out that reader's other browser sessions too, avoiding a third token table.

**Ownership:** every book lookup includes both `book.id` and `book.owner_id == current_user.id`. An ID belonging to someone else returns 404, and list/statistics endpoints also filter by owner. An account may save a particular catalog book once; different accounts can each save it.

**Integration example:** clicking Save changes calls `api('/books/12', {method: 'PUT', body: JSON.stringify(form)})`. Vite forwards it to FastAPI. FastAPI validates the cookie and Pydantic input, finds book 12 belonging to this user, commits the changes to MySQL, and returns the updated book. React then shows the success message.

Authentication reference: [FastAPI's password hashing and JWT guide](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/). This project uses JSON login input and a cookie rather than the tutorial's bearer-header form, so the React flow stays straightforward.

## API reference

All routes except signup, login, and health require the login cookie. Signup and login accept JSON; there is no OAuth provider or Google sign-in. Open Library search is independent of account authentication.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | `{name, email, password, confirm_password}`; returns user and sets cookie |
| POST | `/api/auth/login` | `{email, password}`; returns user and sets cookie |
| POST | `/api/auth/logout` | Invalidates existing sessions and clears cookie |
| GET | `/api/auth/me` | Returns `{id, name, email}` |
| GET | `/api/books` | Lists this user's books |
| POST | `/api/books` | Adds `{google_books_id, title, author, genre, cover_url}` |
| GET | `/api/books/{id}` | Reads one owned book |
| PUT | `/api/books/{id}` | Saves `{status, rating, favourite_quote, notes}` |
| DELETE | `/api/books/{id}` | Deletes one owned book |
| GET | `/api/stats` | Returns total and the three status counts |
| GET | `/api/search?q=...` | Searches Open Library by title or author |

Allowed statuses: `want_to_read`, `currently_reading`, `finished`.

## Tests and frontend build

From `backend`, with the virtual environment active:

```bash
python -m pytest -q
```

Tests use a temporary in-memory SQLite database **only for tests**, so they need no MySQL credentials and do not touch your data. They cover password hashing, signup validation, duplicate email handling, login/logout, invalid tokens, book ownership for read/update/delete, saved journal data across login, rating validation, statistics, duplicate books, cross-origin writes, and mocked Open Library search/errors. MySQL remains the real app database; SQLite tests do not verify MySQL connectivity or server-specific behavior.

From `frontend`:

```bash
npm run build
```

This checks that the frontend compiles and creates `frontend/dist`. For everyday local use, use `npm run dev`. Deployment is intentionally outside this project's scope. Vite's production preview does not provide this development API proxy; a deployed app needs its server to forward `/api` to FastAPI, plus HTTPS and `COOKIE_SECURE=true`. Do not publish `dist` alone and expect its API to work.

## Troubleshooting

- **Access denied for MySQL:** check `DB_USER`/`DB_PASSWORD` and that the MySQL user was created on the correct host.
- **Connection refused:** start MySQL, then FastAPI, then Vite. Check ports 3306, 8000, and 5173.
- **Unknown database:** run the `CREATE DATABASE` command first.
- **JWT secret error:** generate a real secret and replace the example text. Changing it logs out existing sessions.
- **Origin not allowed / login does not stick:** open `http://localhost:5173`, set the same value in `FRONTEND_ORIGIN`, keep `COOKIE_SECURE=false` for local HTTP, and restart FastAPI.
- **Open Library unavailable:** check your internet connection and try again shortly. No API key is needed. Saved journal entries remain usable.
- **Tables after code changes:** automatic table creation does not alter existing columns. This initial project does not introduce a migration library. Back up data before any manual schema changes.
- **Missing covers/fonts:** covers have a designed fallback; fonts also fall back to system serif and sans-serif fonts if Google Fonts is unavailable.

The code is a learning-focused local application. Before opening registration to the public, add login/signup rate limits and an account recovery flow appropriate to your hosting setup.
