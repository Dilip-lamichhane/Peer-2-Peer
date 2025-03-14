// Initialize variables
let peer = null;
let ws = null;
let userId = null;
let currentRoom = null;
let isInitiator = false;
let selectedFiles = [];
let incomingFiles = {};
let currentFileTransfer = null;
let transferStartTime = 0;
let bytesReceived = 0;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectTimeout = null;

// Constants for file transfer
const CHUNK_SIZE = 16 * 1024; // 16KB chunks
let chunksQueue = [];
let isSendingChunks = false;

// Use secure protocols if on HTTPS
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${protocol}//${window.location.hostname}:3001`;
const API_URL = `${window.location.protocol}//${window.location.hostname}:3001`;

// DOM Elements
const generateCodeBtn = document.getElementById('generate-code-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const roomCodeDisplay = document.getElementById('room-code-display');
const roomCodeText = document.getElementById('room-code');
const copyCodeBtn = document.getElementById('copy-code-btn');
const fileInput = document.getElementById('file-input');
const selectedFilesList = document.getElementById('selected-files-list');
const incomingFilesList = document.getElementById('incoming-files-list');
const sendFilesBtn = document.getElementById('send-files-btn');
const fileSelection = document.getElementById('file-selection');
const fileReceiving = document.getElementById('file-receiving');
const connectionStatusText = document.getElementById('connection-status-text');
const statusIndicator = document.getElementById('status-indicator');
const transferStatus = document.getElementById('transfer-status');
const progressBar = document.getElementById('progress-bar');
const transferPercentage = document.getElementById('transfer-percentage');
const transferSpeed = document.getElementById('transfer-speed');
const transferRemaining = document.getElementById('transfer-remaining');

// Global variables
let socket;
let roomId;
let pendingChunkMetadata = null;
let bufferedChunks = [];

// Initialize event listeners
document.addEventListener('DOMContentLoaded', initializeApp);

// Initialize the application
function initializeApp() {
  generateCodeBtn.addEventListener('click', generateCode);
  joinRoomBtn.addEventListener('click', joinRoom);
  fileInput.addEventListener('change', handleFileSelect);
  sendFilesBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!sendFilesBtn.disabled) {
      sendFiles();
    }
  });
  copyCodeBtn.addEventListener('click', copyRoomCode);
  
  // Setup file drag and drop
  initializeFileDragAndDrop();
  
  // Initial state
  sendFilesBtn.disabled = true;
  sendFilesBtn.classList.add('disabled');
  
  // Check server health
  checkServerHealth();
  
  // Initialize file history
  initializeFileHistory();
}

// Check if the server is healthy
async function checkServerHealth() {
  try {
    const response = await fetch(`${API_URL}/health`, { 
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      timeout: 5000 // 5 second timeout
    });
    
    if (response.ok) {
      console.log('Server is healthy');
      updateConnectionStatus('connected');
    } else {
      console.error('Server health check failed');
      updateConnectionStatus('disconnected');
      showError('Server is not responding. Please try again later.');
    }
  } catch (error) {
    console.error('Error checking server health:', error);
    updateConnectionStatus('disconnected');
    showError('Cannot connect to the server. Please check your internet connection.');
  }
}

// Generate a room code
async function generateCode() {
  try {
    console.log('Generating room code...');
    
    // Show loading state
    generateCodeBtn.disabled = true;
    generateCodeBtn.textContent = 'Generating...';
    
    // Request a room code from the server
    const response = await fetch(`${API_URL}/api/generate-code`);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Server response:', data);
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to generate room code');
    }
    
    // Set the room code
    const roomCode = data.code;
    currentRoom = roomCode;
    document.getElementById('room-code').textContent = roomCode;
    
    // Show the room code display
    document.getElementById('room-code-display').classList.remove('hidden');
    
    // Hide the generate button
    generateCodeBtn.classList.add('hidden');
    
    // Set as initiator (sender)
    isInitiator = true;
    
    // Connect to signaling server
    connectToSignalingServer();
    
    // Show file selection
    document.getElementById('file-selection').classList.remove('hidden');
    
  } catch (error) {
    console.error('Failed to generate room code:', error);
    showError(`Failed to generate room code: ${error.message}`);
    
    // Reset button
    generateCodeBtn.disabled = false;
    generateCodeBtn.textContent = 'Generate Code';
  }
}

// Show error message to user
function showError(message) {
  updateStatus(message, 'error');
}

// Join a room with the provided code
function joinRoom() {
  const roomCode = document.getElementById('room-code-input').value.trim();
  
  if (!roomCode) {
    showError('Please enter a room code.');
    return;
  }
  
  console.log('Attempting to join room:', roomCode);
  
  // Set as non-initiator (receiver)
  isInitiator = false;
  currentRoom = roomCode;
  
  // Show receiving files UI
  document.getElementById('file-receiving').classList.remove('hidden');
  
  // Connect to signaling server
  connectToSignalingServer();
}

