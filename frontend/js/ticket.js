const token = sessionStorage.getItem('token');
let user = null;
try {
  user = JSON.parse(sessionStorage.getItem('user'));
} catch (err) {
  user = null;
}

const errorBox = document.getElementById('form-error');
const message = document.getElementById('status-message');
const details = document.getElementById('ticket-details');
const commentsSection = document.getElementById('comments-section');
const commentsMessage = document.getElementById('comments-message');
const commentList = document.getElementById('comment-list');
const commentForm = document.getElementById('comment-form');
const commentBody = document.getElementById('comment-body');
const commentError = document.getElementById('comment-error');
const commentSubmit = document.getElementById('comment-submit');
const ticketId = new URLSearchParams(window.location.search).get('id');
const commentsUrl = `${API_BASE}/api/tickets/${encodeURIComponent(ticketId)}/comments`;

function goToLogin() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  window.location.href = 'login.html';
}

function showError(text) {
  errorBox.textContent = text;
  errorBox.hidden = false;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function setText(id, value, fallback = '-') {
  document.getElementById(id).textContent = value ?? fallback;
}

function setBadge(id, value) {
  const badge = document.getElementById(id);
  const text = value || 'Unknown';
  const kind = String(text).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '');
  badge.className = `badge badge-${kind}`;
  badge.textContent = text;
}

function renderTicket(ticket) {
  setText('ticket-title', ticket.title, 'Untitled ticket');
  setText('ticket-id', ticket.id);
  setText('ticket-category', ticket.category);
  setText('ticket-created', formatDate(ticket.created_at));
  setText('ticket-due', formatDate(ticket.due_at));
  setText('ticket-description', ticket.description, 'No description provided.');
  setBadge('ticket-status', ticket.status);
  setBadge('ticket-priority', ticket.priority);
  details.hidden = false;
}

function renderComments(comments) {
  commentList.replaceChildren();

  if (comments.length === 0) {
    commentsMessage.textContent = 'No comments yet.';
    commentsMessage.hidden = false;
    return;
  }

  commentsMessage.hidden = true;
  for (const comment of comments) {
    const item = document.createElement('li');
    item.className = 'comment-card';

    const header = document.createElement('div');
    header.className = 'comment-header';
    const author = document.createElement('strong');
    author.textContent = comment.author_name
      || comment.user_name
      || comment.author?.name
      || comment.user?.name
      || 'User';
    const date = document.createElement('time');
    date.dateTime = comment.created_at || '';
    date.textContent = formatDate(comment.created_at);
    header.append(author, date);

    const body = document.createElement('p');
    body.textContent = comment.body || '';
    item.append(header, body);
    commentList.appendChild(item);
  }
}

async function loadComments() {
  commentError.hidden = true;
  commentsMessage.textContent = 'Loading comments...';
  commentsMessage.hidden = false;
  commentList.replaceChildren();

  try {
    const comments = await fetchJson(commentsUrl);
    if (comments === null) return false;

    const commentData = Array.isArray(comments) ? comments : comments?.comments;
    if (!Array.isArray(commentData)) {
      throw new Error('The server returned invalid comments.');
    }

    renderComments(commentData);
    return true;
  } catch (err) {
    commentsMessage.hidden = true;
    commentError.textContent = err.message || 'Could not load comments.';
    commentError.hidden = false;
    return false;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    goToLogin();
    return null;
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.message || 'The server could not load this information.');
    error.status = response.status;
    throw error;
  }

  return body.data;
}

async function loadTicket() {
  errorBox.hidden = true;
  message.hidden = false;
  details.hidden = true;
  commentsSection.hidden = true;
  commentList.replaceChildren();

  try {
    const data = await fetchJson(`${API_BASE}/api/tickets/${encodeURIComponent(ticketId)}`);
    if (!data) return;

    const ticket = data.ticket || data;
    if (!ticket || typeof ticket !== 'object' || Array.isArray(ticket)) {
      throw new Error('The server returned an invalid ticket.');
    }

    renderTicket(ticket);
    commentsSection.hidden = false;

    if (Array.isArray(data.comments)) {
      renderComments(data.comments);
    } else {
      await loadComments();
    }

    message.hidden = true;
  } catch (err) {
    message.hidden = true;
    if (err.status === 404) {
      showError('Ticket not found.');
      return;
    }
    showError(err.message || 'Could not load this ticket.');
  }
}

commentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  commentError.hidden = true;
  const body = commentBody.value.trim();
  if (!body) {
    commentError.textContent = 'Enter a comment before posting.';
    commentError.hidden = false;
    return;
  }

  commentSubmit.disabled = true;

  try {
    const response = await fetch(commentsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    });

    if (response.status === 401) {
      goToLogin();
      return;
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error?.message || 'Could not post your comment.');
    }

    commentForm.reset();
    await loadComments();
  } catch (err) {
    commentError.textContent = err.message || 'Could not post your comment.';
    commentError.hidden = false;
  } finally {
    commentSubmit.disabled = false;
  }
});

if (!token || !user) {
  goToLogin();
} else {
  document.getElementById('user-info').textContent = `${user.name} (${user.role})`;
  document.getElementById('logout-button').addEventListener('click', goToLogin);

  if (!ticketId || !/^\d+$/.test(ticketId) || Number(ticketId) < 1) {
    message.hidden = true;
    showError('A valid ticket ID is required.');
  } else {
    loadTicket();
  }
}
