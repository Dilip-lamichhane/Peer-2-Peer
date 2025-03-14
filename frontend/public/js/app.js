/**
 * Main application file for P2P File Sharing
 * Integrates all modules and initializes the application
 */

// DOM Elements
const elements = {
  generateCodeBtn: document.getElementById('generate-code-btn'),
  joinRoomBtn: document.getElementById('join-room-btn'),
  roomCodeInput: document.getElementById('room-code-input'),
  roomCodeDisplay: document.getElementById('room-code-display'),
  roomCodeText: document.getElementById('room-code'),
  copyCodeBtn: document.getElementById('copy-code-btn'),
  fileInput: document.getElementById('file-input'),
  selectedFilesList: document.getElementById('selected-files-list'),
  incomingFilesList: document.getElementById('incoming-files-list'),
  sendFilesBtn: document.getElementById('send-files-btn'),
  fileSelection: document.getElementById('file-selection'),
  fileReceiving: document.getElementById('file-receiving'),
  connectionStatusText: document.getElementById('connection-status-text'),
  statusIndicator: document.getElementById('status-indicator'),
  transferStatus: document.getElementById('transfer-status'),
  progressBar: document.getElementById('progress-bar'),
  transferPercentage: document.getElementById('transfer-percentage'),
  transferSpeed: document.getElementById('transfer-speed'),
  transferRemaining: document.getElementById('transfer-remaining'),
  themeToggle: document.getElementById('theme-toggle'),
  clearHistoryBtn: document.getElementById('clear-history-btn'),
  fileHistoryList: document.getElementById('file-history-list'),
  fileHistoryContainer: document.getElementById('file-history-container')
};

// Application state
const state = {
  roomCode: null,
  isConnected: false,
  isTransferring: false
};

/**
 * Initialize the application
 */
function initializeApp() {
  console.log('Initializing P2P File Sharing application...');
  
  // Initialize UI
  UI.initialize();
  
  // Initialize Connection module
  Connection.initialize({
    onConnectionStatusChange: handleConnectionStatusChange,
    onError: handleError,
    onRoomJoined: handleRoomJoined,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onPeerConnected: handlePeerConnected,
    onPeerDisconnected: handlePeerDisconnected,
    onData: handleIncomingData
  });
  
  // Initialize File Transfer module
  FileTransfer.initialize({
    connection: Connection,
    ui: UI,
    callbacks: {
      onFilesSelected: handleFilesSelected,
      onFileReceptionStart: handleFileReceptionStart,
      onFileProgress: handleFileProgress,
      onFileComplete: handleFileComplete,
      onTransferStart: handleTransferStart,
      onTransferProgress: handleTransferProgress,
      onTransferSpeedUpdate: handleTransferSpeedUpdate,
      onTransferComplete: handleTransferComplete,
      onStatusUpdate: updateStatus,
      onError: handleError,
      onHistoryUpdated: handleHistoryUpdated
    }
  });
  
  // Set up event listeners
  setupEventListeners();
  
  // Check server health
  Connection.checkServerHealth();
}

/**
 * Set up event listeners for UI elements
 */
function setupEventListeners() {
  // Room code generation
  elements.generateCodeBtn.addEventListener('click', generateCode);
  
  // Room joining
  elements.joinRoomBtn.addEventListener('click', joinRoom);
  elements.roomCodeInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') joinRoom();
  });
  
  // Copy room code
  elements.copyCodeBtn.addEventListener('click', copyRoomCode);
  
  // File selection
  elements.fileInput.addEventListener('change', handleFileSelect);
  
  // Send files
  elements.sendFilesBtn.addEventListener('click', sendFiles);
  
  // Initialize drag and drop
  UI.initializeFileDragAndDrop(handleFileSelect);
}

/**
 * Generate a room code
 */
async function generateCode() {
  try {
    updateStatus('Generating room code...', 'info');
    const roomCode = await Connection.generateCode();
    
    if (roomCode) {
      state.roomCode = roomCode;
      elements.roomCodeText.textContent = roomCode;
      elements.roomCodeDisplay.classList.remove('hidden');
      elements.fileSelection.classList.remove('hidden');
      
      updateStatus(`Room created with code: ${roomCode}`, 'success');
    }
  } catch (error) {
    handleError(`Failed to generate room code: ${error.message}`);
  }
}

/**
 * Join a room with the provided code
 */
function joinRoom() {
  const roomCode = elements.roomCodeInput.value.trim();
  
  if (!roomCode) {
    handleError('Please enter a room code', 'warning');
    return;
  }
  
  updateStatus(`Joining room ${roomCode}...`, 'info');
  Connection.joinRoom(roomCode);
}

/**
 * Copy room code to clipboard
 */
function copyRoomCode() {
  const roomCode = elements.roomCodeText.textContent;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(roomCode)
      .then(() => {
        updateStatus('Room code copied to clipboard!', 'success');
      })
      .catch(err => {
        console.error('Failed to copy room code:', err);
        handleError('Failed to copy room code', 'error');
      });
  } else {
    // Fallback for browsers that don't support clipboard API
    const textArea = document.createElement('textarea');
    textArea.value = roomCode;
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      document.execCommand('copy');
      updateStatus('Room code copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy room code:', err);
      handleError('Failed to copy room code', 'error');
    }
    
    document.body.removeChild(textArea);
  }
}

/**
 * Handle file selection
 * @param {Event|FileList} event - File input change event or FileList
 */