// Connect to the signaling server
function connectToSignalingServer() {
  console.log('Connecting to signaling server...');
  
  // Create WebSocket connection
  console.log('WebSocket URL:', WS_URL);
  ws = new WebSocket(WS_URL);
  
  // Handle WebSocket events
  ws.onopen = () => {
    console.log('Connected to signaling server');
    updateConnectionStatus('connected');
    
    // If we have a room code, join the room
    if (currentRoom) {
      console.log('Sending join request for room:', currentRoom);
      ws.send(JSON.stringify({
        type: 'join',
        room: currentRoom
      }));
    } else {
      console.error('No room code available');
      showError('No room code available. Please refresh and try again.');
    }
  };
  
  ws.onmessage = handleSignalingMessage;
  
  ws.onclose = () => {
    console.log('Disconnected from signaling server');
    updateConnectionStatus('disconnected');
    
    // Try to reconnect
    setTimeout(attemptReconnect, 5000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateConnectionStatus('disconnected');
    showError('Connection error. Please refresh the page.');
  };
}

// Attempt to reconnect to the signaling server
function attemptReconnect() {
  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff with max 30s
  
  console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
  updateConnectionStatus('connecting');
  
  clearTimeout(reconnectTimeout);
  reconnectTimeout = setTimeout(() => {
    if (currentRoom) {
      connectToSignalingServer();
    }
  }, delay);
}

// Reset UI elements
function resetUI() {
  generateCodeBtn.disabled = false;
  joinRoomBtn.disabled = false;
}

// Handle signaling messages
function handleSignalingMessage(event) {
  try {
    const message = JSON.parse(event.data);
    console.log('Received signaling message:', message.type);
    
    switch (message.type) {
      case 'joined':
        console.log('Successfully joined room:', message.room);
        currentRoom = message.room;
        updateConnectionStatus('connected');
        
        // If we're the receiver (joining an existing room), create peer connection
        if (!peer && !isInitiator) {
          console.log('Creating peer connection as receiver');
          initiatePeerConnection(false);
        }
        break;
        
      case 'user-joined':
        console.log('Another user joined the room:', message.userId);
        updateConnectionStatus('connected');
        
        // If we're the initiator (created the room), create peer connection
        if (!peer && isInitiator) {
          console.log('Creating peer connection as initiator');
          initiatePeerConnection(true);
        }
        break;
        
      case 'user-left':
        console.log('User left the room:', message.userId);
        updateConnectionStatus('disconnected');
        if (peer) {
          peer.destroy();
          peer = null;
        }
        break;
        
      case 'offer':
        console.log('Received offer from peer');
        if (peer) {
          handleVideoOffer(message);
        } else {
          console.error('Received offer but peer connection not initialized');
          initiatePeerConnection(false);
          setTimeout(() => handleVideoOffer(message), 100);
        }
        break;
        
      case 'answer':
        console.log('Received answer from peer');
        if (peer) {
          handleVideoAnswer(message);
        } else {
          console.error('Received answer but peer connection not initialized');
        }
        break;
        
      case 'ice-candidate':
      case 'candidate':
        console.log('Received ICE candidate');
        if (peer) {
          handleNewICECandidate(message);
        } else {
          console.error('Received ICE candidate but peer connection not initialized');
        }
        break;
        
      case 'error':
        console.error('Signaling error:', message.message);
        showError(message.message);
        break;
        
      case 'file-metadata':
        console.log('Received file metadata:', message);
        // Initialize file reception
        initFileReception(message);
        break;
        
      case 'file-complete':
        console.log('File transfer complete:', message);
        // Finalize the file
        finalizeFile(message.fileId);
        break;
        
      case 'retry-request':
        // Handle retry request from receiver
        const fileId = message.fileId;
        console.log(`Received retry request for file ${fileId}`);
        
        // Find the file in selectedFiles
        const fileToRetry = Array.from(selectedFiles).find(file => 
          file.uniqueId === fileId || generateFileId(file) === fileId
        );
        
        if (fileToRetry) {
          // Resend the file
          console.log(`Retrying file transfer for ${fileToRetry.name}`);
          sendFileChunks(fileToRetry);
          updateStatus(`Retrying file transfer for ${fileToRetry.name}`);
        } else {
          console.error(`File with ID ${fileId} not found for retry`);
          updateStatus(`Error: Could not find file to retry`, 'error');
        }
        break;
        
      default:
        console.warn('Unhandled message type:', message.type);
    }
  } catch (error) {
    console.error('Error handling signaling message:', error);
  }
}

// Handle video offer message
function handleVideoOffer(message) {
  if (!peer) {
    console.log('Creating peer connection to handle offer');
    initiatePeerConnection(false);
  }
  
  try {
    console.log('Setting remote description from offer');
    peer.signal(message.data);
  } catch (error) {
    console.error('Error handling video offer:', error);
    showError('Failed to process connection offer.');
  }
}

// Handle video answer message
function handleVideoAnswer(message) {
  try {
    console.log('Setting remote description from answer');
    peer.signal(message.data);
  } catch (error) {
    console.error('Error handling video answer:', error);
    showError('Failed to process connection answer.');
  }
}

// Handle ICE candidate
function handleNewICECandidate(message) {
  try {
    const candidate = message.data.candidate || message.data;
    console.log('Adding ICE candidate:', candidate);
    
    if (peer) {
      peer.signal(message.data);
      console.log('ICE candidate added successfully');
    } else {
      console.error('Cannot add ICE candidate, peer connection not initialized');
    }
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
}

// Initiate a peer connection
function initiatePeerConnection(isInitiator) {
  console.log('Initiating peer connection, isInitiator:', isInitiator);
  
  const peerOptions = {
    initiator: isInitiator,
    trickle: true,
    config: {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] }
      ]
    },
    channelConfig: {
      ordered: true
    }
  };
  
  // Create the peer connection
  peer = new SimplePeer(peerOptions);
  console.log('Peer created with options:', peerOptions);
  
  // Setup peer events
  setupPeerEvents();
  
  // Update send button state after a delay to ensure connection is ready
  setTimeout(() => {
    updateSendButtonState();
  }, 1000);
  
  return peer;
}

// Setup peer connection events
function setupPeerEvents() {
  peer.on('signal', (data) => {
    console.log('Generated signal data:', data.type || 'candidate');
    
    // Send signal data to the other peer via the signaling server
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('Sending signal to peer in room:', currentRoom);
      ws.send(JSON.stringify({
        type: data.type || 'ice-candidate',
        data: data,
        room: currentRoom
      }));
    } else {
      console.error('WebSocket not connected, cannot send signal');
      showError('Signaling server connection lost. Please refresh the page.');
    }
  });
  
  peer.on('connect', () => {
    console.log('Peer connection established!');
    console.log('Connection details:', {
      isInitiator: peer._initiator,
      channelReady: peer._channel ? peer._channel.readyState : 'No data channel',
      connected: peer.connected,
      selectedFiles: selectedFiles.length,
      currentRoom: currentRoom
    });
    
    updateConnectionStatus('connected');
    
    // Force update send button state
    setTimeout(() => {
      console.log('Forcing send button state update after connection');
      updateSendButtonState();
      
      // Add click event listener directly to ensure it's clickable
      if (selectedFiles.length > 0 && peer.connected) {
        console.log('Adding direct click handler to send button');
        sendFilesBtn.onclick = (e) => {
          e.preventDefault();
          if (!sendFilesBtn.disabled) {
            sendFiles();
          }
        };
      }
    }, 500);
  });
  
  peer.on('data', (data) => {
    console.log('Received data type:', typeof data, data instanceof ArrayBuffer ? 'ArrayBuffer' : data instanceof Uint8Array ? 'Uint8Array' : 'other');
    console.log('Data size:', typeof data === 'string' ? data.length + ' chars' : data.byteLength + ' bytes');
    handleIncomingData(data);
  });
  
  peer.on('error', (error) => {
    console.error('Peer connection error:', error);
    console.error('Error details:', error.stack);
    updateConnectionStatus('disconnected');
    showError('Connection error. Please try again.');
    updateSendButtonState();
  });
  
  peer.on('close', () => {
    console.log('Peer connection closed');
    updateConnectionStatus('disconnected');
    updateSendButtonState();
    peer = null;
  });
}

// Handle file selection
function handleFileSelect(event) {
  const files = event.target.files;
  
  if (files.length > 0) {
    console.log('Files selected:', files.length);
    selectedFiles = Array.from(files);
    renderSelectedFiles();
    
    // Update send button state after a small delay to ensure peer connection is ready
    setTimeout(() => {
      updateSendButtonState();
    }, 100);
  }
}

