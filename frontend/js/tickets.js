const PAGE_SIZE = 10;
const token = sessionStorage.getItem('token');
let user = null;
try {
  user = JSON.parse(sessionStorage.getItem('user'));
} catch (err) {
  user = null;
}

const errorBox = document.getElementById('form-error');
const message = document.getElementById('status-message');
const table = document.getElementById('ticket-table');
const rows = document.getElementById('ticket-rows');
const pager = document.getElementById('pager');
const pageInfo = document.getElementById('page-info');
const prevButton = document.getElementById('prev-button');
const nextButton = document.getElementById('next-button');
const statusFilter = document.getElementById('status-filter');
const priorityFilter = document.getElementById('priority-filter');

let currentPage = 1;
let totalPages = 1;

function goToLogin() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  window.location.href = 'login.html';
}

function showError(text) {
  errorBox.textContent = text; // textContent, never innerHTML
  errorBox.hidden = false;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-';
}

function addCell(row, text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  row.appendChild(cell);
  return cell;
}

function addBadge(row, text) {
  const cell = document.createElement('td');
  const badge = document.createElement('span');
  const kind = String(text).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '');
  badge.className = `badge badge-${kind}`;
  badge.textContent = text;
  cell.appendChild(badge);
  row.appendChild(cell);
}

function renderTickets(tickets) {
  rows.replaceChildren();
  for (const ticket of tickets) {
    const row = document.createElement('tr');
    const idCell = document.createElement('td');
    const detailLink = document.createElement('a');
    detailLink.href = `ticket.html?id=${encodeURIComponent(ticket.id)}`;
    detailLink.textContent = ticket.id;
    detailLink.className = 'ticket-detail-link';
    idCell.appendChild(detailLink);
    row.appendChild(idCell);
    const titleCell = document.createElement('td');
    const titleLink = document.createElement('a');
    titleLink.href = detailLink.href;
    titleLink.textContent = ticket.title;
    titleLink.className = 'ticket-detail-link';
    titleCell.appendChild(titleLink);
    row.appendChild(titleCell);
    addCell(row, ticket.category);
    addBadge(row, ticket.priority);
    addBadge(row, ticket.status);
    addCell(row, formatDate(ticket.created_at));
    addCell(row, formatDate(ticket.due_at));
    rows.appendChild(row);
  }
}

async function loadTickets() {
  errorBox.hidden = true;
  message.textContent = 'Loading tickets...';
  message.hidden = false;
  table.hidden = true;
  pager.hidden = true;

  const params = new URLSearchParams({ page: currentPage, limit: PAGE_SIZE });
  if (statusFilter.value) params.set('status', statusFilter.value);
  if (priorityFilter.value) params.set('priority', priorityFilter.value);

  try {
    const response = await fetch(`${API_BASE}/api/tickets?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      goToLogin();
      return;
    }

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      message.hidden = true;
      showError(body.error?.message || 'Could not load tickets.');
      return;
    }

    const tickets = body.data || [];
    const meta = body.meta || { total: tickets.length, limit: PAGE_SIZE };
    totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

    if (tickets.length === 0) {
      message.textContent = 'No tickets found.';
      return;
    }

    renderTickets(tickets);
    message.hidden = true;
    table.hidden = false;
    pager.hidden = false;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
  } catch (err) {
    message.hidden = true;
    showError('Cannot reach the server. Check that the backend is running.');
  }
}

if (!token || !user) {
  goToLogin();
} else {
  document.getElementById('user-info').textContent = `${user.name} (${user.role})`;
  document.getElementById('logout-button').addEventListener('click', goToLogin);

  statusFilter.addEventListener('change', () => { currentPage = 1; loadTickets(); });
  priorityFilter.addEventListener('change', () => { currentPage = 1; loadTickets(); });
  prevButton.addEventListener('click', () => { currentPage -= 1; loadTickets(); });
  nextButton.addEventListener('click', () => { currentPage += 1; loadTickets(); });

  loadTickets();
}