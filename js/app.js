/**
 * Picking Interface - Binho Transportes
 * UI and State management.
 */

// 2. Global State
let state = {
  ctrcObj: null,
  pendingRestore: null
};

// 3. UI Utilities
function updateConnectionStatus() {
  const statusEl = document.getElementById('statusConexao');
  if (!statusEl) return;

  if (navigator.onLine) {
    statusEl.style.background = '#4caf50'; // Green
    statusEl.title = 'Online';
  } else {
    statusEl.style.background = '#f44336'; // Red
    statusEl.title = 'Offline';
    showToast('Você está offline. O progresso será salvo localmente.', 'error');
  }
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
  if (Array.isArray(data) && data.length > 0 && data[0].ctrc) {
    data = data[0];
  }

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
      state.ctrcObj.ctrc = ctrcId;
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
    showToast(`ITEM NÃO PERTENCE A ESTA CARGA: ${ean}`, 'error');
    return;
  }

  if (item.qtd_bipada >= item.quantidade) {
    showToast(`ALERTA: Quantidade excedida para ${item.produto}`, 'warning');
    return;
  }

  item.qtd_bipada++;
  item.qtd_restante = Math.max(0, item.quantidade - item.qtd_bipada);
  item.status = (item.qtd_bipada === item.quantidade) ? 'Finalizado' : 'Parcial';

  state.ctrcObj.totais = calculateTotals(state.ctrcObj.itens);

  showToast(`Bipado: ${item.produto}`, 'success');
  saveProgress();

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

    // Clean up logs older than 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const filteredLogs = logs.filter(log => new Date(log.timestamp) > oneWeekAgo);

    filteredLogs.push({ timestamp: new Date().toISOString(), tipo, payload });

    // Prune to last 50 entries to keep localStorage footprint small
    localStorage.setItem(CONFIG.STORAGE_KEYS.LOGS, JSON.stringify(filteredLogs.slice(-50)));
  } catch (e) {
    console.error('Log error:', e);
    // If quota exceeded, clear logs and try once more
    if (e.name === 'QuotaExceededError') {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.LOGS);
    }
  }
}

// 10. Initialization
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[LOG] Picking App Initialized');

  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  updateConnectionStatus();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('[PWA] Service Worker registered'))
        .catch(err => console.warn('[PWA] Service Worker registration failed', err));
    });
  }

  window.addEventListener('online', processOfflineQueue);
  if (navigator.onLine) processOfflineQueue();

  const alertAudio = document.createElement('audio');
  alertAudio.id = 'alertSound';
  alertAudio.src = CONFIG.SOUNDS.ALERT;
  alertAudio.preload = 'auto';
  document.body.appendChild(alertAudio);

  if (loadProgress()) {
    document.getElementById('telaCtrcList').style.display = 'none';
    document.getElementById('telaSeparacao').style.display = 'block';
    renderSeparacao();
  } else {
    const ctrcs = await apiCall('listar_ctrcs');
    renderListaCtrcs(ctrcs);
  }

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

  document.addEventListener('click', (e) => {
    if (document.getElementById('telaSeparacao').style.display !== 'none') {
      if (!['INPUT', 'BUTTON', 'SELECT', 'A'].includes(e.target.tagName)) {
        ensureBipInputFocus();
      }
    }
  });
});