// Update send button state
function updateSendButtonState() {
  const peerReady = isPeerReady();
  const canSend = selectedFiles.length > 0 && peerReady;
  
  console.log('Updating send button state:', {
    filesSelected: selectedFiles.length > 0,
    peerExists: !!peer,
    peerConnected: peer ? peer.connected : false,
    peerReady: peerReady,
    canSend: canSend
  });
  
  // Force enable the button if conditions are met
  sendFilesBtn.disabled = !canSend;
  
  // Update button classes
  if (canSend) {
    sendFilesBtn.classList.remove('disabled');
    sendFilesBtn.classList.add('enabled');
    sendFilesBtn.style.pointerEvents = 'auto';
    sendFilesBtn.style.cursor = 'pointer';
  } else {
    sendFilesBtn.classList.remove('enabled');
    sendFilesBtn.classList.add('disabled');
    sendFilesBtn.style.pointerEvents = 'none';
    sendFilesBtn.style.cursor = 'not-allowed';
  }
  
  // Log the final button state
  console.log('Send button final state:', {
    disabled: sendFilesBtn.disabled,
    classList: sendFilesBtn.className,
    pointerEvents: sendFilesBtn.style.pointerEvents,
    cursor: sendFilesBtn.style.cursor
  });
}

// Render selected files
function renderSelectedFiles() {
  const filesList = document.getElementById('selected-files-list');
  if (!filesList) return;
  
  filesList.innerHTML = '';
  
  if (selectedFiles.length === 0) {
    filesList.innerHTML = '<div class="no-files-message">No files selected</div>';
    return;
  }
  
  selectedFiles.forEach((file, index) => {
    const fileId = file.uniqueId || generateFileId(file);
    
    // Get file icon based on extension
    const fileIcon = getFileIcon(file.name);
    
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.id = `file-${fileId}`;
    
    const fileIconElement = document.createElement('div');
    fileIconElement.className = 'file-icon';
    fileIconElement.innerHTML = `<span class="material-icons">${fileIcon}</span>`;
    
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    
    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = file.name;
    
    const fileSize = document.createElement('div');
    fileSize.className = 'file-size';
    fileSize.textContent = formatFileSize(file.size);
    
    const fileProgress = document.createElement('div');
    fileProgress.className = 'file-progress';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'file-progress-bar';
    
    const progressIndicator = document.createElement('div');
    progressIndicator.className = 'file-progress-indicator';
    progressBar.appendChild(progressIndicator);
    
    const progressValue = document.createElement('div');
    progressValue.className = 'file-progress-value';
    progressValue.textContent = 'Ready to send';
    
    fileProgress.appendChild(progressBar);
    fileProgress.appendChild(progressValue);
    
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);
    fileInfo.appendChild(fileProgress);
    
    const fileActions = document.createElement('div');
    fileActions.className = 'file-actions';
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'retry-btn';
    removeBtn.innerHTML = '<span class="material-icons">close</span>';
    removeBtn.title = 'Remove file';
    removeBtn.addEventListener('click', () => {
      selectedFiles.splice(index, 1);
      renderSelectedFiles();
      updateSendButtonState();
    });
    
    fileActions.appendChild(removeBtn);
    
    fileItem.appendChild(fileIconElement);
    fileItem.appendChild(fileInfo);
    fileItem.appendChild(fileActions);
    
    filesList.appendChild(fileItem);
  });
}

// Send files to the peer
function sendFiles() {
  console.log('Send files button clicked');
  console.log('Current state:', {
    filesSelected: selectedFiles.length,
    peerExists: !!peer,
    peerConnected: peer && peer.connected
  });

  if (!selectedFiles.length) {
    updateStatus('Please select files to send', 'warning');
    return;
  }

  if (!peer || !peer.connected) {
    updateStatus('No connection to peer', 'error');
    return;
  }

  // Disable send button to prevent multiple sends
  const sendButton = document.getElementById('send-files-btn');
  sendButton.disabled = true;
  sendButton.classList.remove('enabled');
  sendButton.classList.add('disabled');

  console.log(`Starting file transfer for ${selectedFiles.length} files`);
  updateStatus(`Preparing to send ${selectedFiles.length} files...`);

  // Show transfer status
  document.getElementById('transfer-status').classList.remove('hidden');

  // Send files one by one
  let fileIndex = 0;

  function sendNextFile() {
    if (fileIndex >= selectedFiles.length) {
      console.log('All files sent');
      updateStatus('All files sent successfully');
      
      // Re-enable send button
      sendButton.disabled = false;
      sendButton.classList.remove('disabled');
      sendButton.classList.add('enabled');
      return;
    }

    const file = selectedFiles[fileIndex];
    console.log(`Preparing to send file ${fileIndex + 1}/${selectedFiles.length}: ${file.name}`);

    // Generate a unique ID for this file if it doesn't have one
    if (!file.uniqueId) {
      file.uniqueId = generateFileId(file);
    }

    // Send file metadata first
    const metadata = {
      type: 'file-metadata',
      fileId: file.uniqueId,
      name: file.name,
      size: file.size,
      fileType: file.type,
      lastModified: file.lastModified
    };

    console.log('Sending file metadata:', metadata);
    
    // Convert metadata to string and send
    peer.send(JSON.stringify(metadata));
    
    // Start sending the file chunks after a delay to ensure metadata is processed first
    setTimeout(() => {
      sendFileChunks(file)
        .then(() => {
          console.log(`File ${file.name} sent successfully`);
          updateStatus(`File ${file.name} sent successfully`);
          fileIndex++;
          setTimeout(sendNextFile, 500); // Small delay between files
        })
        .catch(error => {
          console.error(`Error sending file ${file.name}:`, error);
          updateStatus(`Error sending file ${file.name}`, 'error');
          
          // Re-enable send button
          sendButton.disabled = false;
          sendButton.classList.remove('disabled');
          sendButton.classList.add('enabled');
        });
    }, 300); // Increased delay to ensure metadata is processed before chunks
  }

  sendNextFile();
}

// Send file in chunks
async function sendFileChunks(file) {
  console.log(`Sending file: ${file.name}, size: ${file.size} bytes`);
  updateStatus(`Sending ${file.name}...`);

  return new Promise((resolve, reject) => {
    const chunkSize = 16 * 1024; // 16KB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    let sentChunks = 0;
    let startTime = Date.now();
    let lastUpdateTime = startTime;
    let bytesTransferred = 0;

    console.log(`File will be split into ${totalChunks} chunks`);

    const fileReader = new FileReader();
    
    // When a chunk is loaded
    fileReader.onload = function(event) {
      if (!peer || !peer.connected) {
        reject(new Error('Connection lost during file transfer'));
        return;
      }

      const chunkData = event.target.result;
      bytesTransferred += chunkData.byteLength;

      // Send chunk metadata first
      const chunkMetadata = {
        type: 'file-chunk',
        fileId: file.uniqueId,
        index: sentChunks,
        total: totalChunks,
        size: chunkData.byteLength
      };
      
      // Send metadata as string
      peer.send(JSON.stringify(chunkMetadata));
      
      // Then send the binary chunk data after a delay
      setTimeout(() => {
        peer.send(chunkData);
        
        sentChunks++;
        console.log(`Sending chunk ${sentChunks}/${totalChunks} of file ${file.name}`);

        // Update progress
        const progress = (sentChunks / totalChunks) * 100;
        updateTransferProgress(progress);
        updateFileProgress(file, progress);

        // Calculate transfer speed every second
        const now = Date.now();
        if (now - lastUpdateTime > 1000) {
          const elapsedSeconds = (now - startTime) / 1000;
          const bytesPerSecond = bytesTransferred / elapsedSeconds;
          const remainingBytes = file.size - bytesTransferred;
          const remainingTime = remainingBytes / bytesPerSecond;

          document.getElementById('transfer-speed').textContent = `${formatFileSize(bytesPerSecond)}/s`;
          document.getElementById('transfer-remaining').textContent = `${formatTime(remainingTime)} remaining`;

          lastUpdateTime = now;
        }

        // Read next chunk or finish
        if (sentChunks < totalChunks) {
          readNextChunk();
        } else {
          console.log(`All chunks of ${file.name} have been sent`);
          
          // Send transfer complete message
          const completeMessage = {
            type: 'transfer-complete',
            fileId: file.uniqueId,
            name: file.name,
            size: file.size
          };
          
          peer.send(JSON.stringify(completeMessage));
          updateStatus(`File ${file.name} sent successfully`);
          resolve();
        }
      }, 100); // Increased delay between metadata and chunk data
    };

    fileReader.onerror = function(error) {
      console.error(`Error reading file ${file.name}:`, error);
      reject(error);
    };

    function readNextChunk() {
      const start = sentChunks * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      fileReader.readAsArrayBuffer(chunk);
    }

    // Start reading the first chunk
    readNextChunk();
  });
}

