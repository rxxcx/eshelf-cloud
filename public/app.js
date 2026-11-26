// Talks to the Express API on the same server. Relative URLs (/api/books)
// work both on localhost and on Render with no changes.

const form = document.getElementById('book-form');
const formCard = document.getElementById('form-card');
const formTitle = document.getElementById('form-title');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const list = document.getElementById('book-list');
const formMsg = document.getElementById('form-msg');
const listMsg = document.getElementById('list-msg');
const count = document.getElementById('book-count');
const COLUMNS = 8;
const FIELDS = ['title', 'author', 'category', 'isbn', 'copies'];

let booksById = new Map(); // the books currently shown, for filling the edit form
let editingId = null; // null = the form adds a new book

function showMessage(el, text, type) {
  el.textContent = text;
  el.className = type;
}

// Build a table cell with textContent (not innerHTML) so user input can't inject HTML
function cell(text) {
  const td = document.createElement('td');
  td.textContent = text ?? '';
  return td;
}

function messageRow(text) {
  const tr = document.createElement('tr');
  const td = cell(text);
  td.colSpan = COLUMNS;
  td.className = 'empty';
  tr.appendChild(td);
  return tr;
}

function actionButton(label, action, book, style, disabled = false) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn btn-small ${style}`;
  btn.textContent = label;
  btn.dataset.action = action;
  btn.dataset.id = book.id;
  btn.disabled = disabled;
  return btn;
}

// ---------- List ----------

async function loadBooks() {
  try {
    const res = await fetch('/api/books');
    if (!res.ok) throw new Error(`Server answered ${res.status}`);
    const books = await res.json();

    booksById = new Map(books.map((b) => [String(b.id), b]));
    list.innerHTML = '';
    count.textContent = `(${books.length})`;

    if (books.length === 0) {
      list.appendChild(messageRow('No books yet. Add one above.'));
      return;
    }

    books.forEach((b) => {
      const tr = document.createElement('tr');
      if (String(b.id) === editingId) tr.className = 'editing';

      const available = cell(`${b.available_copies} of ${b.copies}`);
      if (b.available_copies === 0) available.className = 'none-left';

      const actions = document.createElement('td');
      actions.className = 'actions';
      actions.append(
        actionButton('Borrow', 'borrow', b, '', b.available_copies === 0),
        actionButton('Return', 'return', b, 'btn-outline', b.available_copies === b.copies),
        actionButton('Edit', 'edit', b, 'btn-link'),
        actionButton('Delete', 'delete', b, 'btn-link btn-danger')
      );

      tr.append(
        cell(b.id),
        cell(b.title),
        cell(b.author),
        cell(b.category || '-'),
        cell(b.isbn || '-'),
        available,
        cell(new Date(b.created_at).toLocaleDateString()),
        actions
      );
      list.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    count.textContent = '';
    list.innerHTML = '';
    list.appendChild(messageRow('Could not load books. Check the server logs.'));
  }
}

// ---------- Add / edit form ----------

function startEdit(book) {
  editingId = String(book.id);
  FIELDS.forEach((f) => {
    document.getElementById(f).value = book[f] ?? '';
  });
  formTitle.textContent = `Edit book #${book.id}`;
  saveBtn.textContent = 'Save changes';
  cancelBtn.hidden = false;
  showMessage(formMsg, '', '');
  formCard.scrollIntoView({ behavior: 'smooth' });
  document.getElementById('title').focus({ preventScroll: true });
  loadBooks(); // highlight the row being edited
}

function stopEdit() {
  editingId = null;
  form.reset();
  formTitle.textContent = 'Add a book';
  saveBtn.textContent = 'Save book';
  cancelBtn.hidden = true;
}

cancelBtn.addEventListener('click', () => {
  stopEdit();
  showMessage(formMsg, '', '');
  loadBooks();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(FIELDS.map((f) => [f, document.getElementById(f).value]));
  const editing = editingId !== null;

  saveBtn.disabled = true;
  try {
    const res = await fetch(editing ? `/api/books/${editingId}` : '/api/books', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (res.status === 201 || res.status === 200) {
      const what = editing ? 'Updated' : 'Saved';
      showMessage(formMsg, `${what} "${data.title}" (book #${data.id}).`, 'success');
      stopEdit();
      loadBooks();
    } else {
      // 400 lists every problem in data.errors; 404/409 send one data.error
      showMessage(formMsg, data.errors ? data.errors.join(', ') : data.error, 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage(formMsg, 'Could not reach the server.', 'error');
  } finally {
    saveBtn.disabled = false;
  }
});

// ---------- Row buttons (one listener for the whole table) ----------

async function borrowOrReturn(action, book) {
  const res = await fetch(`/api/books/${book.id}/${action}`, { method: 'POST' });
  const data = await res.json();
  if (res.status === 200) {
    const verb = action === 'borrow' ? 'Borrowed' : 'Returned';
    showMessage(
      listMsg,
      `${verb} a copy of "${book.title}". ${data.available_copies} of ${data.copies} now available.`,
      'success'
    );
  } else {
    // 409 = the rule said no (none left / all already returned), 404 = book is gone
    showMessage(listMsg, data.error, 'error');
  }
}

async function deleteBook(book) {
  if (!confirm(`Delete "${book.title}"? This can't be undone.`)) return;
  const res = await fetch(`/api/books/${book.id}`, { method: 'DELETE' });
  if (res.status === 204) {
    // 204 No Content: deleted, and the response has no body to read
    showMessage(listMsg, `Deleted "${book.title}".`, 'success');
    if (editingId === String(book.id)) stopEdit();
  } else {
    // 409 = copies still borrowed, 404 = already gone
    const data = await res.json();
    showMessage(listMsg, data.error, 'error');
  }
}

list.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const book = booksById.get(btn.dataset.id);
  if (!book) return;

  if (btn.dataset.action === 'edit') {
    startEdit(book);
    return;
  }

  btn.disabled = true;
  try {
    if (btn.dataset.action === 'delete') {
      await deleteBook(book);
    } else {
      await borrowOrReturn(btn.dataset.action, book);
    }
  } catch (err) {
    console.error(err);
    showMessage(listMsg, 'Could not reach the server.', 'error');
  }
  loadBooks();
});

loadBooks();
