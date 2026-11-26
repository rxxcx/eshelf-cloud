require('dotenv').config({ quiet: true });
const path = require('path');
const express = require('express');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000; // Render sets PORT for you

// ---------- Middleware ----------
app.use(express.json()); // parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // serve the frontend

// Malformed JSON (e.g. a missing quote in Postman) -> 400 instead of a crash
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  next(err);
});

// ---------- Validation ----------
// Returns { errors, book }. errors is empty when the input is valid.
function validateBook(body) {
  const { title, author, category, isbn, copies } = body || {};
  const errors = [];

  if (typeof title !== 'string' || title.trim() === '') {
    errors.push('title is required');
  } else if (title.trim().length > 200) {
    errors.push('title must be 200 characters or fewer');
  }

  if (typeof author !== 'string' || author.trim() === '') {
    errors.push('author is required');
  } else if (author.trim().length > 150) {
    errors.push('author must be 150 characters or fewer');
  }

  if (category !== undefined && category !== null && typeof category !== 'string') {
    errors.push('category must be text');
  } else if (category && category.trim().length > 100) {
    errors.push('category must be 100 characters or fewer');
  }

  // ISBN is optional. If given, it must be 10 or 13 characters once dashes and spaces are removed.
  let cleanIsbn = null;
  if (isbn !== undefined && isbn !== null && isbn !== '') {
    cleanIsbn = typeof isbn === 'string' ? isbn.replace(/[-\s]/g, '').toUpperCase() : '';
    if (!/^(\d{9}[\dX]|\d{13})$/.test(cleanIsbn)) {
      errors.push('isbn must be 10 or 13 digits (dashes allowed)');
    }
  }

  // copies is optional and defaults to 1. Accept 3 or "3", but not 2.5 or "abc".
  let numCopies = 1;
  if (copies !== undefined && copies !== null && copies !== '') {
    numCopies = Number(copies);
    if (!Number.isInteger(numCopies) || numCopies < 1 || numCopies > 100) {
      errors.push('copies must be a whole number from 1 to 100');
    }
  }

  return {
    errors,
    book: {
      title: typeof title === 'string' ? title.trim() : title,
      author: typeof author === 'string' ? author.trim() : author,
      category: typeof category === 'string' && category.trim() !== '' ? category.trim() : null,
      isbn: cleanIsbn,
      copies: numCopies,
    },
  };
}

// ---------- API routes ----------

// GET /api/books -> list all books, newest first (200)
app.get('/api/books', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM books ORDER BY created_at DESC, id DESC');
    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/books/:id -> one book (200), bad id (400), not found (404)
app.get('/api/books/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'id must be a positive whole number' });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM books WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: `No book with id ${id}` });
    }
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/books -> add a book (201), invalid input (400)
app.post('/api/books', async (req, res) => {
  const { errors, book } = validateBook(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO books (title, author, category, isbn, copies)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [book.title, book.author, book.category, book.isbn, book.copies]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Unknown /api route -> 404 JSON
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ---------- Startup ----------
// Creates the table on first run, so you never need a SQL client.
const createTable = `
  CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    author VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    isbn VARCHAR(13),
    copies INTEGER NOT NULL DEFAULT 1 CHECK (copies BETWEEN 1 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

pool
  .query(createTable)
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Could not connect to the database:', err.message);
    process.exit(1);
  });