// Handle incoming data
function handleIncomingData(data) {
  console.log("Received data type:", typeof data, data);
  console.log("Data size:", data.byteLength || data.length, "bytes");
  
  // Check if data is binary (Uint8Array)
  if (data instanceof Uint8Array) {
    console.log("Received binary data of size", data.byteLength, "bytes");
    
    // Try to decode binary data as text and check if it's JSON
    try {
      const decoder = new TextDecoder();
      const text = decoder.decode(data);
      
      // Check if the text starts with '{' which indicates it might be JSON
      if (text.startsWith('{')) {
        try {
          const message = JSON.parse(text);
          console.log("Parsed JSON message from binary data:", message);
          processJsonMessage(message);
          return;
        } catch (e) {
          console.log("Not valid JSON, processing as binary data");
        }
      }
      
      // If we have active file transfers, try to process the binary data as a chunk
      const activeTransfers = Object.keys(incomingFiles).length;
      
      // If we have active file transfers and the last message was a chunk metadata
      if (activeTransfers > 0 && pendingChunkMetadata) {
        processChunk(pendingChunkMetadata, data);
        pendingChunkMetadata = null;
        return;
      }
      
      // If we don't have active transfers or no recent chunk metadata, 
      // and the data is small (likely a stray message), just ignore it
      if (data.byteLength < 200 && activeTransfers === 0) {
        console.log("Ignoring small binary data after transfer completion");
        return;
      }
      
      // Otherwise, buffer the data temporarily
      console.log("Received binary data without metadata, buffering temporarily");
      const timestamp = Date.now();
      
      // Initialize bufferedChunks if it doesn't exist
      if (!window.bufferedChunks) {
        window.bufferedChunks = [];
      }
      
      window.bufferedChunks.push({ data, timestamp });
      
      // Clean up old buffered chunks (older than 30 seconds)
      const oldTimestamp = Date.now() - 30000;
      window.bufferedChunks = window.bufferedChunks.filter(chunk => chunk.timestamp > oldTimestamp);
      
      // Update UI to indicate we're waiting for metadata
      updateStatus("Waiting for file metadata...", "warning");
    } catch (e) {
      console.error("Error processing binary data:", e);
    }
  } else {
    // Handle JSON data
    try {
      const message = JSON.parse(data);
      processJsonMessage(message);
    } catch (e) {
      console.error("Error parsing JSON data:", e);
    }
  }
}

// Process JSON messages
function processJsonMessage(data) {
  console.log('Processing JSON message:', data);
  const { type, fileId, fileName, fileSize, totalChunks, chunkIndex, isLastChunk, roomId } = data;

  // File container should be visible when receiving files
  const fileReceivingContainer = document.getElementById('file-receiving');
  if (!fileReceivingContainer) {
    console.error('File receiving container not found');
    return;
  }
  
  // Remove hidden class if it exists
  fileReceivingContainer.classList.remove('hidden');

  if (!incomingFiles[fileId]) {
    incomingFiles[fileId] = {
      id: fileId,
      name: fileName,
      size: fileSize,
      totalChunks,
      receivedChunks: 0,
      chunks: new Array(totalChunks),
      complete: false
    };
  }

  // If we have buffered chunks for this file, process them
  if (pendingChunkMetadata && pendingChunkMetadata.fileId === fileId) {
    processChunk(pendingChunkMetadata, pendingChunkMetadata.chunk);
    pendingChunkMetadata = null;
  }

  // Update UI to show incoming file
  const incomingFilesList = document.getElementById('incoming-files-list');
  if (!incomingFilesList) {
    console.error('Incoming files list not found');
    return;
  }

  // Check if we already have a file item for this fileId
  let fileItem = document.getElementById(`file-${fileId}`);
  
  if (!fileItem) {
    // Get appropriate file icon based on file extension
    const fileIcon = getFileIcon(fileName);
    
    // Create a new file item
    fileItem = document.createElement('div');
    fileItem.id = `file-${fileId}`;
    fileItem.className = 'file-item';
    
    const fileIconElement = document.createElement('div');
    fileIconElement.className = 'file-icon';
    fileIconElement.innerHTML = `<span class="material-icons">${fileIcon}</span>`;
    
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    
    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = incomingFiles[fileId].name;
    
    const fileSize = document.createElement('div');
    fileSize.className = 'file-size';
    fileSize.textContent = formatFileSize(incomingFiles[fileId].size);
    
    const fileProgress = document.createElement('div');
    fileProgress.className = 'file-progress';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'file-progress-bar';
    
    const progressIndicator = document.createElement('div');
    progressIndicator.className = 'file-progress-indicator';
    progressBar.appendChild(progressIndicator);
    
    const progressValue = document.createElement('div');
    progressValue.className = 'file-progress-value';
    progressValue.textContent = '0%';
    
    fileProgress.appendChild(progressBar);
    fileProgress.appendChild(progressValue);
    
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);
    fileInfo.appendChild(fileProgress);
    
    const fileActions = document.createElement('div');
    fileActions.className = 'file-actions';
    
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<span class="material-icons">download</span>';
    downloadBtn.addEventListener('click', () => {
      const file = incomingFiles[fileId];
      if (file && file.complete) {
        const blob = new Blob(file.chunks);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        window.setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 0);
      }
    });
    
    const retryBtn = document.createElement('button');
    retryBtn.className = 'retry-btn';
    retryBtn.style.display = 'none';
    retryBtn.innerHTML = '<span class="material-icons">refresh</span>';
    retryBtn.addEventListener('click', () => {
      if (peer && peer.connected) {
        // Request the file again
        peer.send(JSON.stringify({
          type: 'request-resend',
          fileId: fileId
        }));
        
        retryBtn.style.display = 'none';
        showStatusMessage('Requested file resend...', 'warning');
      }
    });
    
    fileActions.appendChild(downloadBtn);
    fileActions.appendChild(retryBtn);
    
    fileItem.appendChild(fileIconElement);
    fileItem.appendChild(fileInfo);
    fileItem.appendChild(fileActions);
    
    incomingFilesList.appendChild(fileItem);
  }
  
  // Update progress
  updateFileProgress(fileId);
}

