/**
 * Picking Interface - Binho Transportes
 * Main logic for CTRC selection, item separation and barcode scanning.
 */

// 1. Configuration & Constants
const CONFIG = {
  API_URL: 'https://tritton.dev.br/webhook/picking-process',
  SCAN_TIMEOUT: 60,
  STORAGE_KEYS: {
    PROGRESS: 'picking_progress',
    WAS_SEPARACAO: 'picking_was_separacao',
    LOGS: 'picking_logs'
  },
  SOUNDS: {
    ALERT: 'mixkit-short-electric-fence-buzz-2966.wav'
  }
};

// 2. Global State
let state = {
  ctrcObj: null,
  pendingRestore: null
};

// 3. UI Utilities
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
  toast.style.background = type === 'success' ? '#388e3c' : '#d32f2f';
  toast.style.color = '#fff';
  toast.style.padding = '10px 24px';
  toast.style.borderRadius = '8px';
  toast.style.zIndex = '10000';
  toast.style.fontSize = '1.1em';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  document.body.appendChild(toast);

  if (type === 'error') {
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

// 4. Persistence Logic
function saveProgress() {
  try {
    if (state.ctrcObj) {
      localStorage.setItem(CONFIG.STORAGE_KEYS.PROGRESS, JSON.stringify(state.ctrcObj));
    } else {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.PROGRESS);
    }
  } catch (err) {
    console.error('[ERROR] Failed to save progress:', err);
  }
}

function loadProgress() {
  try {
    const savedProgress = localStorage.getItem(CONFIG.STORAGE_KEYS.PROGRESS);
    const wasSeparacao = !!sessionStorage.getItem(CONFIG.STORAGE_KEYS.WAS_SEPARACAO);

    if (savedProgress && wasSeparacao) {
      const saved = JSON.parse(savedProgress);
      if (saved && saved.ctrc) {
        state.ctrcObj = normalizeCtrcData(saved);
        return true;
      }
    }
  } catch (err) {
    console.error('[ERROR] Failed to load progress:', err);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.PROGRESS);
  }
  return false;
}

// 5. Data Normalization
function normalizeCtrcData(data) {
  // If it's a list with one CTRC object, unwrap it
  if (Array.isArray(data) && data.length > 0 && data[0].ctrc) {
    data = data[0];
  }
  
  // If it's a raw array of items, wrap it
  if (Array.isArray(data) && data.length > 0 && !data[0].ctrc) {
    return {
      ctrc: 'DESCONHECIDO',
      itens: data.map(normalizeItem),
      totais: calculateTotals(data)
    };
  }

  if (data && data.ctrc) {
    return {
      ctrc: data.ctrc || data.CTRC,
      remetente: data.remetente || '',
      destinatario: data.destinatario || '',
      cidade: data.cidade || '',
      prev_entrega: data.prev_entrega || '',
      status: data.status || '',
      itens: (data.itens || []).map(normalizeItem),
      totais: data.totais || calculateTotals(data.itens || [])
    };
  }
  
  return null;
}

function normalizeItem(i) {
  const quantidade = Number(i.quantidade) || 0;
  const qtd_bipada = Number(i.qtd_bipada) || 0;
  return {
    codigo: i.codigo || '',
    ean: i.ean || '',
    produto: i.produto || '',
    quantidade: quantidade,
    qtd_bipada: qtd_bipada,
    qtd_restante: Math.max(0, quantidade - qtd_bipada),
    unid: i.unid || '',
    status: (qtd_bipada === quantidade) ? 'Finalizado' : (qtd_bipada > 0 ? 'Parcial' : 'Pendente')
  };
}

function calculateTotals(itens) {
  return {
    linhas: itens.length,
    quantidade_total: itens.reduce((acc, p) => acc + (Number(p.quantidade) || 0), 0),
    qtd_bipada_total: itens.reduce((acc, p) => acc + (Number(p.qtd_bipada) || 0), 0),
    qtd_restante_total: itens.reduce((acc, p) => acc + (Math.max(0, (Number(p.quantidade) || 0) - (Number(p.qtd_bipada) || 0))), 0)
  };
}

// 6. API Calls
async function apiCall(acao, params = {}) {
  showLoading();
  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao, ...params })
    });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`[API ERROR] ${acao}:`, error);
    showToast(`Erro na comunicação com o servidor: ${error.message}`, 'error');
    return null;
  } finally {
    hideLoading();
  }
}

