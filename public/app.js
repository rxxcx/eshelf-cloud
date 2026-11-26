// Talks to the Express API on the same server. Relative URLs (/api/books)
// work both on localhost and on Render with no changes.

const form = document.getElementById('book-form');
const list = document.getElementById('book-list');
const formMsg = document.getElementById('form-msg');
const listMsg = document.getElementById('list-msg');
const count = document.getElementById('book-count');
const saveBtn = form.querySelector('button[type="submit"]');
const COLUMNS = 8;

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

function actionButton(label, action, book, disabled) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-small' + (action === 'return' ? ' btn-outline' : '');
  btn.textContent = label;
  btn.dataset.action = action;
  btn.dataset.id = book.id;
  btn.dataset.title = book.title;
  btn.disabled = disabled;
  return btn;
}

async function loadBooks() {
  try {
    const res = await fetch('/api/books');
    if (!res.ok) throw new Error(`Server answered ${res.status}`);
    const books = await res.json();

    list.innerHTML = '';
    count.textContent = `(${books.length})`;

    if (books.length === 0) {
      list.appendChild(messageRow('No books yet. Add one above.'));
      return;
    }

    books.forEach((b) => {
      const tr = document.createElement('tr');

      const available = cell(`${b.available_copies} of ${b.copies}`);
      if (b.available_copies === 0) available.className = 'none-left';

      const actions = document.createElement('td');
      actions.className = 'actions';
      actions.append(
        actionButton('Borrow', 'borrow', b, b.available_copies === 0),
        actionButton('Return', 'return', b, b.available_copies === b.copies)
      );

      tr.append(
        cell(b.id),
        cell(b.title),
        cell(b.author),
        cell(b.category || '-'),
        cell(b.isbn || '-'),
        available,
        cell(new Date(b.created_at).toLocaleString()),
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

// Add a book
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    title: document.getElementById('title').value,
    author: document.getElementById('author').value,
    category: document.getElementById('category').value,
    isbn: document.getElementById('isbn').value,
    copies: document.getElementById('copies').value,
  };

  saveBtn.disabled = true;
  try {
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (res.status === 201) {
      showMessage(formMsg, `Saved "${data.title}" (book #${data.id}).`, 'success');
      form.reset();
      loadBooks();
    } else {
      // 400 responses list every problem in data.errors
      showMessage(formMsg, data.errors ? data.errors.join(', ') : data.error, 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage(formMsg, 'Could not reach the server.', 'error');
  } finally {
    saveBtn.disabled = false;
  }
});

// Borrow / Return buttons (one listener for the whole table)
list.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const { action, id, title } = btn.dataset;

  btn.disabled = true;
  try {
    const res = await fetch(`/api/books/${id}/${action}`, { method: 'POST' });
    const data = await res.json();

    if (res.status === 200) {
      const verb = action === 'borrow' ? 'Borrowed' : 'Returned';
      showMessage(
        listMsg,
        `${verb} a copy of "${title}". ${data.available_copies} of ${data.copies} now available.`,
        'success'
      );
    } else {
      // 409 = the rule said no (none left / all already returned), 404 = book is gone
      showMessage(listMsg, data.error, 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage(listMsg, 'Could not reach the server.', 'error');
  }
  loadBooks();
});

loadBooks();
