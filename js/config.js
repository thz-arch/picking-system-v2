// 1. Configuration & Constants
const CONFIG = {
  API_URL: 'https://tritton.dev.br/webhook/picking-process',
  SCAN_TIMEOUT: 60,
  STORAGE_KEYS: {
    PROGRESS: 'picking_progress',
    WAS_SEPARACAO: 'picking_was_separacao',
    LOGS: 'picking_logs',
    OFFLINE_QUEUE: 'picking_offline_queue'
  },
  SOUNDS: {
    ALERT: 'mixkit-short-electric-fence-buzz-2966.wav'
  }
};
