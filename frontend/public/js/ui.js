/**
 * UI module for the P2P file sharing application
 * Handles all DOM interactions and UI updates
 */

const UI = {
  // DOM Elements
  elements: {
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
    themeToggle: document.getElementById('theme-toggle')
  },

  /**
   * Initialize UI elements and event listeners
   */
  initialize() {
    // Initialize theme
    this.initializeTheme();
    
    // Initialize file drag and drop
    this.initializeFileDragAndDrop();
    
    // Initialize file history
    this.initializeFileHistory();
    
    // Initial state
    this.elements.sendFilesBtn.disabled = true;
    this.elements.sendFilesBtn.classList.add('disabled');
  },

  /**
   * Update connection status in the UI
   * @param {string} status - Connection status (connected, connecting, disconnected)
   * @param {string} details - Additional details
   */
  updateConnectionStatus(status, details = '') {
    const statusIndicator = this.elements.statusIndicator;
    const statusText = this.elements.connectionStatusText;
    
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
        this.showStatusMessage('Connected successfully!', 'success');
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
  },

  /**
   * Show a status message to the user
   * @param {string} message - Message to display
   * @param {string} type - Message type (info, success, warning, error)
   */
  showStatusMessage(message, type = 'info') {
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
  },

  /**
   * Update status message
   * @param {string} message - Message to display
   * @param {string} type - Message type (info, success, warning, error)
   */
  updateStatus(message, type = 'info') {
    console.log(`Status update (${type}): ${message}`);
    
    // Get or create status element
    let statusElement = document.getElementById('status-message');
    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.id = 'status-message';
      document.querySelector('.main-content').appendChild(statusElement);
    }
    
    // Clear existing classes
    statusElement.className = '';
    
    // Add new class based on type
    statusElement.className = `status-message ${type}`;
    
    // Update status message
    statusElement.textContent = message;
    
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
      }, 5000);
    }
  },

  /**
   * Update send button state
   * @param {boolean} peerReady - Whether the peer connection is ready
   * @param {number} filesCount - Number of selected files
   */
  updateSendButtonState(peerReady, filesCount) {
    const canSend = filesCount > 0 && peerReady;
    
    console.log('Updating send button state:', {
      filesSelected: filesCount > 0,
      peerReady: peerReady,
      canSend: canSend
    });
    
    // Force enable the button if conditions are met
    this.elements.sendFilesBtn.disabled = !canSend;
    
    // Update button classes
    if (canSend) {
      this.elements.sendFilesBtn.classList.remove('disabled');
      this.elements.sendFilesBtn.classList.add('enabled');
      this.elements.sendFilesBtn.style.pointerEvents = 'auto';
      this.elements.sendFilesBtn.style.cursor = 'pointer';
    } else {
      this.elements.sendFilesBtn.classList.remove('enabled');
      this.elements.sendFilesBtn.classList.add('disabled');
      this.elements.sendFilesBtn.style.pointerEvents = 'none';
      this.elements.sendFilesBtn.style.cursor = 'not-allowed';
    }
  },

  /**
   * Render selected files in the UI
   * @param {Array} selectedFiles - Array of selected files
   * @param {Function} onRemoveFile - Callback when a file is removed
   */
  renderSelectedFiles(selectedFiles, onRemoveFile) {
    const filesList = this.elements.selectedFilesList;
    if (!filesList) return;
    
    filesList.innerHTML = '';
    
    if (selectedFiles.length === 0) {
      filesList.innerHTML = '<div class="no-files-message">No files selected</div>';
      return;
    }
    
    selectedFiles.forEach((file, index) => {
      const fileId = file.uniqueId || Utils.generateFileId(file);
      
      // Get file icon based on extension
      const fileIcon = Utils.getFileIcon(file.name);
      
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
      fileSize.textContent = Utils.formatFileSize(file.size);
      
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
        onRemoveFile(index);
      });
      
      fileActions.appendChild(removeBtn);
      
      fileItem.appendChild(fileIconElement);
      fileItem.appendChild(fileInfo);
      fileItem.appendChild(fileActions);
      
      filesList.appendChild(fileItem);
    });
  },

  /**
   * Update file progress in the UI
   * @param {Object} file - File object
   * @param {number} progress - Progress percentage
   */
  updateFileProgress(file, progress) {
    const fileId = file.uniqueId || Utils.generateFileId(file);
    const fileItem = document.getElementById(`file-${fileId}`);
    
    if (!fileItem) return;
    
    const progressIndicator = fileItem.querySelector('.file-progress-indicator');
    const progressValue = fileItem.querySelector('.file-progress-value');
    
    if (progressIndicator) {
      progressIndicator.style.width = `${progress}%`;
    }
    
    if (progressValue) {
      progressValue.textContent = `${Math.round(progress)}%`;
    }
  },

  /**
   * Update transfer progress in the UI
   * @param {number} progress - Progress percentage
   */
  updateTransferProgress(progress) {
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
      progressBar.textContent = `${Math.round(progress)}%`;
    }
  },

  /**
   * Initialize file drag and drop functionality
   * @param {Function} onFilesSelected - Callback when files are selected
   */
  initializeFileDragAndDrop(onFilesSelected) {
    const fileUploadArea = document.querySelector('.file-upload-area');
    const fileInput = this.elements.fileInput;
    
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
        
        // Call the callback
        if (onFilesSelected) {
          onFilesSelected(e.dataTransfer.files);
        }
        
        // Show status message
        this.showStatusMessage(`${e.dataTransfer.files.length} file(s) added`, 'success');
        
        // Remove upload animation after a delay
        setTimeout(() => {
          fileUploadArea.classList.remove('uploading');
        }, 1500);
      }
    });
  },

  /**
   * Initialize theme toggle functionality
   */
  initializeTheme() {
    const themeToggle = this.elements.themeToggle;
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
        this.showStatusMessage(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode enabled`, 'info');
      });
    }
  },

  /**
   * Initialize file history UI
   * @param {Object} fileHistory - File history object
   * @param {Function} onDownloadFile - Callback when a file is downloaded
   * @param {Function} onRemoveHistoryItem - Callback when a history item is removed
   * @param {Function} onClearHistory - Callback when history is cleared
   */
  initializeFileHistory(fileHistory, onDownloadFile, onRemoveHistoryItem, onClearHistory) {
    const fileHistoryContainer = document.getElementById('file-history-container');
    const fileHistoryList = document.getElementById('file-history-list');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const historyTabs = document.querySelectorAll('.history-tab');
    const emptyHistoryMessage = document.querySelector('.empty-history-message');
    
    if (!fileHistoryContainer || !fileHistoryList || !clearHistoryBtn) return;
    
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
      
      // Call the callback
      if (onClearHistory) {
        onClearHistory(tabType);
      }
      
      // Re-render the history
      renderFileHistory(tabType);
      
      // Show status message
      this.showStatusMessage(`${tabType.charAt(0).toUpperCase() + tabType.slice(1)} file history cleared`, 'info');
      
      // Hide container if both histories are empty
      if (fileHistory.sent.length === 0 && fileHistory.received.length === 0) {
        fileHistoryContainer.classList.add('hidden');
      }
    });
    
    // Function to render file history based on type
    function renderFileHistory(type) {
      const history = fileHistory[type] || [];
      
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
        const fileIcon = Utils.getFileIcon(item.name);
        
        historyItem.innerHTML = `
          <div class="file-history-icon">
            <span class="material-icons">${fileIcon}</span>
          </div>
          <div class="file-history-details">
            <div class="file-history-name">${item.name}</div>
            <div class="file-history-meta">
              <div class="file-history-date">
                <span class="material-icons">schedule</span>
                ${Utils.formatDate(item.date)}
              </div>
              <div class="file-history-size">
                <span class="material-icons">sd_storage</span>
                ${Utils.formatFileSize(item.size)}
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
          if (onDownloadFile) {
            onDownloadFile(itemId);
          }
        });
      });
      
      document.querySelectorAll('.remove-history').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemId = btn.getAttribute('data-id');
          if (onRemoveHistoryItem) {
            onRemoveHistoryItem(itemId, type);
          }
          renderFileHistory(type);
        });
      });
    }
  },

  /**
   * Add a file item to the incoming files list
   * @param {Object} fileInfo - File information
   * @param {Function} onDownload - Callback when download button is clicked
   * @param {Function} onCancel - Callback when cancel button is clicked
   */
  addIncomingFileItem(fileInfo, onDownload, onCancel) {
    const filesList = this.elements.incomingFilesList;
    if (!filesList) return;
    
    // Make sure the file receiving container is visible
    const fileReceivingContainer = this.elements.fileReceiving;
    if (fileReceivingContainer) {
      fileReceivingContainer.classList.remove('hidden');
    }
    
    // Check if we already have a file item for this fileId
    let fileItem = document.getElementById(`file-${fileInfo.id}`);
    
    if (!fileItem) {
      // Get appropriate file icon based on file extension
      const fileIcon = Utils.getFileIcon(fileInfo.name);
      
      // Create a new file item
      fileItem = document.createElement('div');
      fileItem.id = `file-${fileInfo.id}`;
      fileItem.className = 'file-item';
      
      const fileIconElement = document.createElement('div');
      fileIconElement.className = 'file-icon';
      fileIconElement.innerHTML = `<span class="material-icons">${fileIcon}</span>`;
      
      const fileInfo = document.createElement('div');
      fileInfo.className = 'file-info';
      
      const fileName = document.createElement('div');
      fileName.className = 'file-name';
      fileName.textContent = fileInfo.name;
      
      const fileSize = document.createElement('div');
      fileSize.className = 'file-size';
      fileSize.textContent = Utils.formatFileSize(fileInfo.size);
      
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
        if (onDownload) {
          onDownload(fileInfo.id);
        }
      });
      
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'retry-btn';
      cancelBtn.innerHTML = '<span class="material-icons">close</span>';
      cancelBtn.addEventListener('click', () => {
        if (onCancel) {
          onCancel(fileInfo.id);
        }
        
        // Remove the file from the UI
        if (fileItem.parentElement) {
          fileItem.parentElement.removeChild(fileItem);
        }
      });
      
      fileActions.appendChild(downloadBtn);
      fileActions.appendChild(cancelBtn);
      
      fileItem.appendChild(fileIconElement);
      fileItem.appendChild(fileInfo);
      fileItem.appendChild(fileActions);
      
      filesList.appendChild(fileItem);
    }
    
    // Show the transfer status
    this.elements.transferStatus.classList.remove('hidden');
  },

  /**
   * Update incoming file progress
   * @param {string} fileId - File ID
   * @param {number} progress - Progress percentage
   */
  updateIncomingFileProgress(fileId, progress) {
    const fileItem = document.getElementById(`file-${fileId}`);
    if (!fileItem) return;
    
    const progressIndicator = fileItem.querySelector('.file-progress-indicator');
    const progressValue = fileItem.querySelector('.file-progress-value');
    
    if (progressIndicator) {
      progressIndicator.style.width = `${progress}%`;
    }
    
    if (progressValue) {
      progressValue.textContent = `${progress}%`;
    }
  },

  /**
   * Mark an incoming file as complete
   * @param {string} fileId - File ID
   */
  markFileComplete(fileId) {
    const fileItem = document.getElementById(`file-${fileId}`);
    if (!fileItem) return;
    
    const progressIndicator = fileItem.querySelector('.file-progress-indicator');
    const progressValue = fileItem.querySelector('.file-progress-value');
    const downloadBtn = fileItem.querySelector('.download-btn');
    
    if (progressIndicator) progressIndicator.style.width = '100%';
    if (progressValue) progressValue.textContent = '100%';
    if (downloadBtn) downloadBtn.disabled = false;
    
    const fileProgress = fileItem.querySelector('.file-progress');
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
};

// Export the UI module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UI;
} else {
  window.UI = UI;
} 