const token = sessionStorage.getItem('token');

const form = document.getElementById('create-ticket-form');
const errorBox = document.getElementById('form-error');
const statusMessage = document.getElementById('status-message');
const submitButton = document.getElementById('submit-button');

function goToLogin() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  window.location.href = 'login.html';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  errorBox.hidden = true;
  statusMessage.hidden = true;

  if (!token) {
    goToLogin();
    return;
  }

  const ticket = {
    title: document.getElementById('title').value.trim(),
    description: document.getElementById('description').value.trim(),
    category: document.getElementById('category').value,
    priority: document.getElementById('priority').value
  };

  submitButton.disabled = true;
  submitButton.textContent = 'Creating...';

  try {
    const response = await fetch(`${API_BASE}/api/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(ticket)
    });

    const body = await response.json().catch(() => ({}));

    if (response.status === 401) {
      goToLogin();
      return;
    }

    if (!response.ok) {
      errorBox.textContent =
        body.error?.message || 'Could not create the ticket.';
      errorBox.hidden = false;
      return;
    }

    statusMessage.textContent = 'Ticket created successfully!';
    statusMessage.hidden = false;

    window.location.href = 'tickets.html';
  } catch (error) {
    errorBox.textContent =
      'Cannot reach the server. Check that the backend is running.';
    errorBox.hidden = false;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Create Ticket';
  }
});

if (!token) {
  goToLogin();
}