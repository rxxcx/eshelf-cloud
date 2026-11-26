// Talks to the Express API on the same server. Relative URLs (/api/books)
// work both on localhost and on Render with no changes.

const form = document.getElementById('book-form');
const list = document.getElementById('book-list');
const msg = document.getElementById('form-msg');
const count = document.getElementById('book-count');
const saveBtn = form.querySelector('button[type="submit"]');

function showMessage(text, type) {
  msg.textContent = text;
  msg.className = type;
}

// Build a table cell with textContent (not innerHTML) so user input can't inject HTML
function cell(text) {
  const td = document.createElement('td');
  td.textContent = text ?? '';
  return td;
}

async function loadBooks() {
  try {
    const res = await fetch('/api/books');
    if (!res.ok) throw new Error(`Server answered ${res.status}`);
    const books = await res.json();

    list.innerHTML = '';
    count.textContent = `(${books.length})`;

    if (books.length === 0) {
      const tr = document.createElement('tr');
      const td = cell('No books yet. Add one above.');
      td.colSpan = 7;
      td.className = 'empty';
      tr.appendChild(td);
      list.appendChild(tr);
      return;
    }

    books.forEach((b) => {
      const tr = document.createElement('tr');
      tr.append(
        cell(b.id),
        cell(b.title),
        cell(b.author),
        cell(b.category || '-'),
        cell(b.isbn || '-'),
        cell(b.copies),
        cell(new Date(b.created_at).toLocaleString())
      );
      list.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    count.textContent = '';
    list.innerHTML = '';
    const tr = document.createElement('tr');
    const td = cell('Could not load books. Check the server logs.');
    td.colSpan = 7;
    td.className = 'empty';
    tr.appendChild(td);
    list.appendChild(tr);
  }
}

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
      showMessage(`Saved "${data.title}" (book #${data.id}).`, 'success');
      form.reset();
      loadBooks();
    } else {
      // 400 responses list every problem in data.errors
      showMessage(data.errors ? data.errors.join(', ') : data.error, 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage('Could not reach the server.', 'error');
  } finally {
    saveBtn.disabled = false;
  }
});

loadBooks();
