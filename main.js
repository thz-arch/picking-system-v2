// Variável global para armazenar os dados do CTRC atual
let ctrcObj = null;

// Função utilitária para garantir que o foco sempre retorne ao input do bipador
function ensureBipInputFocus(delay = 10) {
  setTimeout(() => {
    const bipInput = document.getElementById('inputBipagemGlobal');
    const telaSeparacao = document.getElementById('telaSeparacao');
    if (bipInput && telaSeparacao && telaSeparacao.style.display !== 'none') {
      bipInput.focus();
    }
  }, delay);
}

// Function to save progress to localStorage
function saveProgress() {
  try {
    if (ctrcObj) {
      localStorage.setItem('picking_progress', JSON.stringify(ctrcObj));
      console.log('[LOG] Progress saved to localStorage');
    } else {
      localStorage.removeItem('picking_progress');
      console.log('[LOG] Progress cleared from localStorage');
    }
  } catch (err) {
    console.error('[ERROR] Failed to save progress:', err);
  }
}

// Safe wrapper to call exibirProdutos when available, or defer the payload.
function safeExibirProdutos(produtos) {
  try {
    // Prefer calling the local function if declared in this scope (typeof is safe
    // even if the identifier doesn't exist), then fall back to window.exibirProdutos.
    if (typeof exibirProdutos === 'function') {
      try { exibirProdutos(produtos); return; } catch(e) { console.error('[ERROR] exibirProdutos threw:', e); }
    }
    if (window && typeof window.exibirProdutos === 'function') {
      try { window.exibirProdutos(produtos); return; } catch(e) { console.error('[ERROR] window.exibirProdutos threw:', e); }
    }
    // Not available yet — store pending payload for later application.
    try { window._pending_picking_restore = produtos; } catch(e) { /* ignore */ }
    console.warn('[WARN] exibirProdutos not available; deferred restore stored.');
  } catch (err) {
    console.error('[ERROR] safeExibirProdutos failed:', err);
  }
}

