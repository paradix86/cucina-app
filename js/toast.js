/**
 * toast.js — lightweight stacked toast notifications
 */

let toastCounter = 0;

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container || !message) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.dataset.toastId = `toast-${Date.now()}-${toastCounter++}`;

  const text = document.createElement('div');
  text.className = 'toast-text';
  text.textContent = message;
  toast.appendChild(text);

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  const dismiss = () => {
    toast.classList.remove('is-visible');
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 220);
  };

  const timeoutId = setTimeout(dismiss, 3200);
  toast.addEventListener('click', () => {
    clearTimeout(timeoutId);
    dismiss();
  }, { once: true });
}