// 7. Rendering Logic
function renderListaCtrcs(data) {
  const listaCtrcsEl = document.getElementById('listaCtrcs');
  listaCtrcsEl.innerHTML = '';

  if (!Array.isArray(data) || data.length === 0) {
    listaCtrcsEl.innerHTML = '<li>Nenhum CTRC disponível</li>';
    return;
  }

  data.forEach(row => {
    const ctrcId = row.ctrc || row.CTRC;
    const li = document.createElement('li');
    li.className = 'ctrc-item';
    const conferente = row.conferente ? `<div style="font-size:0.85em; opacity:0.9;">Conferente: ${row.conferente}</div>` : '';
    
    const btn = document.createElement('button');
    btn.style.width = '100%';
    btn.style.marginBottom = '10px';
    btn.style.padding = '15px';
    btn.innerHTML = `<strong>${ctrcId}</strong>${conferente}`;
    btn.onclick = () => selecionarCtrc(ctrcId);
    
    li.appendChild(btn);
    listaCtrcsEl.appendChild(li);
  });
}

function renderSeparacao() {
  const { ctrcObj } = state;
  if (!ctrcObj) return;

  const dadosCtrcDiv = document.getElementById('dadosCtrc');
  const resultadoDiv = document.getElementById('resultado');

  dadosCtrcDiv.innerHTML = `
    <div><strong>CTRC:</strong> ${ctrcObj.ctrc}</div>
    <div><strong>Remetente:</strong> ${ctrcObj.remetente}</div>
    <div><strong>Destinatário:</strong> ${ctrcObj.destinatario}</div>
    <div><strong>Cidade/Previsão:</strong> ${ctrcObj.cidade} | ${ctrcObj.prev_entrega}</div>
    <div style="margin-top:5px; padding-top:5px; border-top:1px solid #eee;">
      <strong>Totais:</strong> Linhas: ${ctrcObj.totais.linhas} | Qtd: ${ctrcObj.totais.quantidade_total} |
      Bipado: <span id="totalBipado">${ctrcObj.totais.qtd_bipada_total}</span> |
      Restante: <span id="totalRestante">${ctrcObj.totais.qtd_restante_total}</span>
    </div>
  `;

  let html = `
    <div style="position:relative;">
      <input type="text" id="inputBipagemGlobal"
        style="position:absolute; opacity:0; pointer-events:none; width:1px; height:1px;"
        autocomplete="off" tabindex="-1">
    </div>
    <table id="tabelaItens">
      <thead>
        <tr>
          <th>Cod.</th>
          <th>EAN</th>
          <th>Qtd/Bip.</th>
          <th>Unid.</th>
          <th>Status</th>
          <th>Produto</th>
        </tr>
      </thead>
      <tbody>
  `;

  ctrcObj.itens.forEach(item => {
    html += renderItemRow(item);
  });

  html += `
      </tbody>
    </table>
    <div style="margin-top:20px; padding-bottom:80px;">
      <button id="btnFinalizarPicking" disabled>Finalizar Picking</button>
    </div>
  `;

  resultadoDiv.innerHTML = html;
  setupScanning();
  checkFinalizar();

  document.getElementById('btnFinalizarPicking').onclick = finalizarPicking;
}

function renderItemRow(item) {
  const percent = Math.round(((item.qtd_bipada || 0) / (item.quantidade || 1)) * 100);
  let rowClass = item.status.toLowerCase();

  return `
    <tr class="${rowClass}" data-ean="${item.ean}">
      <td>${item.codigo}</td>
      <td>${item.ean}</td>
      <td class="qtd-cell">
        ${item.qtd_bipada}/${item.quantidade}
        <div class="progress-bar-mini" style="width:100%; height:4px; background:#eee; margin-top:4px;">
          <div style="width:${percent}%; height:100%; background:var(--success-green);"></div>
        </div>
      </td>
      <td>${item.unid}</td>
      <td class="status-cell">${item.status}</td>
      <td style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;">${item.produto}</td>
    </tr>
  `;
}

// 8. Core Actions
async function selecionarCtrc(ctrcId) {
  const data = await apiCall('buscar_ctrc', { ctrc: ctrcId });
  if (data) {
    state.ctrcObj = normalizeCtrcData(data);
    if (state.ctrcObj) {
      state.ctrcObj.ctrc = ctrcId; // Ensure correct ID
      document.getElementById('telaCtrcList').style.display = 'none';
      document.getElementById('telaSeparacao').style.display = 'block';
      sessionStorage.setItem(CONFIG.STORAGE_KEYS.WAS_SEPARACAO, '1');
      renderSeparacao();
      ensureBipInputFocus(100);
    }
  }
}

async function finalizarPicking() {
  if (!confirm('Deseja finalizar o picking e dar baixa em todos os itens?')) return;

  const payload = {
    ctrc: state.ctrcObj.ctrc,
    itens: state.ctrcObj.itens.map(i => ({
      codigo: i.codigo,
      ean: i.ean,
      qtd: i.qtd_bipada,
      status: i.status
    }))
  };

  saveLog('finalizar_picking', payload);

  const result = await apiCall('dar_baixa', payload);
  if (result) {
    showToast('Picking finalizado com sucesso!');
    state.ctrcObj = null;
    saveProgress();
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.WAS_SEPARACAO);
    document.getElementById('telaSeparacao').style.display = 'none';
    document.getElementById('telaCtrcList').style.display = 'block';
    const ctrcs = await apiCall('listar_ctrcs');
    renderListaCtrcs(ctrcs);
  }
}