function handleFileSelect(event) {
  let files;
  
  if (event.target && event.target.files) {
    files = event.target.files;
  } else if (event instanceof FileList) {
    files = event;
  } else if (event.dataTransfer && event.dataTransfer.files) {
    files = event.dataTransfer.files;
  }
  
  if (files && files.length > 0) {
    const selectedFiles = FileTransfer.handleFileSelect(files);
    updateSendButtonState(selectedFiles.length > 0);
  }
}

/**
 * Update send button state
 * @param {boolean} filesSelected - Whether files are selected
 */
function updateSendButtonState(filesSelected) {
  const peerReady = Connection.isPeerReady();
  const canSend = filesSelected && peerReady;
  
  console.log('Updating send button state:', {
    filesSelected,
    peerReady,
    canSend
  });
  
  UI.updateSendButtonState(peerReady, filesSelected ? 1 : 0);
}

/**
 * Handle files selected
 * @param {Array} files - Selected files
 */
function handleFilesSelected(files) {
  UI.renderSelectedFiles(files, (index) => {
    FileTransfer.removeFile(index);
    updateSendButtonState(FileTransfer.selectedFiles.length > 0);
  });
  
  updateSendButtonState(files.length > 0);
}

/**
 * Send selected files
 */
function sendFiles() {
  FileTransfer.sendFiles();
}

/**
 * Handle incoming data
 * @param {*} data - Incoming data
 */
function handleIncomingData(data) {
  FileTransfer.handleIncomingData(data);
}

/**
 * Handle file reception start
 * @param {Object} fileInfo - File information
 */
function handleFileReceptionStart(fileInfo) {
  elements.fileReceiving.classList.remove('hidden');
  
  UI.addIncomingFileItem(fileInfo, 
    (fileId) => {
      // Download file
      const blob = FileTransfer.incomingFiles[fileId].blob;
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = FileTransfer.incomingFiles[fileId].name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    },
    (fileId) => {
      // Cancel file
      delete FileTransfer.incomingFiles[fileId];
    }
  );
}

/**
 * Handle file progress
 * @param {Object} fileInfo - File information
 * @param {number} progress - Progress percentage
 */
function handleFileProgress(fileInfo, progress) {
  UI.updateIncomingFileProgress(fileInfo.id, progress);
}

/**
 * Handle file complete
 * @param {string} fileId - File ID
 * @param {Blob} blob - File blob
 */
function handleFileComplete(fileId, blob) {
  const fileInfo = FileTransfer.incomingFiles[fileId];
  if (fileInfo) {
    fileInfo.blob = blob;
    UI.markFileComplete(fileId);
  }
}

/**
 * Handle transfer start
 */
function handleTransferStart() {
  state.isTransferring = true;
  elements.transferStatus.classList.remove('hidden');
}

/**
 * Handle transfer progress
 * @param {number} progress - Progress percentage
 */
function handleTransferProgress(progress) {
  UI.updateTransferProgress(progress);
}

/**
 * Handle transfer speed update
 * @param {number} bytesPerSecond - Bytes per second
 * @param {number} remainingTime - Remaining time in seconds
 */
function handleTransferSpeedUpdate(bytesPerSecond, remainingTime) {
  const speedText = `${Utils.formatFileSize(bytesPerSecond)}/s`;
  const remainingText = Utils.formatTime(remainingTime);
  
  elements.transferSpeed.textContent = speedText;
  elements.transferRemaining.textContent = remainingText;
}

/**
 * Handle transfer complete
 */
function handleTransferComplete() {
  state.isTransferring = false;
  setTimeout(() => {
    elements.transferStatus.classList.add('hidden');
  }, 2000);
}

/**
 * Handle connection status change
 * @param {string} status - Connection status
 * @param {string} details - Connection details
 */
function handleConnectionStatusChange(status, details) {
  UI.updateConnectionStatus(status, details);
  
  if (status === 'connected') {
    state.isConnected = true;
  } else {
    state.isConnected = false;
  }
  
  updateSendButtonState(FileTransfer.selectedFiles.length > 0);
}

/**
 * Handle room joined
 * @param {string} roomCode - Room code
 */
function handleRoomJoined(roomCode) {
  state.roomCode = roomCode;
  updateStatus(`Joined room: ${roomCode}`, 'success');
}

/**
 * Handle user joined
 * @param {string} userId - User ID
 */
function handleUserJoined(userId) {
  updateStatus('Another user has joined the room', 'success');
  elements.fileSelection.classList.remove('hidden');
}

/**
 * Handle user left
 * @param {string} userId - User ID
 */
function handleUserLeft(userId) {
  updateStatus('The other user has left the room', 'warning');
}

/**
 * Handle peer connected
 */
function handlePeerConnected() {
  updateStatus('Peer connection established', 'success');
  updateSendButtonState(FileTransfer.selectedFiles.length > 0);
}

/**
 * Handle peer disconnected
 */
function handlePeerDisconnected() {
  updateStatus('Peer connection closed', 'warning');
  updateSendButtonState(false);
}

/**
 * Handle history updated
 * @param {Object} history - File history
 */
function handleHistoryUpdated(history) {
  UI.initializeFileHistory(
    history,
    (itemId) => FileTransfer.downloadHistoryFile(itemId),
    (itemId, type) => FileTransfer.removeHistoryItem(itemId, type),
    (type) => FileTransfer.clearFileHistory(type)
  );
}

/**
 * Handle error
 * @param {string} message - Error message
 * @param {string} type - Error type
 */
function handleError(message, type = 'error') {
  UI.showStatusMessage(message, type);
}

/**
 * Update status
 * @param {string} message - Status message
 * @param {string} type - Status type
 */
function updateStatus(message, type = 'info') {
  UI.updateStatus(message, type);
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp); 