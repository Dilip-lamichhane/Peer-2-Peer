/**
 * File Transfer module for the P2P file sharing application
 * Handles sending and receiving files
 */

const FileTransfer = {
  // File transfer state
  selectedFiles: [],
  incomingFiles: {},
  pendingChunkMetadata: null,
  bufferedChunks: [],
  
  /**
   * Initialize the file transfer module
   * @param {Object} options - Configuration options
   */
  initialize(options) {
    this.connection = options.connection;
    this.ui = options.ui;
    this.callbacks = options.callbacks || {};
    
    // Initialize file history
    this.initializeFileHistory();
  },
  
  /**
   * Handle file selection
   * @param {FileList} files - Selected files
   */
  handleFileSelect(files) {
    if (files.length > 0) {
      console.log('Files selected:', files.length);
      this.selectedFiles = Array.from(files);
      
      // Render selected files
      if (this.callbacks.onFilesSelected) {
        this.callbacks.onFilesSelected(this.selectedFiles);
      }
      
      return this.selectedFiles;
    }
    
    return [];
  },
  
  /**
   * Remove a file from the selected files
   * @param {number} index - Index of the file to remove
   */
  removeFile(index) {
    if (index >= 0 && index < this.selectedFiles.length) {
      this.selectedFiles.splice(index, 1);
      
      // Update UI
      if (this.callbacks.onFilesSelected) {
        this.callbacks.onFilesSelected(this.selectedFiles);
      }
    }
  },
  
  /**
   * Send selected files to the peer
   */
  sendFiles() {
    if (!this.selectedFiles.length) {
      if (this.callbacks.onError) {
        this.callbacks.onError('Please select files to send', 'warning');
      }
      return;
    }

    if (!this.connection.isPeerReady()) {
      if (this.callbacks.onError) {
        this.callbacks.onError('No connection to peer', 'error');
      }
      return;
    }

    console.log(`Starting file transfer for ${this.selectedFiles.length} files`);
    if (this.callbacks.onStatusUpdate) {
      this.callbacks.onStatusUpdate(`Preparing to send ${this.selectedFiles.length} files...`);
    }

    // Show transfer status
    if (this.callbacks.onTransferStart) {
      this.callbacks.onTransferStart();
    }

    // Send files one by one
    let fileIndex = 0;

    const sendNextFile = () => {
      if (fileIndex >= this.selectedFiles.length) {
        console.log('All files sent');
        if (this.callbacks.onStatusUpdate) {
          this.callbacks.onStatusUpdate('All files sent successfully');
        }
        
        // Re-enable send button
        if (this.callbacks.onTransferComplete) {
          this.callbacks.onTransferComplete();
        }
        return;
      }

      const file = this.selectedFiles[fileIndex];
      console.log(`Preparing to send file ${fileIndex + 1}/${this.selectedFiles.length}: ${file.name}`);

      // Generate a unique ID for this file if it doesn't have one
      if (!file.uniqueId) {
        file.uniqueId = Utils.generateFileId(file);
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
      this.connection.send(JSON.stringify(metadata));
      
      // Start sending the file chunks after a delay to ensure metadata is processed first
      setTimeout(() => {
        this.sendFileChunks(file)
          .then(() => {
            console.log(`File ${file.name} sent successfully`);
            if (this.callbacks.onStatusUpdate) {
              this.callbacks.onStatusUpdate(`File ${file.name} sent successfully`);
            }
            fileIndex++;
            setTimeout(sendNextFile, 500); // Small delay between files
          })
          .catch(error => {
            console.error(`Error sending file ${file.name}:`, error);
            if (this.callbacks.onError) {
              this.callbacks.onError(`Error sending file ${file.name}`, 'error');
            }
            
            // Re-enable send button
            if (this.callbacks.onTransferComplete) {
              this.callbacks.onTransferComplete();
            }
          });
      }, 500); // Increased delay to ensure metadata is processed before chunks
    };

    sendNextFile();
  },
  
  /**
   * Send file in chunks
   * @param {File} file - File to send
   * @returns {Promise} - Promise that resolves when the file is sent
   */
  sendFileChunks(file) {
    console.log(`Sending file: ${file.name}, size: ${file.size} bytes`);
    if (this.callbacks.onStatusUpdate) {
      this.callbacks.onStatusUpdate(`Sending ${file.name}...`);
    }

    return new Promise((resolve, reject) => {
      const chunkSize = CONFIG.CHUNK_SIZE;
      const totalChunks = Math.ceil(file.size / chunkSize);
      let sentChunks = 0;
      let startTime = Date.now();
      let lastUpdateTime = startTime;
      let bytesTransferred = 0;

      console.log(`File will be split into ${totalChunks} chunks`);

      const fileReader = new FileReader();
      
      // When a chunk is loaded
      fileReader.onload = (event) => {
        if (!this.connection.isPeerReady()) {
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
        this.connection.send(JSON.stringify(chunkMetadata));
        
        // Then send the binary chunk data after a delay
        setTimeout(() => {
          this.connection.send(chunkData);
          
          sentChunks++;
          console.log(`Sending chunk ${sentChunks}/${totalChunks} of file ${file.name}`);

          // Update progress
          const progress = (sentChunks / totalChunks) * 100;
          
          if (this.callbacks.onTransferProgress) {
            this.callbacks.onTransferProgress(progress);
          }
          
          if (this.callbacks.onFileProgress) {
            this.callbacks.onFileProgress(file, progress);
          }

          // Calculate transfer speed every second
          const now = Date.now();
          if (now - lastUpdateTime > 1000) {
            const elapsedSeconds = (now - startTime) / 1000;
            const bytesPerSecond = bytesTransferred / elapsedSeconds;
            const remainingBytes = file.size - bytesTransferred;
            const remainingTime = remainingBytes / bytesPerSecond;

            if (this.callbacks.onTransferSpeedUpdate) {
              this.callbacks.onTransferSpeedUpdate(bytesPerSecond, remainingTime);
            }

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
            
            this.connection.send(JSON.stringify(completeMessage));
            
            if (this.callbacks.onStatusUpdate) {
              this.callbacks.onStatusUpdate(`File ${file.name} sent successfully`);
            }
            
            // Add to history
            this.addFileToHistory({
              name: file.name,
              size: file.size,
              type: file.type
            }, 'sent');
            
            resolve();
          }
        }, 100); // Delay between metadata and chunk data
      };

      fileReader.onerror = (error) => {
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
  },
  
  /**
   * Handle incoming data
   * @param {*} data - Incoming data
   */
  handleIncomingData(data) {
    // Convert ArrayBuffer to Uint8Array if needed
    if (data instanceof ArrayBuffer) {
      data = new Uint8Array(data);
    }
    
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
            
            // Process the JSON message immediately
            this.processJsonMessage(message);
            
            // If this was file metadata, process any buffered chunks right away
            if (message.type === 'file-metadata') {
              this.processBufferedChunks(message.fileId);
            }
            return;
          } catch (e) {
            console.log("Not valid JSON, processing as binary data");
          }
        }
        
        // If we have pending chunk metadata, process this binary data as a chunk
        if (this.pendingChunkMetadata) {
          console.log("Processing binary data with pending chunk metadata");
          this.processChunk(this.pendingChunkMetadata, data);
          this.pendingChunkMetadata = null;
          return;
        }
        
        // Otherwise, buffer the data temporarily with timestamp
        console.log("Received binary data without metadata, buffering temporarily");
        
        this.bufferedChunks.push({ 
          data, 
          timestamp: Date.now() 
        });
        
        // Clean up old buffered chunks (older than 30 seconds)
        const oldTimestamp = Date.now() - 30000;
        this.bufferedChunks = this.bufferedChunks.filter(chunk => chunk.timestamp > oldTimestamp);
        
        // Check if we have any file metadata in the buffer
        if (this.checkBufferForMetadata()) {
          // If we found metadata, process any buffered chunks for existing files
          for (const fileId in this.incomingFiles) {
            this.processBufferedChunks(fileId);
          }
          return;
        }
        
        // Process any buffered chunks that might match existing files
        let chunksProcessed = false;
        for (const fileId in this.incomingFiles) {
          // Only process if we have pending metadata for this file
          if (this.pendingChunkMetadata && this.pendingChunkMetadata.fileId === fileId) {
            chunksProcessed = true;
            this.processBufferedChunks(fileId);
          }
        }
        
        // If we didn't process any chunks and we have no files yet, show waiting message
        if (!chunksProcessed && Object.keys(this.incomingFiles).length === 0) {
          if (this.callbacks.onStatusUpdate) {
            this.callbacks.onStatusUpdate("Waiting for file metadata...", "warning");
          }
        }
      } catch (e) {
        console.error("Error processing binary data:", e);
      }
    } else if (typeof data === 'string') {
      // Handle JSON data
      try {
        const message = JSON.parse(data);
        this.processJsonMessage(message);
        
        // If this was file metadata, process any buffered chunks right away
        if (message.type === 'file-metadata') {
          this.processBufferedChunks(message.fileId);
        }
      } catch (e) {
        console.error("Error parsing JSON data:", e);
      }
    } else {
      console.warn("Unknown data type received:", typeof data);
    }
  },
  
  /**
   * Check buffer for file metadata
   * @returns {boolean} - Whether metadata was found
   */
  checkBufferForMetadata() {
    if (!this.bufferedChunks || this.bufferedChunks.length === 0) {
      return false;
    }
    
    console.log("Checking buffer for file metadata");
    
    // Look for metadata entries in the buffer
    for (let i = 0; i < this.bufferedChunks.length; i++) {
      const chunk = this.bufferedChunks[i];
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(chunk.data);
        if (text.startsWith('{')) {
          try {
            const message = JSON.parse(text);
            if (message.type === 'file-metadata') {
              console.log("Found file metadata in buffer:", message);
              // Process the metadata
              this.processJsonMessage(message);
              // Remove this item from the buffer
              this.bufferedChunks.splice(i, 1);
              i--; // Adjust index after removal
              
              // Process any buffered chunks for this file
              this.processBufferedChunks(message.fileId);
              return true;
            }
          } catch (e) {
            // Not valid JSON, ignore
          }
        }
      } catch (e) {
        // Error decoding, ignore
      }
    }
    
    return false;
  },
  
  /**
   * Find a matching chunk in the buffer for the given metadata
   * @param {Object} metadata - Chunk metadata
   * @returns {number} - Index of the matching chunk or -1 if not found
   */
  findMatchingChunkInBuffer(metadata) {
    // Look for a binary chunk that follows this metadata in the buffer
    for (let i = 0; i < this.bufferedChunks.length; i++) {
      // Skip non-binary chunks
      if (!(this.bufferedChunks[i].data instanceof Uint8Array)) {
        continue;
      }
      
      // Check if this is a binary chunk and if it matches the expected size
      if (this.bufferedChunks[i].data.byteLength === metadata.size) {
        return i;
      }
    }
    
    return -1;
  },
  
  /**
   * Process JSON messages
   * @param {Object} message - JSON message
   */
  processJsonMessage(message) {
    console.log('Processing JSON message:', message);
    
    switch (message.type) {
      case 'file-metadata':
        console.log('Received file metadata:', message);
        // Initialize file reception
        this.initFileReception(message);
        
        // Process any buffered chunks for this file
        this.processBufferedChunks(message.fileId);
        break;
        
      case 'file-chunk':
        console.log('Received file chunk metadata:', message);
        // Store metadata for the next binary chunk
        this.pendingChunkMetadata = message;
        
        // Check if we have a matching chunk in the buffer
        const matchingChunkIndex = this.findMatchingChunkInBuffer(message);
        if (matchingChunkIndex >= 0) {
          const chunk = this.bufferedChunks[matchingChunkIndex];
          this.processChunk(message, chunk.data);
          this.bufferedChunks.splice(matchingChunkIndex, 1);
          this.pendingChunkMetadata = null;
        }
        break;
        
      case 'transfer-complete':
        console.log('Transfer complete:', message);
        // Finalize the file
        this.finalizeFile(message.fileId);
        break;
        
      default:
        // Forward other messages to the application
        if (this.callbacks.onSignalingMessage) {
          this.callbacks.onSignalingMessage(message);
        }
    }
  },
  
  /**
   * Process buffered chunks for a file
   * @param {string} fileId - File ID
   */
  processBufferedChunks(fileId) {
    if (!this.bufferedChunks || this.bufferedChunks.length === 0) {
      return;
    }
    
    if (!this.incomingFiles[fileId]) {
      console.log(`No file information found for ${fileId}, cannot process buffered chunks`);
      return;
    }
    
    console.log(`Processing ${this.bufferedChunks.length} buffered chunks for file ${fileId}`);
    
    // First, look for chunk metadata entries in the buffer
    const chunkMetadataEntries = [];
    const processedIndices = new Set();
    
    // Find all chunk metadata for this file
    for (let i = 0; i < this.bufferedChunks.length; i++) {
      const chunk = this.bufferedChunks[i];
      
      // If this chunk already has metadata attached
      if (chunk.metadata && chunk.metadata.fileId === fileId) {
        console.log(`Found chunk with attached metadata for file ${fileId}`);
        this.processChunk(chunk.metadata, chunk.data);
        // Mark for removal
        processedIndices.add(i);
        continue;
      }
      
      // Try to decode as JSON to find metadata
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(chunk.data);
        if (text.startsWith('{')) {
          try {
            const chunkData = JSON.parse(text);
            if (chunkData.type === 'file-chunk' && chunkData.fileId === fileId) {
              // Add to metadata entries list
              chunkMetadataEntries.push({
                index: i,
                metadata: chunkData
              });
            }
          } catch (e) {
            // Not valid JSON, ignore
          }
        }
      } catch (e) {
        // Error decoding, ignore
      }
    }
    
    // Process metadata entries
    for (const entry of chunkMetadataEntries) {
      // Find the next binary chunk that matches the size
      for (let j = 0; j < this.bufferedChunks.length; j++) {
        // Skip already processed indices
        if (processedIndices.has(j)) continue;
        
        const binaryChunk = this.bufferedChunks[j];
        if (binaryChunk.data instanceof Uint8Array && 
            binaryChunk.data.byteLength === entry.metadata.size) {
          // Process this chunk
          this.processChunk(entry.metadata, binaryChunk.data);
          // Mark both for removal
          processedIndices.add(entry.index);
          processedIndices.add(j);
          break;
        }
      }
    }
    
    // Remove processed chunks in reverse order to avoid index shifting
    const indices = Array.from(processedIndices).sort((a, b) => b - a);
    for (const index of indices) {
      if (index >= 0 && index < this.bufferedChunks.length) {
        this.bufferedChunks.splice(index, 1);
      }
    }
  },
  
  /**
   * Initialize file reception
   * @param {Object} metadata - File metadata
   */
  initFileReception(metadata) {
    const { fileId, name, size, fileType } = metadata;
    
    console.log(`Initializing reception for file: ${name} (${fileId})`);
    
    // Initialize file information
    this.incomingFiles[fileId] = {
      id: fileId,
      name: name,
      size: size,
      fileType: fileType || '',
      totalChunks: Math.ceil(size / CONFIG.CHUNK_SIZE),
      receivedChunks: 0,
      chunks: {},
      complete: false,
      timestamp: Date.now()
    };
    
    // Notify the application
    if (this.callbacks.onFileReceptionStart) {
      this.callbacks.onFileReceptionStart(this.incomingFiles[fileId]);
    }
    
    console.log(`File reception initialized for ${name}`);
    if (this.callbacks.onStatusUpdate) {
      this.callbacks.onStatusUpdate(`Receiving file: ${name}`, 'info');
    }
  },
  
  /**
   * Process a chunk with its metadata
   * @param {Object} metadata - Chunk metadata
   * @param {Uint8Array} chunkData - Chunk data
   */
  processChunk(metadata, chunkData) {
    const fileId = metadata.fileId;
    const chunkIndex = metadata.index;
    const totalChunks = metadata.total;
    
    console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} for file ${fileId}`);
    
    // Check if we have metadata for this file
    if (!this.incomingFiles[fileId]) {
      console.error(`No metadata found for file ${fileId}, buffering chunk`);
      
      // Buffer the chunk with its metadata for later processing
      this.bufferedChunks.push({
        data: chunkData,
        timestamp: Date.now(),
        metadata: metadata
      });
      
      // Check if we have metadata in the buffer
      if (this.checkBufferForMetadata()) {
        // If we found and processed metadata, try processing this chunk again
        if (this.incomingFiles[fileId]) {
          this.processChunk(metadata, chunkData);
        }
      } else if (this.callbacks.onStatusUpdate) {
        this.callbacks.onStatusUpdate(`Waiting for file metadata...`, 'warning');
      }
      
      return;
    }
    
    const fileInfo = this.incomingFiles[fileId];
    
    // Store the chunk
    fileInfo.chunks[chunkIndex] = new Uint8Array(chunkData);
    fileInfo.receivedChunks++;
    
    console.log(`Stored chunk ${chunkIndex + 1}/${totalChunks} for file ${fileId}. Total received: ${fileInfo.receivedChunks}/${totalChunks}`);
    
    // Update progress
    const progress = Math.min(100, Math.round((fileInfo.receivedChunks / totalChunks) * 100));
    
    // Update UI
    if (this.callbacks.onFileProgress) {
      this.callbacks.onFileProgress(fileInfo, progress);
    }
    
    // Check if all chunks have been received
    if (fileInfo.receivedChunks === totalChunks) {
      console.log(`All chunks received for file ${fileId}`);
      this.finalizeFile(fileId);
    }
  },
  
  /**
   * Finalize file when all chunks are received
   * @param {string} fileId - File ID
   */
  finalizeFile(fileId) {
    console.log(`Finalizing file ${fileId}`);
    const file = this.incomingFiles[fileId];
    
    if (!file) {
      console.error(`No file information found for ${fileId}`);
      return;
    }
    
    // Mark file as complete
    file.complete = true;
    
    // Create a blob from the chunks
    const chunks = [];
    let missingChunks = false;
    
    // Check that all chunks are present
    for (let i = 0; i < file.totalChunks; i++) {
      if (file.chunks[i]) {
        chunks.push(file.chunks[i]);
      } else {
        console.error(`Missing chunk ${i} for file ${fileId}`);
        missingChunks = true;
        break;
      }
    }
    
    if (missingChunks) {
      console.error(`Cannot finalize file ${fileId} due to missing chunks`);
      return;
    }
    
    const blob = new Blob(chunks, { type: file.fileType || 'application/octet-stream' });
    console.log(`Created blob for file ${fileId}, size: ${blob.size} bytes`);
    
    // Add to history
    this.addFileToHistory({
      name: file.name,
      size: file.size,
      type: file.fileType,
      blob: blob
    }, 'received');
    
    // Notify the application
    if (this.callbacks.onFileComplete) {
      this.callbacks.onFileComplete(fileId, blob);
    }
    
    // Show success message
    if (this.callbacks.onStatusUpdate) {
      this.callbacks.onStatusUpdate(`File "${file.name}" is ready to download!`, 'success');
    }
  },
  
  /**
   * Initialize file history
   */
  initializeFileHistory() {
    // Load file history from localStorage
    this.fileHistory = this.loadFileHistory();
  },
  
  /**
   * Load file history from localStorage
   * @returns {Object} - File history
   */
  loadFileHistory() {
    const defaultHistory = { sent: [], received: [] };
    
    try {
      const history = JSON.parse(localStorage.getItem('fileHistory')) || defaultHistory;
      return history;
    } catch (error) {
      console.error('Error loading file history:', error);
      return defaultHistory;
    }
  },
  
  /**
   * Save file history to localStorage
   * @param {Object} history - File history
   */
  saveFileHistory(history) {
    try {
      localStorage.setItem('fileHistory', JSON.stringify(history));
    } catch (error) {
      console.error('Error saving file history:', error);
    }
  },
  
  /**
   * Add a file to history
   * @param {Object} file - File information
   * @param {string} type - History type (sent or received)
   */
  addFileToHistory(file, type) {
    const history = this.loadFileHistory();
    
    const fileItem = {
      id: Utils.generateUniqueId(),
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
        reader.onload = (e) => {
          fileItem.blob = e.target.result;
          history[type].unshift(fileItem);
          
          // Limit history to 20 items per type
          if (history[type].length > CONFIG.HISTORY_LIMIT) {
            history[type].pop();
          }
          
          this.saveFileHistory(history);
          
          // Notify the application
          if (this.callbacks.onHistoryUpdated) {
            this.callbacks.onHistoryUpdated(history);
          }
        };
        reader.readAsDataURL(file.blob);
      } catch (error) {
        console.error('Error storing file blob:', error);
      }
    } else {
      history[type].unshift(fileItem);
      
      // Limit history to 20 items per type
      if (history[type].length > CONFIG.HISTORY_LIMIT) {
        history[type].pop();
      }
      
      this.saveFileHistory(history);
      
      // Notify the application
      if (this.callbacks.onHistoryUpdated) {
        this.callbacks.onHistoryUpdated(history);
      }
    }
  },
  
  /**
   * Clear file history
   * @param {string} type - History type (sent or received)
   */
  clearFileHistory(type) {
    const history = this.loadFileHistory();
    history[type] = [];
    this.saveFileHistory(history);
    
    // Notify the application
    if (this.callbacks.onHistoryUpdated) {
      this.callbacks.onHistoryUpdated(history);
    }
  },
  
  /**
   * Remove a specific history item
   * @param {string} itemId - Item ID
   * @param {string} type - History type (sent or received)
   */
  removeHistoryItem(itemId, type) {
    const history = this.loadFileHistory();
    history[type] = history[type].filter(item => item.id !== itemId);
    this.saveFileHistory(history);
    
    // Notify the application
    if (this.callbacks.onHistoryUpdated) {
      this.callbacks.onHistoryUpdated(history);
    }
  },
  
  /**
   * Download a file from history
   * @param {string} itemId - Item ID
   */
  downloadHistoryFile(itemId) {
    const history = this.loadFileHistory();
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
        
        if (this.callbacks.onStatusUpdate) {
          this.callbacks.onStatusUpdate(`Downloading ${file.name}`, 'success');
        }
      } catch (error) {
        console.error('Error downloading file:', error);
        if (this.callbacks.onStatusUpdate) {
          this.callbacks.onStatusUpdate('Error downloading file', 'error');
        }
      }
    } else {
      if (this.callbacks.onStatusUpdate) {
        this.callbacks.onStatusUpdate('File data not available', 'error');
      }
    }
  },
  
  /**
   * Get file history
   * @returns {Object} - File history
   */
  getFileHistory() {
    return this.loadFileHistory();
  }
};

// Export the file transfer module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileTransfer;
} else {
  window.FileTransfer = FileTransfer;
} 