function setupScanning() {
  const input = document.getElementById('inputBipagemGlobal');
  if (!input) return;

  let scanBuffer = '';
  let scanTimer = null;

  input.addEventListener('input', (e) => {
    const char = e.data || input.value.slice(-1);
    if (!char) return;

    scanBuffer += char;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      processBip(scanBuffer.trim());
      scanBuffer = '';
      input.value = '';
    }, CONFIG.SCAN_TIMEOUT);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(scanTimer);
      processBip(scanBuffer.trim() || input.value.trim());
      scanBuffer = '';
      input.value = '';
    }
  });

  // Keep focus
  input.addEventListener('blur', () => {
    if (document.getElementById('telaSeparacao').style.display !== 'none') {
      ensureBipInputFocus(50);
    }
  });
}

function processBip(ean) {
  if (!ean) return;

  const item = state.ctrcObj.itens.find(i => i.ean === ean || i.codigo === ean);
  if (!item) {
    showToast(`EAN/Código ${ean} não encontrado!`, 'error');
    return;
  }

  if (item.qtd_bipada >= item.quantidade) {
    showToast('Quantidade máxima já atingida para este item!', 'error');
    return;
  }

  // Update item
  item.qtd_bipada++;
  item.qtd_restante = Math.max(0, item.quantidade - item.qtd_bipada);
  item.status = (item.qtd_bipada === item.quantidade) ? 'Finalizado' : 'Parcial';

  // Update totals
  state.ctrcObj.totais = calculateTotals(state.ctrcObj.itens);

  showToast(`Bipado: ${item.produto}`, 'success');
  saveProgress();

  // Re-render or update UI
  updateItemRowUI(item);
  updateTotalsUI();
  checkFinalizar();
}

function updateItemRowUI(item) {
  const row = document.querySelector(`tr[data-ean="${item.ean}"]`);
  if (row) {
    const newRow = renderItemRow(item);
    row.outerHTML = newRow;
  }
}

function updateTotalsUI() {
  document.getElementById('totalBipado').textContent = state.ctrcObj.totais.qtd_bipada_total;
  document.getElementById('totalRestante').textContent = state.ctrcObj.totais.qtd_restante_total;
}

function checkFinalizar() {
  const btn = document.getElementById('btnFinalizarPicking');
  if (!btn) return;
  const todosFinalizados = state.ctrcObj.itens.every(i => i.qtd_bipada >= i.quantidade);
  btn.disabled = !todosFinalizados;
}

// 9. Logging
function saveLog(tipo, payload) {
  try {
    const logs = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.LOGS) || '[]');
    logs.push({ timestamp: new Date().toISOString(), tipo, payload });
    localStorage.setItem(CONFIG.STORAGE_KEYS.LOGS, JSON.stringify(logs.slice(-100))); // Keep last 100
  } catch (e) {
    console.error('Log error:', e);
  }
}

// 10. Initialization
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[LOG] Picking App Initialized');

  // Setup alert sound
  const alertAudio = document.createElement('audio');
  alertAudio.id = 'alertSound';
  alertAudio.src = CONFIG.SOUNDS.ALERT;
  alertAudio.preload = 'auto';
  document.body.appendChild(alertAudio);

  // Load progress
  if (loadProgress()) {
    document.getElementById('telaCtrcList').style.display = 'none';
    document.getElementById('telaSeparacao').style.display = 'block';
    renderSeparacao();
  } else {
    const ctrcs = await apiCall('listar_ctrcs');
    renderListaCtrcs(ctrcs);
  }

  // Back button
  document.getElementById('btnVoltar').onclick = async () => {
    if (state.ctrcObj && state.ctrcObj.totais.qtd_bipada_total > 0) {
      if (!confirm('Há progresso não finalizado. Deseja realmente voltar?')) return;
    }
    state.ctrcObj = null;
    saveProgress();
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.WAS_SEPARACAO);
    document.getElementById('telaSeparacao').style.display = 'none';
    document.getElementById('telaCtrcList').style.display = 'block';
    const ctrcs = await apiCall('listar_ctrcs');
    renderListaCtrcs(ctrcs);
  };

  // Global focus click handler
  document.addEventListener('click', (e) => {
    if (document.getElementById('telaSeparacao').style.display !== 'none') {
      if (!['INPUT', 'BUTTON', 'SELECT', 'A'].includes(e.target.tagName)) {
        ensureBipInputFocus();
      }
    }
  });
});