// Function to load progress from localStorage
function loadProgress() {
  try {
    const savedProgress = localStorage.getItem('picking_progress');
    console.debug('[DIAG] loadProgress: raw savedProgress length:', savedProgress ? savedProgress.length : 0);
  // Only attempt restoration if sessionStorage indicates we were on the
  // separation screen before reload. This prevents restoring when the
  // user intentionally selected a CTRC from the list.
  const wasSeparacao = (function(){ try { return !!sessionStorage.getItem('picking_was_separacao'); } catch(e){ return false; } })();
  if (savedProgress && wasSeparacao) {
      let saved = null;
      try {
        saved = JSON.parse(savedProgress);
      } catch (parseErr) {
        console.error('[ERROR] loadProgress: JSON.parse failed for savedProgress. raw:', savedProgress, parseErr && (parseErr.stack || parseErr));
        // Dados corrompidos ou inválidos — remove chave e aborta restauração
        try { localStorage.removeItem('picking_progress'); } catch (e) { /* ignore */ }
        console.warn('[WARN] loadProgress: removed corrupted picking_progress and aborting restore');
        return;
      }
      console.debug('[DIAG] loadProgress: parsed saved keys:', saved && Object.keys(saved));
      if (saved && saved.ctrc) {
        console.log('[LOG] Progress restored from localStorage for CTRC:', saved.ctrc);
        console.debug('[DIAG] saved.itens length:', Array.isArray(saved.itens) ? saved.itens.length : 'not-array');
        try {
          console.debug('[DIAG] window.exibirProdutos typeof:', typeof window.exibirProdutos);
        } catch (e) {
          console.debug('[DIAG] window.exibirProdutos typeof check failed:', e && (e.stack || e));
        }
        // Normalize the saved object to ensure expected fields/types
        ctrcObj = saved;
        try {
          if (!Array.isArray(ctrcObj.itens)) ctrcObj.itens = [];
          ctrcObj.itens = ctrcObj.itens.map(i => ({
            codigo: i.codigo || '',
            ean: i.ean || '',
            produto: i.produto || '',
            quantidade: Number(i.quantidade) || 0,
            qtd_bipada: Number(i.qtd_bipada) || 0,
            qtd_restante: (typeof i.qtd_restante !== 'undefined') ? Number(i.qtd_restante) : Math.max(0, (Number(i.quantidade) || 0) - (Number(i.qtd_bipada) || 0)),
            unid: i.unid || '',
            status: i.status || ((Number(i.qtd_bipada) || 0) === Number(i.quantidade) ? 'Finalizado' : ((Number(i.qtd_bipada) || 0) > 0 ? 'Parcial' : 'Pendente'))
          }));

          // Recalculate totals if missing or inconsistent
          ctrcObj.totais = {
            linhas: ctrcObj.itens.length,
            quantidade_total: ctrcObj.itens.reduce((acc, p) => acc + (Number(p.quantidade) || 0), 0),
            qtd_bipada_total: ctrcObj.itens.reduce((acc, p) => acc + (Number(p.qtd_bipada) || 0), 0),
            qtd_restante_total: ctrcObj.itens.reduce((acc, p) => acc + ( (Number(p.quantidade) || 0) - (Number(p.qtd_bipada) || 0) ), 0)
          };

          // Navega para tela de separação
          const telaCtrcList = document.getElementById('telaCtrcList');
          const telaSeparacao = document.getElementById('telaSeparacao');
          if (telaCtrcList && telaSeparacao) {
            telaCtrcList.style.display = 'none';
            telaSeparacao.style.display = 'block';
            // Ensure sessionStorage flag remains set while user is in separation
            try { sessionStorage.setItem('picking_was_separacao', '1'); } catch(e) { /* ignore */ }
            try {
              // If the render function is available on window, call it now.
              // Otherwise, defer applying the restored progress until the
              // UI code (exibirProdutos) is initialized below in DOMContentLoaded.
              // Use the safe wrapper which will call or defer appropriately
              safeExibirProdutos([ctrcObj]);
            } catch (renderErr) {
              console.error('[ERROR] Failed to render restored progress:', renderErr && (renderErr.stack || renderErr));
              // Dados possivelmente corrompidos — remove e aborta restauração
              localStorage.removeItem('picking_progress');
              ctrcObj = null;
              telaSeparacao.style.display = 'none';
              telaCtrcList.style.display = 'block';
              return;
            }

            // Foca no campo de bipagem
            ensureBipInputFocus(100);
          }
        } catch (normErr) {
          console.error('[ERROR] Failed to normalize saved progress:', normErr && (normErr.stack || normErr));
          localStorage.removeItem('picking_progress');
          ctrcObj = null;
        }
      }
    }
  } catch (err) {
    // Diagnostic dump to help root-cause the restore fail
    try {
      console.error('[ERROR] Failed to load progress:', err && (err.stack || err));
      const raw = (function(){ try { return localStorage.getItem('picking_progress'); } catch(e){ return '<unavailable>'; } })();
      console.error('[DIAG] loadProgress: raw picking_progress (truncated 200 chars):', raw ? (raw.length > 200 ? raw.substr(0,200) + '... [truncated length=' + raw.length + ']' : raw) : '<empty>');
      try {
        const parsed = JSON.parse(raw || '{}');
        console.error('[DIAG] loadProgress: parsed keys:', Object.keys(parsed));
        if (parsed && parsed.itens) console.error('[DIAG] loadProgress: parsed.itens length:', Array.isArray(parsed.itens) ? parsed.itens.length : typeof parsed.itens);
      } catch(e) {
        console.error('[DIAG] loadProgress: failed to parse raw during diagnostic:', e && (e.stack || e));
      }
  try { console.error('[DIAG] window._pending_picking_restore present?:', !!window._pending_picking_restore); } catch(e) {}
  try { console.error('[DIAG] typeof window.exibirProdutos:', typeof window.exibirProdutos); } catch(e) {}
    } catch (diagErr) {
      console.error('[ERROR] loadProgress diagnostic failed:', diagErr && (diagErr.stack || diagErr));
    }
    try { localStorage.removeItem('picking_progress'); } catch(e) {}
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('[LOG] Picking front iniciado');
  
  // Adiciona comando para ver logs
  console.log('[INFO] Digite showLogs() no console para ver todos os logs');
  // Ensure a safe proxy for `window.exibirProdutos` exists so fetch callbacks
  // can call it synchronously without risk of ReferenceError. The proxy will
  // forward to the real `exibirProdutos` once it is declared, or store a
  // pending restore payload.
  if (!window.exibirProdutos || !window.exibirProdutos.__isProxy) {
    window.exibirProdutos = function(produtos){
      try {
        if (typeof exibirProdutos === 'function' && exibirProdutos !== window.exibirProdutos) {
          return exibirProdutos(produtos);
        }
      } catch(e) { /* ignore */ }
      try { window._pending_picking_restore = produtos; } catch(e) { /* ignore */ }
      console.warn('[WARN] exibirProdutos proxy stored pending restore.');
    };
    window.exibirProdutos.__isProxy = true;
  }

  // Helper: try to call the real `exibirProdutos` a few times with short
  // retries (handles small race where render function is not yet bound).
  function tryRenderNow(produtos, attempt = 0) {
    try {
      if (typeof exibirProdutos === 'function' && exibirProdutos !== window.exibirProdutos) {
        try { exibirProdutos(produtos); return true; } catch(e) { console.error('[ERROR] exibirProdutos threw on tryRenderNow:', e); }
      }
      // If a proxy exists, give a few retries in case the declaration is
      // hoisted but initialization hasn't occurred yet.
      if (attempt < 6) {
        setTimeout(() => tryRenderNow(produtos, attempt + 1), 50);
        return false;
      }
      // fallback to safe deferral
      safeExibirProdutos(produtos);
    } catch (err) {
      console.error('[ERROR] tryRenderNow failed:', err);
      safeExibirProdutos(produtos);
    }
    return false;
  }
  
  // In-page log panel removed: UI panel for showing logs in-page was
  // deliberately discontinued. Logs continue to be available in the
  // browser console and via `printSavedProgress()` / `clearSavedProgress()`
  // helper functions (if needed) — no visible panel will be created.
  
  // Marca versão/patch carregado (útil para confirmar reload no coletor)
  console.log('[VERSION] main.js: buffer-scan + in-page-logs loaded');

  // Carrega progresso salvo ao iniciar
  loadProgress();
  
  const telaCtrcList = document.getElementById('telaCtrcList');
  const telaSeparacao = document.getElementById('telaSeparacao');
  const btnVoltar = document.getElementById('btnVoltar');
  const listaCtrcsEl = document.getElementById('listaCtrcs');
  const resultadoEl = document.getElementById('resultado');
  const dadosCtrcEl = document.getElementById('dadosCtrc');

  // Adiciona elemento de áudio para alerta sonoro
  const alertAudio = document.createElement('audio');
  alertAudio.id = 'alertSound';
  alertAudio.src = 'mixkit-short-electric-fence-buzz-2966.wav'; // arquivo de som na mesma pasta do main.js
  alertAudio.preload = 'auto';
  document.body.appendChild(alertAudio);

  function tocarAlerta() {
    alertAudio.currentTime = 0;
    alertAudio.play();
  }

  // Promise-based confirmation modal (criado dinamicamente quando necessário)
  function showConfirmModal(message) {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.style.position = 'fixed';
      backdrop.style.left = '0';
      backdrop.style.top = '0';
      backdrop.style.width = '100%';
      backdrop.style.height = '100%';
      backdrop.style.background = 'rgba(0,0,0,0.4)';
      backdrop.style.display = 'flex';
      backdrop.style.alignItems = 'center';
      backdrop.style.justifyContent = 'center';
      backdrop.style.zIndex = '10000';

      const modal = document.createElement('div');
      modal.style.background = '#fff';
      modal.style.padding = '18px';
      modal.style.borderRadius = '8px';
      modal.style.maxWidth = '420px';
      modal.style.width = '90%';
      modal.style.boxShadow = '0 6px 24px rgba(0,0,0,0.2)';
      modal.style.textAlign = 'center';

      const txt = document.createElement('div');
      txt.style.marginBottom = '14px';
      txt.style.fontSize = '1.05em';
      txt.textContent = message;

      const btnWrap = document.createElement('div');
      btnWrap.style.display = 'flex';
      btnWrap.style.justifyContent = 'center';
      btnWrap.style.gap = '10px';

      const yes = document.createElement('button');
      yes.textContent = 'Sim';
      yes.style.padding = '8px 14px';
      yes.style.background = '#1976d2';
      yes.style.color = '#fff';
      yes.style.border = 'none';
      yes.style.borderRadius = '6px';

      const no = document.createElement('button');
      no.textContent = 'Não';
      no.style.padding = '8px 14px';
      no.style.background = '#e0e0e0';
      no.style.border = 'none';
      no.style.borderRadius = '6px';

      btnWrap.appendChild(yes);
      btnWrap.appendChild(no);
      modal.appendChild(txt);
      modal.appendChild(btnWrap);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      yes.focus();

      yes.addEventListener('click', () => {
        backdrop.remove();
        resolve(true);
      });
      no.addEventListener('click', () => {
        backdrop.remove();
        resolve(false);
      });
      backdrop.addEventListener('click', (ev) => {
        if (ev.target === backdrop) {
          backdrop.remove();
          resolve(false);
        }
      });
    });
  }

  // Inicializa - busca CTRCs disponíveis ao abrir
  listarCtrcs();

  async function listarCtrcs() {
    listaCtrcsEl.innerHTML = '<li>Carregando...</li>';
    const response = await fetch('https://tritton.dev.br/webhook/picking-process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'listar_ctrcs' })
    });
    const data = await response.json();
    renderListaCtrcs(data);
  }

  function renderListaCtrcs(data) {
    listaCtrcsEl.innerHTML = '';
    if (!Array.isArray(data) || data.length === 0) {
      listaCtrcsEl.innerHTML = '<li>Nenhum CTRC disponível</li>';
      return;
    }
    for (const row of data) {
      const li = document.createElement('li');
      li.className = 'ctrc-item';
      li.dataset.ctrc = row.ctrc || row.CTRC || row.ctrc;
      const conferente = row.conferente ? `<div style="font-size:0.9em;color:#FFFFFF;margin-top:4px;">Conferente: ${row.conferente}</div>` : '';
      li.innerHTML = `<button class="select-ctrc-btn" style="width:100%;font-size:1.3em;padding:18px 0;margin-bottom:10px;background:#1976d2;color:#FFFFFF;">
        <div>${li.dataset.ctrc}</div>
        ${conferente}
      </button>`;
      listaCtrcsEl.appendChild(li);
    }
    // Click em qualquer botão .select-ctrc-btn
    listaCtrcsEl.querySelectorAll('.select-ctrc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ctrc = btn.parentElement.dataset.ctrc;
        // Navega para tela de separação
        telaCtrcList.style.display = 'none';
        telaSeparacao.style.display = 'block';
        // Mark that the user entered the separation screen via UI
        try { sessionStorage.setItem('picking_was_separacao', '1'); } catch (e) { /* ignore */ }
        buscarItensCtrc(ctrc);
        // Foca automaticamente no campo de bipagem global
        ensureBipInputFocus(100);
      });
    });
  }

  // Adicionando logs para depuração
  async function buscarItensCtrc(ctrc) {
    console.log('[DEBUG] Iniciando busca de itens para o CTRC:', ctrc);
    resultadoEl.innerHTML = '<p>Carregando itens...</p>';
    dadosCtrcEl.innerHTML = '';

    // NOTE: Do NOT auto-restore saved progress when the user explicitly
    // selects a CTRC from the list. Restoration should only occur when the
    // page is reloaded while the user was already in the separation screen.
    // The restoration-on-reload flow is handled in loadProgress() which
    // checks `sessionStorage.picking_was_separacao`.

    try {
      const response = await fetch('https://tritton.dev.br/webhook/picking-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'buscar_ctrc', ctrc })
      });
      const data = await response.json();
      console.log('[DEBUG] Dados recebidos do webhook:', data);

      if (Array.isArray(data) && data.length > 0) {
        // Se o webhook retornou um array de itens (sem wrapper CTRC), converte para o formato esperado
        if (data[0] && (data[0].ean || data[0].codigo) && !data[0].ctrc && !data[0].itens) {
          console.log('[DEBUG] Webhook retornou array de itens sem wrapper, criando wrapper CTRC com o id solicitado');
          const itens = data;
          const totais = {
            linhas: itens.length,
            quantidade_total: itens.reduce((acc, p) => acc + (Number(p.quantidade) || 0), 0),
            qtd_bipada_total: itens.reduce((acc, p) => acc + (Number(p.qtd_bipada) || 0), 0),
            qtd_restante_total: itens.reduce((acc, p) => acc + ((Number(p.quantidade) || 0) - (Number(p.qtd_bipada) || 0)), 0)
          };
          const wrapped = [{
            ctrc: ctrc,
            remetente: '',
            destinatario: '',
            cidade: '',
            prev_entrega: '',
            status: '',
            itens: itens,
            totais: totais
          }];
          // We're inside DOMContentLoaded scope where `exibirProdutos` is
          // declared; call it directly so the UI renders immediately.
          tryRenderNow(wrapped);
        } else {
          // Passa o array data diretamente para exibirProdutos
          tryRenderNow(data);
        }
      } else {
        console.warn('[WARN] Resposta do webhook não contém dados esperados.');
        resultadoEl.innerHTML = '<p>Nenhum item encontrado.</p>';
      }
    } catch (error) {
      console.error('[ERROR] Erro ao buscar itens do CTRC:', error);
      resultadoEl.innerHTML = '<p>Erro ao carregar itens. Tente novamente.</p>';
    }
  }

  // Botão voltar: retorna para tela de lista de CTRCs
  btnVoltar.addEventListener('click', async () => {
    // Verifica se há progresso salvo
    const savedProgress = localStorage.getItem('picking_progress');
    if (savedProgress) {
      const confirmed = await showConfirmModal('Há progresso salvo neste picking. Deseja realmente voltar? Todo o progresso será perdido.');
      if (!confirmed) {
        return;
      }
    }
    
    // Limpa o progresso ao voltar
    ctrcObj = null;
    saveProgress();

  // Clear separation flag so reload won't try to restore
  try { sessionStorage.removeItem('picking_was_separacao'); } catch(e) { /* ignore */ }
    
    telaSeparacao.style.display = 'none';
    telaCtrcList.style.display = 'block';
    resultadoEl.innerHTML = '';
    dadosCtrcEl.innerHTML = '';
  });

  function exibirProdutos(produtos) {
    // Expose to window early so loadProgress() can call or defer to it
    try { window.exibirProdutos = exibirProdutos; } catch(e) { /* ignore */ }
  console.log(`[LOG] Exibindo produtos:`, produtos);
    const dadosCtrcDiv = document.getElementById('dadosCtrc');
    const resultadoDiv = document.getElementById('resultado');
    let btnFinalizar = null;
    if(!produtos || produtos.length === 0) {
      dadosCtrcDiv.innerHTML = '';
      resultadoDiv.innerHTML = '<p>Nenhum produto encontrado.</p>';
      return;
    }

    // Caso o webhook retorne um array simples de itens (sem wrapper do CTRC), renderiza fallback imediatamente
    if (Array.isArray(produtos) && produtos[0] && !produtos[0].ctrc && (produtos[0].ean || produtos[0].codigo) && !produtos[0].itens) {
      console.log('[DEBUG] Detectado array simples de itens — usando render fallback');
      dadosCtrcDiv.innerHTML = '';
      let html = '<table><tr><th>Código</th><th>EAN</th><th>Produto</th><th>Qtd</th><th>Bipada</th><th>Restante</th><th>Unid</th><th>Status</th></tr>';
      produtos.forEach(p => {
        let status = '';
        let statusColor = '';
        if (p.qtd_bipada === p.quantidade) {
          status = 'Finalizado';
          statusColor = '#05fa0dff';
        } else if (p.qtd_bipada > 0) {
          status = 'Parcial';
          statusColor = '#ff9800';
        } else {
          status = 'Pendente';
          statusColor = '#fc1100ff';
        }
        html += `<tr>
      <td>${p.codigo || ''}</td>
      <td>${p.ean || ''}</td>
      <td>${p.produto || ''}</td>
      <td>${p.quantidade || 0}</td>
      <td>${p.qtd_bipada || 0}</td>
      <td>${p.qtd_restante || p.quantidade || 0}</td>
      <td>${p.unid || ''}</td>
      <td style="font-weight:bold;color:${statusColor};">${status}</td>
    </tr>`;
      });
      html += '</table>';
      console.log('[DEBUG] (items fallback) Inserindo HTML no resultadoDiv. htmlLength:', html.length);
      resultadoDiv.innerHTML = html;
      console.log('[DEBUG] (items fallback) HTML inserido. resultadoDiv childNodes:', resultadoDiv.childNodes.length);
      // Foco no input, se existir
      const bipInputGlobal = document.getElementById('inputBipagemGlobal');
      if (bipInputGlobal) {
        bipInputGlobal.value = '';
        ensureBipInputFocus();
      }
      return;
    }

  // Se vier o objeto completo do CTRC, extrai os dados
    if (Array.isArray(produtos)) {
      console.log('[DEBUG] Analisando formato dos produtos:', produtos);
      
      if (produtos[0] && produtos[0].ctrc && produtos[0].itens) {
        ctrcObj = produtos[0]; // Atualiza a variável global
        console.log('[LOG] CTRC carregado:', ctrcObj.ctrc);
      } else if (produtos[0] && (produtos[0].CTRC || produtos[0].ctrc)) {
        // Adapta o formato antigo para o novo
        ctrcObj = {
          ctrc: produtos[0].CTRC || produtos[0].ctrc,
          remetente: produtos[0].remetente || '',
          destinatario: produtos[0].destinatario || '',
          cidade: produtos[0].cidade || '',
          prev_entrega: produtos[0].prev_entrega || '',
          status: produtos[0].status || '',
          itens: produtos.map(p => ({
            codigo: p.codigo || '',
            ean: p.ean || '',
            produto: p.produto || '',
            quantidade: parseInt(p.quantidade) || 0,
            qtd_bipada: parseInt(p.qtd_bipada) || 0,
            qtd_restante: parseInt(p.quantidade) || 0,
            unid: p.unid || '',
            status: 'Pendente'
          }))
        };
        
        // Calcula os totais após criar os itens
        ctrcObj.totais = {
          linhas: ctrcObj.itens.length,
          quantidade_total: ctrcObj.itens.reduce((acc, p) => acc + (p.quantidade || 0), 0),
          qtd_bipada_total: ctrcObj.itens.reduce((acc, p) => acc + (p.qtd_bipada || 0), 0),
          qtd_restante_total: ctrcObj.itens.reduce((acc, p) => acc + ((Number(p.quantidade) || 0) - (Number(p.qtd_bipada) || 0)), 0)
        };
        
        console.log('[LOG] CTRC adaptado:', ctrcObj);
      } else {
        console.warn('[WARN] Formato de dados inválido:', produtos);
        dadosCtrcDiv.innerHTML = '';
        resultadoDiv.innerHTML = '<p>Erro ao carregar dados do CTRC.</p>';
        return;
      }
    } else {
      console.warn('[WARN] Dados não são um array:', produtos);
      dadosCtrcDiv.innerHTML = '';
      resultadoDiv.innerHTML = '<p>Erro ao carregar dados do CTRC.</p>';
      return;
    }

    if (ctrcObj) {
      // Exibe dados principais do CTRC
      dadosCtrcDiv.innerHTML = `
        <strong>CTRC:</strong> ${ctrcObj.ctrc}<br>
        <strong>Remetente:</strong> ${ctrcObj.remetente}<br>
        <strong>Destinatário:</strong> ${ctrcObj.destinatario}<br>
        <strong>Cidade:</strong> ${ctrcObj.cidade}<br>
        <strong>Previsão de Entrega:</strong> ${ctrcObj.prev_entrega}<br>
        <strong>Status:</strong> ${ctrcObj.status}<br>
        <strong>Totais:</strong> Linhas: ${ctrcObj.totais.linhas}, Qtd Total: ${ctrcObj.totais.quantidade_total}, Bipado: ${ctrcObj.totais.qtd_bipada_total}, Restante: ${ctrcObj.totais.qtd_restante_total}
      `;
      // Exibe tabela de itens com coluna de status dinâmica e layout mais compacto
      // Ordem exigida: Cod. | EAN | Qtd/Bip. | Unid. | Status | Prod.
      // Adiciona o campo de bipagem oculto no topo
      console.log('[DEBUG] Renderizando tabela com itens:', ctrcObj.itens);
      let html = `<div style="position:relative;">
        <input type="text" id="inputBipagemGlobal" 
          style="position:absolute; opacity:0; pointer-events:none; width:1px; height:1px;"
          autocomplete="off" 
          tabindex="-1">
      </div>
      <div style="overflow-x:auto;margin-top:12px;">
        <table style="font-size:0.88em;width:100%;min-width:900px;border-collapse:collapse;box-shadow:0 1px 4px #ddd;background:#fff;">\n<tr style='background:#1976d2;'>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;color:#fff;font-size:0.95em;">Cod.</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;color:#fff;font-size:0.95em;">EAN</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;color:#fff;font-size:0.95em;">Qtd/Bip.</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;color:#fff;font-size:0.95em;">Unid.</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;color:#fff;font-size:0.95em;">Status</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;color:#fff;font-size:0.95em;">Prod.</th>
      </tr>`;
      ctrcObj.itens.forEach((item) => {
        // Define status e cor dinamicamente
        let status = '';
        let statusColor = '';
        if (item.qtd_bipada === item.quantidade) {
          status = 'Finalizado';
          statusColor = '#02fd0bff'; // verde
        } else if (item.qtd_bipada > 0) {
          status = 'Parcial';
          statusColor = '#038dfdff'; // azul (para texto)
        } else {
          status = 'Pendente';
          statusColor = '#000000'; // cor de texto padrão
        }
        item.status = status; // Adiciona status ao objeto para envio posterior

        // Garante que o status seja renderizado corretamente
        if (item.status !== 'Finalizado' && item.status !== 'Parcial' && item.status !== 'Pendente') {
          console.warn('[WARN] Status inesperado detectado:', item.status);
          item.status = 'Pendente';
        }

        // cor de fundo por status (preenche a linha inteira)
        let bg = '';
        if (status === 'Parcial') bg = 'background:#90caf9;'; // azul mais forte
        else if (status === 'Finalizado') bg = 'background:#81c784;'; // verde mais forte

        html += `<tr style='${bg}'>
          <td style="padding:6px 8px;border:1px solid #e0e0e0;vertical-align:middle;">${item.codigo || ''}</td>
          <td style="padding:6px 8px;border:1px solid #e0e0e0;vertical-align:middle;">${item.ean || ''}</td>
          <td class="qtdbip" style="padding:6px 8px;border:1px solid #e0e0e0;text-align:center;vertical-align:middle;">${item.quantidade || 0}/${item.qtd_bipada || 0}
            <div style="display:inline-block;width:56px;height:8px;margin-left:8px;vertical-align:middle;background:#eee;border-radius:4px;overflow:hidden;">
              <div style="height:100%;background:#4caf50;width:${Math.round(((item.qtd_bipada||0)/(item.quantidade||1))*100)}%;"></div>
            </div>
          </td>
          <td style="padding:6px 8px;border:1px solid #e0e0e0;vertical-align:middle;text-align:center;">${item.unid || ''}</td>
          <td class="status-cell" style="font-weight:bold;color:${statusColor};padding:6px 8px;border:1px solid #e0e0e0;vertical-align:middle;text-align:center;">${item.status}</td>
          <td style="padding:6px 8px;border:1px solid #e0e0e0;vertical-align:middle;white-space:nowrap;">${item.produto || ''}</td>
        </tr>`;
      });
      html += '</table></div>';
      // Botão finalizar picking
      html += `<div style="margin-top:12px;"><button id="btnFinalizarPicking" disabled>Finalizar Picking</button></div>`;
  console.log('[DEBUG] Inserindo HTML da tabela no resultadoDiv. resultadoDiv:', resultadoDiv, 'htmlLength:', html ? html.length : 0);
  resultadoDiv.innerHTML = html;
  console.log('[DEBUG] HTML inserido. resultadoDiv childNodes:', resultadoDiv.childNodes.length);

      // Hook bipagem global: campo inputBipagemGlobal (scanner-only)
      const bipInputGlobal = document.getElementById('inputBipagemGlobal');
      if (bipInputGlobal) {
        // scanner detection
        let scanStart = null;
        let scanChars = 0;
        let lastWasScan = false;

        // block paste
        bipInputGlobal.addEventListener('paste', (e) => {
          e.preventDefault();
          mostrarBipagemErro('Colar não permitido. Use o leitor de código de barras.');
          bipInputGlobal.classList.add('flash-red');
          setTimeout(() => bipInputGlobal.classList.remove('flash-red'), 1200);
          return false;
        });

        // Sistema para manter o foco sempre no input do bipador
        function forceFocusToBipInput() {
          ensureBipInputFocus(0);
        }

        // Adiciona listeners globais para garantir que o foco sempre volte para o input
        document.addEventListener('click', (e) => {
          // Se estamos na tela de separação e não clicamos no próprio input ou em botões importantes
          const telaSeparacao = document.getElementById('telaSeparacao');
          if (telaSeparacao && telaSeparacao.style.display !== 'none') {
            // Lista de elementos que podem manter o foco temporariamente
            const allowedElements = ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'];
            const isModal = e.target.closest('.modal-backdrop') || e.target.closest('.modal');
            
            // Se não clicou em um elemento que deve manter o foco e não é um modal
            if (!allowedElements.includes(e.target.tagName) && !isModal) {
              ensureBipInputFocus();
            }
          }
        });

        // Reforça o foco quando perder
        bipInputGlobal.addEventListener('blur', () => {
          const telaSeparacao = document.getElementById('telaSeparacao');
          if (telaSeparacao && telaSeparacao.style.display !== 'none') {
            ensureBipInputFocus();
          }
        });

        // Listener para detectar quando voltar para a tela de separação
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
              const telaSeparacao = document.getElementById('telaSeparacao');
              if (telaSeparacao && telaSeparacao.style.display !== 'none') {
                ensureBipInputFocus(100);
              }
            }
          });
        });

        const telaSeparacao = document.getElementById('telaSeparacao');
        if (telaSeparacao) {
          observer.observe(telaSeparacao, { attributes: true });
        }

        // reset and focus
        bipInputGlobal.value = '';
        ensureBipInputFocus();

        // Buffer-based scanner detection: acumula caracteres rápidos e processa
        // após um pequeno timeout, evitando processar cada dígito separadamente.
        let scanBuffer = '';
        let scanTimer = null;
        const SCAN_TIMEOUT = 60; // ms, ajustar se necessário

        bipInputGlobal.addEventListener('input', (ev) => {
          // ev.data geralmente contém o chunk recém-inserido em navegadores
          const chunk = (ev && typeof ev.data !== 'undefined') ? ev.data : bipInputGlobal.value;
          if (chunk == null) return;
          scanBuffer += String(chunk);
          clearTimeout(scanTimer);
          scanTimer = setTimeout(() => {
            const val = scanBuffer.trim();
            if (val.length > 0) {
              console.debug('[SCAN] Valor completo recebido:', val);
              processBip(val);
            }
            scanBuffer = '';
            bipInputGlobal.value = '';
          }, SCAN_TIMEOUT);
        });

        bipInputGlobal.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            clearTimeout(scanTimer);
            const val = (scanBuffer.trim() || bipInputGlobal.value.trim());
            if (val.length > 0) {
              processBip(val);
            }
            scanBuffer = '';
            bipInputGlobal.value = '';
          }
        });

        async function processBip(valorBipado) {
          if (!valorBipado) return;
          const item = ctrcObj.itens.find(i => i.ean === valorBipado);
          if (!item) {
            mostrarBipagemErro('EAN não encontrado na lista!');
            bipInputGlobal.value = '';
            ensureBipInputFocus();
            return;
          }
          if (item.qtd_bipada >= item.quantidade) {
            tocarAlerta();
            bipInputGlobal.value = '';
            const confirmOverride = await showConfirmModal('Você está tentando bipar além da quantidade permitida. Deseja confirmar o bip extra?');
            if (!confirmOverride) {
              bipInputGlobal.classList.add('flash-red');
              setTimeout(() => bipInputGlobal.classList.remove('flash-red'), 1600);
              mostrarBipagemErro('Quantidade máxima atingida.');
              ensureBipInputFocus();
              return;
            } else {
              mostrarBipagemErro('Bipagem extra detectada.');
              ensureBipInputFocus();
              return;
            }
          }
          // válido
          item.qtd_bipada = (item.qtd_bipada || 0) + 1;
          item.qtd_restante = Math.max(0, item.quantidade - item.qtd_bipada);
          ctrcObj.totais.qtd_bipada_total += 1;
          ctrcObj.totais.qtd_restante_total = Math.max(0, ctrcObj.totais.quantidade_total - ctrcObj.totais.qtd_bipada_total);
          if (item.qtd_bipada === item.quantidade) item.status = 'Finalizado';
          else if (item.qtd_bipada > 0) item.status = 'Parcial';
          else item.status = 'Pendente';
          mostrarBipagemSucesso(item.ean);

          // Save progress after updating item
          saveProgress();

          // atualiza linha
          const trs = resultadoDiv.querySelectorAll('tr');
          trs.forEach(tr => {
            const eanCell = tr.querySelector('td:nth-child(2)');
            if (eanCell && eanCell.textContent === item.ean) {
              const qtdbipCell = tr.querySelector('.qtdbip');
              if (qtdbipCell) qtdbipCell.innerHTML = `${item.quantidade || 0}/${item.qtd_bipada || 0}` + ` <div style="display:inline-block;width:56px;height:8px;margin-left:8px;vertical-align:middle;background:#eee;border-radius:4px;overflow:hidden;"><div style="height:100%;background:#4caf50;width:${Math.round(((item.qtd_bipada||0)/(item.quantidade||1))*100)}%;"></div></div>`;
              const statusCell = tr.querySelector('.status-cell');
              if (statusCell) {
                let color = '#000';
                if (item.status === 'Finalizado') color = '#4caf50';
                else if (item.status === 'Parcial') color = '#1976d2';
                statusCell.textContent = item.status;
                statusCell.style.color = color;
              }
              // row bg
              if (item.status === 'Parcial') tr.style.background = '#90caf9';
              else if (item.status === 'Finalizado') tr.style.background = '#81c784';
              else tr.style.background = '';
            }
          });
          // atualiza dados do CTRC
          dadosCtrcDiv.innerHTML = `
            <strong>CTRC:</strong> ${ctrcObj.ctrc}<br>
            <strong>Remetente:</strong> ${ctrcObj.remetente}<br>
            <strong>Destinatário:</strong> ${ctrcObj.destinatario}<br>
            <strong>Cidade:</strong> ${ctrcObj.cidade}<br>
            <strong>Previsão de Entrega:</strong> ${ctrcObj.prev_entrega}<br>
            <strong>Status:</strong> ${ctrcObj.status}<br>
            <strong>Totais:</strong> Linhas: ${ctrcObj.totais.linhas}, Qtd Total: ${ctrcObj.totais.quantidade_total}, Bipado: ${ctrcObj.totais.qtd_bipada_total}, Restante: ${ctrcObj.totais.qtd_restante_total}
          `;
          bipInputGlobal.value = '';
          // Garante que o foco sempre retorne para o input após bipagem
          ensureBipInputFocus();
          checkFinalizar();
        }
      }

  // Usa as funções globais mostrarBipagemSucesso/mostrarBipagemErro definidas no escopo superior

    btnFinalizar = document.getElementById('btnFinalizarPicking');
    function checkFinalizar() {
      if (!btnFinalizar) return; // Proteção contra elemento não encontrado
      const todosBipados = ctrcObj.itens.every(i => i.qtd_bipada === i.quantidade);
      btnFinalizar.disabled = !todosBipados;
    }
    // Chamamos checkFinalizar depois que o botão foi criado e encontrado
    checkFinalizar();
    if (btnFinalizar) btnFinalizar.addEventListener('click', async function() {
      if (!confirm('Deseja finalizar o picking e dar baixa em todos os itens?')) return;
      // Função para salvar log no localStorage
      function saveLog(data) {
        try {
          // Pega logs existentes ou inicializa array vazio
          const logs = JSON.parse(localStorage.getItem('picking_logs') || '[]');
          
          // Adiciona novo log
          logs.push({
            timestamp: new Date().toISOString(),
            ...data
          });
          
          // Salva de volta no localStorage
          localStorage.setItem('picking_logs', JSON.stringify(logs));
          
          // Também mostra no console para debug
          console.log('Log salvo:', data);
        } catch (err) {
          console.error('Erro ao salvar log:', err);
        }
      }

      // Função para mostrar todos os logs
      function showLogs() {
        const logs = JSON.parse(localStorage.getItem('picking_logs') || '[]');
        console.log('=== TODOS OS LOGS ===');
        logs.forEach((log, index) => {
          console.log(`\n--- Log ${index + 1} ---`);
          console.log(log);
        });
        console.log('\n=== FIM DOS LOGS ===');
      }

      const payload = {
        acao: 'dar_baixa',
        ctrc: ctrcObj.ctrc,
        itens: ctrcObj.itens.map(i => ({
          codigo: i.codigo,
          ean: i.ean,
          qtd: i.qtd_bipada,
          status: i.status // envia status para registrar no banco
        }))
      };

      // Salva o log do payload
      await saveLog({
        data: new Date().toISOString(),
        tipo: 'finalizar_picking',
        payload: payload
      });

      try {
        // Salva log antes de enviar
        await saveLog({
          data: new Date().toISOString(),
          tipo: 'enviando_request',
          payload: payload
        });

        const response = await fetch('https://tritton.dev.br/webhook/picking-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        // Salva log da resposta
        await saveLog({
          data: new Date().toISOString(),
          tipo: 'resposta_request',
          status: response.status,
          response: data
        });

        if (!response.ok) {
          throw new Error(`Erro ${response.status}: ${JSON.stringify(data)}`);
        }

        mostrarBipagemSucesso('Picking finalizado e baixa registrada!');
      } catch (error) {
        console.error('Erro ao finalizar picking:', error);
        
        // Salva log do erro
        await saveLog({
          data: new Date().toISOString(),
          tipo: 'erro_request',
          erro: error.message,
          payload_original: payload
        });

        mostrarBipagemErro('Erro ao finalizar picking. Por favor, tente novamente.');
        return; // Não volta para tela inicial em caso de erro
      }
      
      // Volta para tela de CTRCs
  telaCtrcList.style.display = 'block';
  telaSeparacao.style.display = 'none';
  // Clear separation flag after finishing
  try { sessionStorage.removeItem('picking_was_separacao'); } catch(e) { /* ignore */ }
      listarCtrcs(); // Atualiza lista de CTRCs
    });
    return;
  }
  // Fallback para array simples de produtos
  dadosCtrcDiv.innerHTML = '';
  let html = '<table><tr><th>Código</th><th>EAN</th><th>Produto</th><th>Qtd</th><th>Bipada</th><th>Restante</th><th>Unid</th><th>Status</th></tr>';
  produtos.forEach(p => {
    let status = '';
    let statusColor = '';
    if (p.qtd_bipada === p.quantidade) {
      status = 'Finalizado';
      statusColor = '#05fa0dff';
    } else if (p.qtd_bipada > 0) {
      status = 'Parcial';
      statusColor = '#ff9800';
    } else {
      status = 'Pendente';
      statusColor = '#fc1100ff';
    }
    html += `<tr>
      <td>${p.codigo || ''}</td>
      <td>${p.ean || ''}</td>
      <td>${p.produto || ''}</td>
      <td>${p.quantidade || 0}</td>
      <td>${p.qtd_bipada || 0}</td>
      <td>${p.qtd_restante || p.quantidade || 0}</td>
      <td>${p.unid || ''}</td>
      <td style="font-weight:bold;color:${statusColor};">${status}</td>
    </tr>`;
  });
  html += '</table>';
  console.log('[DEBUG] (fallback) Inserindo HTML no resultadoDiv. resultadoDiv:', resultadoDiv, 'htmlLength:', html ? html.length : 0);
  resultadoDiv.innerHTML = html;
  console.log('[DEBUG] (fallback) HTML inserido. resultadoDiv childNodes:', resultadoDiv.childNodes.length);
  const bipInputGlobal = document.getElementById('inputBipagemGlobal');
  if (bipInputGlobal) {
    bipInputGlobal.value = '';
    ensureBipInputFocus();

    // Buffer-based scanner detection for fallback table as well
    let scanBufferFb = '';
    let scanTimerFb = null;
    const SCAN_TIMEOUT_FB = 60; // ms

    bipInputGlobal.addEventListener('input', (ev) => {
      const chunk = (ev && typeof ev.data !== 'undefined') ? ev.data : bipInputGlobal.value;
      if (chunk == null) return;
      scanBufferFb += String(chunk);
      clearTimeout(scanTimerFb);
      scanTimerFb = setTimeout(() => {
        const valorBipado = scanBufferFb.trim();
        if (!valorBipado) {
          scanBufferFb = '';
          bipInputGlobal.value = '';
          return;
        }
        const item = produtos.find(i => i.ean === valorBipado);
        if (!item) {
          mostrarBipagemErro('EAN não encontrado na lista!');
          scanBufferFb = '';
          bipInputGlobal.value = '';
          ensureBipInputFocus();
          return;
        }
        if (item.qtd_bipada >= item.quantidade) {
          mostrarBipagemErro('Todas unidades deste EAN já foram bipadas!');
          scanBufferFb = '';
          bipInputGlobal.value = '';
          ensureBipInputFocus();
          return;
        }
        item.qtd_bipada = (item.qtd_bipada || 0) + 1;
        item.qtd_restante = Math.max(0, item.quantidade - item.qtd_bipada);
        mostrarBipagemSucesso(item.ean);
        const trs = resultadoDiv.querySelectorAll('tr');
        trs.forEach(tr => {
          const eanCell = tr.querySelector('td:nth-child(2)');
          if (eanCell && eanCell.textContent === item.ean) {
            const bipadaCell = tr.querySelector('td:nth-child(5)');
            if (bipadaCell) bipadaCell.textContent = item.qtd_bipada;
            const restanteCell = tr.querySelector('td:nth-child(6)');
            if (restanteCell) restanteCell.textContent = item.qtd_restante;
          }
        });
        scanBufferFb = '';
        bipInputGlobal.value = '';
        ensureBipInputFocus();
      }, SCAN_TIMEOUT_FB);
    });

    bipInputGlobal.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        clearTimeout(scanTimerFb);
        const valorBipado = (scanBufferFb.trim() || bipInputGlobal.value.trim());
        if (!valorBipado) return;
        const item = produtos.find(i => i.ean === valorBipado);
        if (!item) {
          mostrarBipagemErro('EAN não encontrado na lista!');
          scanBufferFb = '';
          bipInputGlobal.value = '';
          ensureBipInputFocus();
          return;
        }
        if (item.qtd_bipada >= item.quantidade) {
          mostrarBipagemErro('Todas unidades deste EAN já foram bipadas!');
          scanBufferFb = '';
          bipInputGlobal.value = '';
          ensureBipInputFocus();
          return;
        }
        item.qtd_bipada = (item.qtd_bipada || 0) + 1;
        item.qtd_restante = Math.max(0, item.quantidade - item.qtd_bipada);
        mostrarBipagemSucesso(item.ean);
        const trs = resultadoDiv.querySelectorAll('tr');
        trs.forEach(tr => {
          const eanCell = tr.querySelector('td:nth-child(2)');
          if (eanCell && eanCell.textContent === item.ean) {
            const bipadaCell = tr.querySelector('td:nth-child(5)');
            if (bipadaCell) bipadaCell.textContent = item.qtd_bipada;
            const restanteCell = tr.querySelector('td:nth-child(6)');
            if (restanteCell) restanteCell.textContent = item.qtd_restante;
          }
        });
        scanBufferFb = '';
        bipInputGlobal.value = '';
        ensureBipInputFocus();
      }
    });
  }
  function mostrarBipagemSucesso(ean) {
    const msg = document.createElement('div');
    msg.textContent = `Bipagem de sucesso para EAN ${ean}!`;
    msg.style.position = 'fixed';
    msg.style.top = '20px';
    msg.style.left = '50%';
    msg.style.transform = 'translateX(-50%)';
    msg.style.background = '#4caf50';
    msg.style.color = '#fff';
    msg.style.padding = '10px 24px';
    msg.style.borderRadius = '8px';
    msg.style.zIndex = '9999';
    msg.style.fontSize = '1.2em';
    document.body.appendChild(msg);
    setTimeout(() => {
      msg.remove();
    }, 1200);
  }
  function mostrarBipagemErro(msgText) {
    tocarAlerta(); // toca som de erro
    const msg = document.createElement('div');
    msg.textContent = msgText;
    msg.style.position = 'fixed';
    msg.style.top = '20px';
    msg.style.left = '50%';
    msg.style.transform = 'translateX(-50%)';
    msg.style.background = '#f44336';
    msg.style.color = '#fff';
    msg.style.padding = '10px 24px';
    msg.style.borderRadius = '8px';
    msg.style.zIndex = '9999';
    msg.style.fontSize = '1.2em';
    document.body.appendChild(msg);
    setTimeout(() => {
      msg.remove();
    }, 1200);
  }
  // Exemplo de uso: erro na API
  function mostrarErroApi(msgText) {
    tocarAlerta();
    mostrarBipagemErro(msgText);
  }
  } // fecha o bloco do if (bipInputGlobal)

  // Se houver uma restauração pendente guardada enquanto a função exibirProdutos
  // ainda não existia, aplicamos agora que tudo foi inicializado.
  try {
    // Ensure the function reference is exported to window so other code can call it
    // (avoid referencing bare `exibirProdutos` to prevent ReferenceError)
    try { /* noop - function declaration is hoisted; rely on window.exibirProdutos when set */ } catch(e) { /* ignore */ }
    // Only apply pending restore if session indicates we were previously
    // on the separation screen (i.e. this is a reload), otherwise discard.
    const wasSeparacaoNow = (function(){ try { return !!sessionStorage.getItem('picking_was_separacao'); } catch(e){ return false; } })();
    if (window && window._pending_picking_restore) {
      const pending = window._pending_picking_restore;
      window._pending_picking_restore = null;
      if (!wasSeparacaoNow) {
        console.log('[LOG] Discarding pending restore because session does not indicate separation screen.');
      } else {
        console.log('[LOG] Aplicando restauração pendente para CTRC:', pending && pending.ctrc);
        try {
          const telaCtrcList2 = document.getElementById('telaCtrcList');
          const telaSeparacao2 = document.getElementById('telaSeparacao');
          if (telaCtrcList2 && telaSeparacao2) {
            telaCtrcList2.style.display = 'none';
            telaSeparacao2.style.display = 'block';
          }
          // Try to apply pending restore; safeExibirProdutos will defer if render
          // function still isn't available yet.
          safeExibirProdutos([pending]);
          ensureBipInputFocus(100);
        } catch (e) {
          console.error('[ERROR] Falha ao aplicar restauração pendente:', e && (e.stack || e));
        }
      }
    }
  } catch (e) {
    /* ignore */
  }

}); // fecha o addEventListener('DOMContentLoaded')