// File reception state
let receivingFiles = {};

// Initialize file reception
function initFileReception(metadata) {
  const fileId = metadata.id;
  
  console.log(`Initializing reception for file: ${metadata.name}, size: ${formatFileSize(metadata.size)}`);
  
  // Make sure the file receiving container is visible
  document.getElementById('file-receiving').classList.remove('hidden');
  
  // Create a new file entry
  receivingFiles[fileId] = {
    metadata: metadata,
    chunks: new Array(Math.ceil(metadata.size / (16 * 1024))),
    receivedChunks: 0,
    completed: false
  };
  
  // Add file to the UI
  const filesList = document.getElementById('incoming-files-list');
  const fileItem = document.createElement('div');
  fileItem.className = 'file-item';
  fileItem.id = `file-item-${fileId}`;
  fileItem.innerHTML = `
    <div class="file-icon">
      <span class="material-icons">description</span>
    </div>
    <div class="file-info">
      <div class="file-name">${metadata.name}</div>
      <div class="file-size">${formatFileSize(metadata.size)}</div>
      <div class="file-progress">Receiving... 0%</div>
    </div>
    <div class="file-actions">
      <button class="download-btn" id="download-${fileId}" disabled>
        <span class="material-icons">download</span>
      </button>
    </div>
  `;
  
  filesList.appendChild(fileItem);
  
  // Show the transfer status
  document.getElementById('transfer-status').classList.remove('hidden');
  
  console.log(`File reception initialized for ${metadata.name}`);
}

// Process a chunk with its metadata
function processChunk(message, chunkData) {
  const fileId = message.fileId;
  const chunkIndex = message.index;
  
  console.log(`Processing chunk ${chunkIndex + 1}/${message.total} for file ${fileId}`);
  
  // Check if we have metadata for this file
  if (!incomingFiles[fileId]) {
    console.error(`No metadata found for file ${fileId}`);
    updateStatus(`Error: Received chunk for unknown file`, 'error');
    return;
  }
  
  const fileInfo = incomingFiles[fileId];
  
  // Initialize chunks array if it doesn't exist
  if (!fileInfo.chunks) {
    fileInfo.chunks = {};
    fileInfo.receivedChunks = 0;
  }
  
  // Store the chunk
  fileInfo.chunks[chunkIndex] = new Uint8Array(chunkData);
  fileInfo.receivedChunks++;
  
  // Update progress
  const progress = Math.min(100, Math.round((fileInfo.receivedChunks / message.total) * 100));
  
  // Update UI
  const fileItem = document.getElementById(`file-${fileId}`);
  if (fileItem) {
    const fileProgress = fileItem.querySelector('.file-progress');
    const progressIndicator = fileItem.querySelector('.file-progress-indicator');
    const progressValue = fileItem.querySelector('.file-progress-value');
    const downloadBtn = fileItem.querySelector('.download-btn');
    
    if (progressIndicator) {
      progressIndicator.style.width = `${progress}%`;
    }
    
    if (progressValue) {
      progressValue.textContent = `${progress}%`;
    }
  }
  
  // Check if all chunks have been received
  if (fileInfo.receivedChunks === message.total) {
    console.log(`All chunks received for file ${fileId}`);
    
    // Combine chunks and create file
    createFileFromChunks(fileInfo)
      .then(url => {
        console.log(`File ${fileId} created successfully`);
        
        // Update UI
        if (fileItem) {
          const fileProgress = fileItem.querySelector('.file-progress');
          const progressIndicator = fileItem.querySelector('.file-progress-indicator');
          const progressValue = fileItem.querySelector('.file-progress-value');
          const downloadBtn = fileItem.querySelector('.download-btn');
          
          if (progressIndicator) progressIndicator.style.width = '100%';
          if (progressValue) progressValue.textContent = '100%';
          if (downloadBtn) downloadBtn.disabled = false;
          
          if (fileProgress) {
            fileProgress.innerHTML = '';
            const statusIcon = document.createElement('span');
            statusIcon.className = 'material-icons';
            statusIcon.textContent = 'check_circle';
            statusIcon.style.color = 'var(--success-color)';
            
            const statusText = document.createElement('span');
            statusText.textContent = 'File ready for download';
            statusText.style.color = 'var(--success-color)';
            
            fileProgress.appendChild(statusIcon);
            fileProgress.appendChild(statusText);
          }
        }
        
        updateStatus(`File ${fileInfo.metadata.name} received successfully`);
      })
      .catch(error => {
        console.error(`Error creating file ${fileId}:`, error);
        
        // Update UI to show error
        if (fileItem) {
          const fileProgress = fileItem.querySelector('.file-progress');
          if (fileProgress) {
            fileProgress.innerHTML = '';
            const statusIcon = document.createElement('span');
            statusIcon.className = 'material-icons';
            statusIcon.textContent = 'error';
            statusIcon.style.color = 'var(--error-color)';
            
            const statusText = document.createElement('span');
            statusText.textContent = 'Transfer incomplete - click retry';
            statusText.style.color = 'var(--error-color)';
            
            fileProgress.appendChild(statusIcon);
            fileProgress.appendChild(statusText);
          }
          
          const retryBtn = fileItem.querySelector('.retry-btn');
          if (retryBtn) {
            retryBtn.style.display = 'flex';
          }
        }
        
        updateStatus(`Error processing file: ${error.message}`, 'error');
      });
  }
}

