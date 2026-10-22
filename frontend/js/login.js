const form = document.getElementById('login-form');
const errorBox = document.getElementById('form-error');
const submitButton = form.querySelector('button[type="submit"]');

function showError(message) {
  errorBox.textContent = message; // textContent, never innerHTML
  errorBox.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  submitButton.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email.value,
        password: form.password.value,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      showError(data.error?.message || 'Login failed. Please try again.');
      return;
    }

       const token = data.token;
       const user = data.user;
       const validRoles = ['staff', 'support', 'admin'];
       const looksValid =
         typeof token === 'string' &&
         token.split('.').length === 3 &&
         token.split('.').every((part) => part.length > 0) &&
         user !== null &&
         typeof user === 'object' &&
         typeof user.name === 'string' &&
         validRoles.includes(user.role);

    if (!looksValid) {
      showError('Unexpected response from the server. Please try again.');
      return;
    }

    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(user));
    window.location.href = 'tickets.html';
  } catch (err) {
    showError('Cannot reach the server. Check that the backend is running.');
  } finally {
    submitButton.disabled = false;
  }
});