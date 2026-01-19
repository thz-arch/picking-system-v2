// UI and Audio Utilities
function showLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.top = '20px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';

  let bg = '#388e3c'; // success green
  if (type === 'error') bg = '#d32f2f'; // error red
  if (type === 'warning') bg = '#f57c00'; // warning orange

  toast.style.background = bg;
  toast.style.color = '#fff';
  toast.style.padding = '10px 24px';
  toast.style.borderRadius = '8px';
  toast.style.zIndex = '10000';
  toast.style.fontSize = '1.1em';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  document.body.appendChild(toast);

  if (type === 'error' || type === 'warning') {
    tocarAlerta();
  }

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    setTimeout(() => toast.remove(), 500);
  }, 2000);
}

function tocarAlerta() {
  const alertAudio = document.getElementById('alertSound');
  if (alertAudio) {
    alertAudio.currentTime = 0;
    alertAudio.play().catch(e => console.warn('Audio play blocked:', e));
  }
}

function ensureBipInputFocus(delay = 10) {
  setTimeout(() => {
    const bipInput = document.getElementById('inputBipagemGlobal');
    const telaSeparacao = document.getElementById('telaSeparacao');
    if (bipInput && telaSeparacao && telaSeparacao.style.display !== 'none') {
      bipInput.focus();
    }
  }, delay);
}
