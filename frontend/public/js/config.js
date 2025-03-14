// Configuration parameters for the P2P file sharing application
const CONFIG = {
  CHUNK_SIZE: 16 * 1024, // 16KB chunks
  WS_URL: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:3001`,
  API_URL: `${window.location.protocol}//${window.location.hostname}:3001`,
  MAX_RECONNECT_ATTEMPTS: 5,
  HISTORY_LIMIT: 20
};

// Export the configuration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else {
  window.CONFIG = CONFIG;
}

console.log('Config loaded - API URL:', CONFIG.API_URL);
console.log('Config loaded - WebSocket URL:', CONFIG.WS_URL); 