// Finalize file when all chunks are received
function finalizeFile(fileId) {
  console.log(`Finalizing file ${fileId}`);
  const file = incomingFiles[fileId];
  
  if (!file) {
    console.error(`No file information found for ${fileId}`);
    return;
  }
  
  const incomingFilesList = document.getElementById('incoming-files-list');
  
  // Check if we already have a file item for this fileId
  let fileItem = document.getElementById(`file-${fileId}`);
  
  if (!fileItem && incomingFilesList) {
    // Get appropriate file icon based on file extension
    const fileIcon = getFileIcon(file.name);
    
    // Create a new file item if it doesn't exist yet
    fileItem = document.createElement('div');
    fileItem.id = `file-${fileId}`;
    fileItem.className = 'file-item';
    
    const fileIconElement = document.createElement('div');
    fileIconElement.className = 'file-icon';
    fileIconElement.innerHTML = `<span class="material-icons">${fileIcon}</span>`;
    
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    
    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = file.name;
    
    const fileSize = document.createElement('div');
    fileSize.className = 'file-size';
    fileSize.textContent = formatFileSize(file.size);
    
    const fileProgress = document.createElement('div');
    fileProgress.className = 'file-progress';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'file-progress-bar';
    
    const progressIndicator = document.createElement('div');
    progressIndicator.className = 'file-progress-indicator';
    progressBar.appendChild(progressIndicator);
    
    const progressValue = document.createElement('div');
    progressValue.className = 'file-progress-value';
    
    fileProgress.appendChild(progressBar);
    fileProgress.appendChild(progressValue);
    
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);
    fileInfo.appendChild(fileProgress);
    
    const fileActions = document.createElement('div');
    fileActions.className = 'file-actions';
    
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.innerHTML = '<span class="material-icons">download</span>';
    downloadBtn.addEventListener('click', () => {
      const file = incomingFiles[fileId];
      if (file && file.complete) {
        const blob = new Blob(file.chunks);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        window.setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 0);
      }
    });
    
    const retryBtn = document.createElement('button');
    retryBtn.className = 'retry-btn';
    retryBtn.style.display = 'none';
    retryBtn.innerHTML = '<span class="material-icons">refresh</span>';
    
    fileActions.appendChild(downloadBtn);
    fileActions.appendChild(retryBtn);
    
    fileItem.appendChild(fileIconElement);
    fileItem.appendChild(fileInfo);
    fileItem.appendChild(fileActions);
    
    incomingFilesList.appendChild(fileItem);
  }
  
  // Check if all chunks have been received
  const allChunksReceived = file.chunks.every(chunk => chunk !== undefined);
  
  if (allChunksReceived) {
    file.complete = true;
    
    // Create a blob from the chunks
    const blob = new Blob(file.chunks);
    
    // Add to history
    addFileToHistory({
      name: file.name,
      size: file.size,
      type: blob.type,
      blob: blob
    }, 'received');
    
    // Update the UI
    if (fileItem) {
      const fileProgress = fileItem.querySelector('.file-progress');
      const progressIndicator = fileItem.querySelector('.file-progress-indicator');
      const progressValue = fileItem.querySelector('.file-progress-value');
      const downloadBtn = fileItem.querySelector('.download-btn');
      
      if (progressIndicator) progressIndicator.style.width = '100%';
      if (progressValue) progressValue.textContent = '100%';
      if (downloadBtn) downloadBtn.disabled = false;
      
      if (fileProgress) {
        fileProgress.innerHTML = '';
        const statusIcon = document.createElement('span');
        statusIcon.className = 'material-icons';
        statusIcon.textContent = 'check_circle';
        statusIcon.style.color = 'var(--success-color)';
        
        const statusText = document.createElement('span');
        statusText.textContent = 'File ready for download';
        statusText.style.color = 'var(--success-color)';
        
        fileProgress.appendChild(statusIcon);
        fileProgress.appendChild(statusText);
      }
    }
    
    showStatusMessage(`File "${file.name}" is ready to download!`, 'success');
    console.log(`File ${fileId} complete and ready for download`);
  } else {
    file.complete = false;
    
    // Update UI to show error
    if (fileItem) {
      const retryBtn = fileItem.querySelector('.retry-btn');
      if (retryBtn) retryBtn.style.display = 'flex';
      
      const fileProgress = fileItem.querySelector('.file-progress');
      if (fileProgress) {
        fileProgress.innerHTML = '';
        const statusIcon = document.createElement('span');
        statusIcon.className = 'material-icons';
        statusIcon.textContent = 'error';
        statusIcon.style.color = 'var(--error-color)';
        
        const statusText = document.createElement('span');
        statusText.textContent = 'Transfer incomplete - click retry';
        statusText.style.color = 'var(--error-color)';
        
        fileProgress.appendChild(statusIcon);
        fileProgress.appendChild(statusText);
      }
    }
    
    console.error(`File ${fileId} is incomplete!`);
    showStatusMessage(`File "${file.name}" transfer is incomplete. Try again.`, 'error');
  }
}

// Update transfer progress
function updateTransferProgress(progress) {
  const progressBar = document.querySelector('.progress-bar');
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
    progressBar.textContent = `${Math.round(progress)}%`;
  }
}

// Update connection status
function updateConnectionStatus(status, details = '') {
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('connection-status-text');
  
  if (!statusIndicator || !statusText) return;
  
  // Remove all status classes
  statusIndicator.classList.remove('offline', 'connecting', 'online');
  
  // Create details element if needed
  let statusDetails = document.querySelector('.connection-status .status-details');
  if (!statusDetails && details) {
    statusDetails = document.createElement('span');
    statusDetails.className = 'status-details';
    document.querySelector('.connection-status').appendChild(statusDetails);
  }
  
  // Update status based on connection state
  switch (status) {
    case 'connected':
      statusIndicator.classList.add('online');
      statusText.textContent = 'Connected';
      statusText.style.color = 'var(--success-color)';
      
      // Show connection animation
      const connectionAnimation = document.createElement('div');
      connectionAnimation.className = 'connection-animation';
      document.querySelector('.connection-status').appendChild(connectionAnimation);
      
      // Remove animation after 2 seconds
      setTimeout(() => {
        if (connectionAnimation.parentElement) {
          connectionAnimation.parentElement.removeChild(connectionAnimation);
        }
      }, 2000);
      
      // Show success message
      showStatusMessage('Connected successfully!', 'success');
      break;
      
    case 'connecting':
      statusIndicator.classList.add('connecting');
      statusText.textContent = 'Connecting...';
      statusText.style.color = 'var(--warning-color)';
      break;
      
    case 'disconnected':
    default:
      statusIndicator.classList.add('offline');
      statusText.textContent = 'Disconnected';
      statusText.style.color = 'var(--error-color)';
      break;
  }
  
  // Update details text if provided
  if (statusDetails && details) {
    statusDetails.textContent = details;
  }
}

// Update status message
function updateStatus(message, type = 'info') {
  console.log(`Status update (${type}): ${message}`);
  
  // Get or create status element
  let statusElement = document.getElementById('status-message');
  if (!statusElement) {
    statusElement = document.createElement('div');
    statusElement.id = 'status-message';
    document.querySelector('.main-content').appendChild(statusElement);
  }
  
  // Update status message
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
  
  // Show the status message
  statusElement.style.display = 'block';
  
  // Hide after a delay for non-error messages
  if (type !== 'error') {
    setTimeout(() => {
      statusElement.style.opacity = '0';
      setTimeout(() => {
        statusElement.style.display = 'none';
        statusElement.style.opacity = '1';
      }, 500);
    }, 3000);
  }
}

