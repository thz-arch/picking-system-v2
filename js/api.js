// 6. API Calls
async function apiCall(acao, params = {}) {
  if (!navigator.onLine && acao === 'dar_baixa') {
    queueOfflineAction(acao, params);
    showToast('Offline: Ação salva para sincronização posterior.', 'success');
    return { status: 'queued' };
  }

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

    if (acao === 'dar_baixa' && (!navigator.onLine || error.message.includes('Failed to fetch'))) {
      queueOfflineAction(acao, params);
      showToast('Erro de conexão: Ação salva para sincronização.', 'success');
      return { status: 'queued' };
    }

    showToast(`Erro na comunicação com o servidor: ${error.message}`, 'error');
    return null;
  } finally {
    hideLoading();
  }
}

function queueOfflineAction(acao, params) {
  try {
    const queue = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.OFFLINE_QUEUE) || '[]');
    queue.push({ acao, params, timestamp: new Date().toISOString() });
    // Keep only last 20 offline actions to avoid storage issues
    localStorage.setItem(CONFIG.STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue.slice(-20)));
    console.log('[OFFLINE] Action queued:', acao);
  } catch (e) {
    console.error('[OFFLINE] Failed to queue action:', e);
  }
}

async function processOfflineQueue() {
  if (!navigator.onLine) return;

  const queue = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.OFFLINE_QUEUE) || '[]');
  if (queue.length === 0) return;

  console.log(`[SYNC] Processing ${queue.length} offline actions...`);
  showToast('Sincronizando dados pendentes...');

  const remainingQueue = [];
  for (const item of queue) {
    try {
      const result = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: item.acao, ...item.params })
      });
      if (!result.ok) throw new Error('Sync failed');
      console.log('[SYNC] Action synced successfully:', item.acao);
    } catch (e) {
      console.error('[SYNC] Failed to sync item, keeping in queue:', e);
      remainingQueue.push(item);
    }
  }

  localStorage.setItem(CONFIG.STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(remainingQueue));
  if (remainingQueue.length === 0) {
    showToast('Sincronização concluída com sucesso!');
  }
}