// Copy room code to clipboard
function copyRoomCode() {
  navigator.clipboard.writeText(currentRoom).then(() => {
    const originalText = copyCodeBtn.innerHTML;
    copyCodeBtn.innerHTML = '<span class="material-icons">check</span>';
    
    setTimeout(() => {
      copyCodeBtn.innerHTML = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    showError('Failed to copy to clipboard. Please copy the code manually.');
  });
}

// Utility Functions
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)}s remaining`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s remaining`;
  } else {
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m remaining`;
  }
}

// Add this new function to check if the peer connection is truly ready
function isPeerReady() {
  if (!peer) return false;
  if (!peer.connected) return false;
  if (peer._channel && peer._channel.readyState !== 'open') return false;
  return true;
}

function requestFileRetry(fileId) {
  console.log(`Requesting retry for file ${fileId}`);
  
  if (!peer || !peer.connected) {
    updateStatus('Cannot retry: No connection to peer', 'error');
    return;
  }
  
  // Send retry request to the sender
  const retryRequest = {
    type: 'retry-request',
    fileId: fileId
  };
  
  try {
    peer.send(JSON.stringify(retryRequest));
    
    // Update UI
    const fileItem = document.getElementById(`file-${fileId}`);
    const fileStatus = fileItem.querySelector('.file-status');
    const progressBar = fileItem.querySelector('.file-progress-bar');
    
    fileStatus.textContent = 'Retrying...';
    progressBar.style.backgroundColor = '#f39c12';
    
    // Reset the file data to prepare for receiving it again
    if (incomingFiles[fileId]) {
      incomingFiles[fileId].chunks = {};
      incomingFiles[fileId].receivedChunks = 0;
      incomingFiles[fileId].status = 'retrying';
    }
    
    updateStatus(`Requested retry for file transfer`);
  } catch (error) {
    console.error('Error sending retry request:', error);
    updateStatus(`Error requesting retry: ${error.message}`, 'error');
  }
}

function createFileFromChunks(fileInfo) {
  return new Promise((resolve, reject) => {
    try {
      const metadata = fileInfo.metadata;
      const chunks = fileInfo.chunks;
      
      // Get chunk indices and sort them to ensure correct order
      const chunkIndices = Object.keys(chunks).map(Number).sort((a, b) => a - b);
      const totalChunks = chunkIndices.length;
      
      console.log(`Creating file from ${totalChunks} chunks`);
      
      // Calculate total size
      let totalSize = 0;
      for (const index of chunkIndices) {
        totalSize += chunks[index].byteLength;
      }
      
      // Create a new array buffer to hold the entire file
      const fileData = new Uint8Array(totalSize);
      
      // Copy chunks into the file data
      let offset = 0;
      for (const index of chunkIndices) {
        const chunk = chunks[index];
        fileData.set(chunk, offset);
        offset += chunk.byteLength;
      }
      
      // Create a blob from the file data
      const blob = new Blob([fileData], { type: metadata.fileType || 'application/octet-stream' });
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      
      resolve(url);
    } catch (error) {
      console.error('Error creating file from chunks:', error);
      reject(error);
    }
  });
}

function updateFileProgress(fileId) {
  const file = incomingFiles[fileId];
  if (!file) return;
  
  const fileItem = document.getElementById(`file-${fileId}`);
  if (!fileItem) return;
  
  const progressIndicator = fileItem.querySelector('.file-progress-indicator');
  const progressValue = fileItem.querySelector('.file-progress-value');
  
  // Calculate progress percentage
  const receivedChunks = file.chunks.filter(chunk => chunk !== undefined).length;
  const percentage = Math.floor((receivedChunks / file.totalChunks) * 100);
  
  if (progressIndicator) {
    progressIndicator.style.width = `${percentage}%`;
  }
  
  if (progressValue) {
    progressValue.textContent = `${percentage}%`;
  }
}

function generateFileId(file) {
  // Create a unique ID based on file properties
  const idString = `${file.name}-${file.size}-${file.lastModified}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < idString.length; i++) {
    const char = idString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `file-${Math.abs(hash)}`;
}

// Add function to show status messages
function showStatusMessage(message, type = 'info') {
  const existingMessage = document.querySelector('.status-message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  const messageElement = document.createElement('div');
  messageElement.className = `status-message ${type}`;
  
  // Add appropriate icon based on message type
  const iconElement = document.createElement('span');
  iconElement.className = 'material-icons';
  
  switch (type) {
    case 'success':
      iconElement.textContent = 'check_circle';
      break;
    case 'error':
      iconElement.textContent = 'error';
      break;
    case 'warning':
      iconElement.textContent = 'warning';
      break;
    default:
      iconElement.textContent = 'info';
  }
  
  messageElement.appendChild(iconElement);
  
  const textElement = document.createElement('span');
  textElement.textContent = message;
  messageElement.appendChild(textElement);
  
  document.body.appendChild(messageElement);
  
  // Add the show class after a small delay to trigger the animation
  setTimeout(() => {
    messageElement.classList.add('show');
  }, 10);
  
  // Remove the message after 4 seconds
  setTimeout(() => {
    messageElement.classList.remove('show');
    setTimeout(() => {
      if (messageElement.parentElement) {
        messageElement.parentElement.removeChild(messageElement);
      }
    }, 300);
  }, 4000);
}

// Initialize drag and drop functionality
function initializeFileDragAndDrop() {
  const fileUploadArea = document.querySelector('.file-upload-area');
  const fileInput = document.getElementById('file-input');
  
  if (!fileUploadArea || !fileInput) return;
  
  // Add upload animation elements
  const uploadAnimation = document.createElement('div');
  uploadAnimation.className = 'upload-animation';
  
  for (let i = 0; i < 4; i++) {
    const particle = document.createElement('div');
    particle.className = 'upload-particle';
    uploadAnimation.appendChild(particle);
  }
  
  fileUploadArea.appendChild(uploadAnimation);
  
  // Handle drag events
  fileUploadArea.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileUploadArea.classList.add('drag-over');
  });
  
  fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileUploadArea.classList.add('drag-over');
  });
  
  fileUploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if the mouse actually left the upload area
    const rect = fileUploadArea.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      fileUploadArea.classList.remove('drag-over');
    }
  });
  
  fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileUploadArea.classList.remove('drag-over');
    
    // Show upload animation
    fileUploadArea.classList.add('uploading');
    
    // Process the dropped files
    if (e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Show status message
      showStatusMessage(`${e.dataTransfer.files.length} file(s) added`, 'success');
      
      // Remove upload animation after a delay
      setTimeout(() => {
        fileUploadArea.classList.remove('uploading');
      }, 1500);
    }
  });
  
  // Show upload animation when files are selected via the file input
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      fileUploadArea.classList.add('uploading');
      
      setTimeout(() => {
        fileUploadArea.classList.remove('uploading');
      }, 1500);
    }
  });
}

// Initialize file history
function initializeFileHistory() {
  const fileHistoryContainer = document.getElementById('file-history-container');
  const fileHistoryList = document.getElementById('file-history-list');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const historyTabs = document.querySelectorAll('.history-tab');
  const emptyHistoryMessage = document.querySelector('.empty-history-message');
  
  if (!fileHistoryContainer || !fileHistoryList || !clearHistoryBtn) return;
  
  // Load file history from localStorage
  const fileHistory = loadFileHistory();
  
  // Show file history container if there's history
  if (fileHistory.sent.length > 0 || fileHistory.received.length > 0) {
    fileHistoryContainer.classList.remove('hidden');
    
    // Render initial history (default to sent tab)
    renderFileHistory('sent');
  }
  
  // Handle tab switching
  historyTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab
      historyTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Render corresponding history
      const tabType = tab.getAttribute('data-tab');
      renderFileHistory(tabType);
    });
  });
  
  // Handle clear history button
  clearHistoryBtn.addEventListener('click', () => {
    const activeTab = document.querySelector('.history-tab.active');
    const tabType = activeTab ? activeTab.getAttribute('data-tab') : 'sent';
    
    // Clear the specific history type
    clearFileHistory(tabType);
    
    // Re-render the history
    renderFileHistory(tabType);
    
    // Show status message
    showStatusMessage(`${tabType.charAt(0).toUpperCase() + tabType.slice(1)} file history cleared`, 'info');
    
    // Hide container if both histories are empty
    const updatedHistory = loadFileHistory();
    if (updatedHistory.sent.length === 0 && updatedHistory.received.length === 0) {
      fileHistoryContainer.classList.add('hidden');
    }
  });
  
  // Function to render file history based on type
  function renderFileHistory(type) {
    const history = loadFileHistory()[type];
    
    // Clear current list
    fileHistoryList.innerHTML = '';
    
    // Show empty message if no history
    if (history.length === 0) {
      emptyHistoryMessage.style.display = 'flex';
      return;
    }
    
    emptyHistoryMessage.style.display = 'none';
    
    // Render history items
    history.forEach(item => {
      const historyItem = document.createElement('div');
      historyItem.className = `file-history-item ${type}`;
      
      // Get file icon based on extension
      const fileIcon = getFileIcon(item.name);
      
      historyItem.innerHTML = `
        <div class="file-history-icon">
          <span class="material-icons">${fileIcon}</span>
        </div>
        <div class="file-history-details">
          <div class="file-history-name">${item.name}</div>
          <div class="file-history-meta">
            <div class="file-history-date">
              <span class="material-icons">schedule</span>
              ${formatDate(item.date)}
            </div>
            <div class="file-history-size">
              <span class="material-icons">sd_storage</span>
              ${formatFileSize(item.size)}
            </div>
          </div>
        </div>
        <div class="file-history-actions">
          ${type === 'received' && item.blob ? `
            <button class="history-action-btn download-history" title="Download file" data-id="${item.id}">
              <span class="material-icons">download</span>
            </button>
          ` : ''}
          <button class="history-action-btn remove-history" title="Remove from history" data-id="${item.id}">
            <span class="material-icons">delete_outline</span>
          </button>
        </div>
      `;
      
      fileHistoryList.appendChild(historyItem);
    });
    
    // Add event listeners to action buttons
    document.querySelectorAll('.download-history').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.getAttribute('data-id');
        downloadHistoryFile(itemId);
      });
    });
    
    document.querySelectorAll('.remove-history').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.getAttribute('data-id');
        removeHistoryItem(itemId, type);
        renderFileHistory(type);
      });
    });
  }
}

// Load file history from localStorage
function loadFileHistory() {
  const defaultHistory = { sent: [], received: [] };
  
  try {
    const history = JSON.parse(localStorage.getItem('fileHistory')) || defaultHistory;
    return history;
  } catch (error) {
    console.error('Error loading file history:', error);
    return defaultHistory;
  }
}

// Save file history to localStorage
function saveFileHistory(history) {
  try {
    localStorage.setItem('fileHistory', JSON.stringify(history));
  } catch (error) {
    console.error('Error saving file history:', error);
  }
}

// Add a file to history
function addFileToHistory(file, type) {
  const history = loadFileHistory();
  
  const fileItem = {
    id: generateUniqueId(),
    name: file.name,
    size: file.size,
    type: file.type,
    date: Date.now()
  };
  
  // For received files, store the blob if available
  if (type === 'received' && file.blob) {
    try {
      // Store blob as base64 string
      const reader = new FileReader();
      reader.onload = function(e) {
        fileItem.blob = e.target.result;
        history[type].unshift(fileItem);
        
        // Limit history to 20 items per type
        if (history[type].length > 20) {
          history[type].pop();
        }
        
        saveFileHistory(history);
        
        // Show file history container
        const fileHistoryContainer = document.getElementById('file-history-container');
        if (fileHistoryContainer) {
          fileHistoryContainer.classList.remove('hidden');
        }
      };
      reader.readAsDataURL(file.blob);
    } catch (error) {
      console.error('Error storing file blob:', error);
    }
  } else {
    history[type].unshift(fileItem);
    
    // Limit history to 20 items per type
    if (history[type].length > 20) {
      history[type].pop();
    }
    
    saveFileHistory(history);
    
    // Show file history container
    const fileHistoryContainer = document.getElementById('file-history-container');
    if (fileHistoryContainer) {
      fileHistoryContainer.classList.remove('hidden');
    }
  }
}

// Clear file history
function clearFileHistory(type) {
  const history = loadFileHistory();
  history[type] = [];
  saveFileHistory(history);
}

// Remove a specific history item
function removeHistoryItem(itemId, type) {
  const history = loadFileHistory();
  history[type] = history[type].filter(item => item.id !== itemId);
  saveFileHistory(history);
  
  // Hide container if both histories are empty
  if (history.sent.length === 0 && history.received.length === 0) {
    const fileHistoryContainer = document.getElementById('file-history-container');
    if (fileHistoryContainer) {
      fileHistoryContainer.classList.add('hidden');
    }
  }
}

// Download a file from history
function downloadHistoryFile(itemId) {
  const history = loadFileHistory();
  const file = history.received.find(item => item.id === itemId);
  
  if (file && file.blob) {
    try {
      // Convert base64 to blob
      const byteString = atob(file.blob.split(',')[1]);
      const mimeType = file.blob.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([ab], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      // Create temporary link for download
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
      
      showStatusMessage(`Downloading ${file.name}`, 'success');
    } catch (error) {
      console.error('Error downloading file:', error);
      showStatusMessage('Error downloading file', 'error');
    }
  } else {
    showStatusMessage('File data not available', 'error');
  }
}

// Generate a unique ID for history items
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Format date for display
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  
  // Check if it's today
  if (date.toDateString() === now.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Check if it's yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Otherwise show full date
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
         `, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// Get file icon based on file extension
function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  
  // Document types
  if (['pdf'].includes(ext)) return 'picture_as_pdf';
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext)) return 'description';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'table_chart';
  if (['ppt', 'pptx'].includes(ext)) return 'slideshow';
  
  // Image types
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) return 'image';
  
  // Audio types
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) return 'audiotrack';
  
  // Video types
  if (['mp4', 'webm', 'avi', 'mov', 'wmv', 'mkv'].includes(ext)) return 'movie';
  
  // Archive types
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'folder_zip';
  
  // Code types
  if (['js', 'ts', 'html', 'css', 'py', 'java', 'c', 'cpp', 'php', 'rb'].includes(ext)) return 'code';
  
  // Default icon
  return 'insert_drive_file';
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme
  initializeTheme();
  
  // Initialize app functionality
  initializeApp();
});

// Theme toggle functionality
function initializeTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('theme') || 'light';
  
  // Set initial theme
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      
      // Add animation class
      document.body.classList.add('transition-theme');
      
      // Set new theme
      document.documentElement.setAttribute('data-theme', newTheme);
      
      // Save preference
      localStorage.setItem('theme', newTheme);
      
      // Show status message
      showStatusMessage(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode enabled`, 'info');
    });
  }
} 