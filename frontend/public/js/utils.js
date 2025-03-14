/**
 * Utility functions for the P2P file sharing application
 */

const Utils = {
  /**
   * Format file size in human-readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Format time in human-readable format
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time
   */
  formatTime(seconds) {
    if (seconds < 60) {
      return `${Math.round(seconds)}s remaining`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s remaining`;
    } else {
      return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m remaining`;
    }
  },

  /**
   * Format date for display
   * @param {number} timestamp - Date timestamp
   * @returns {string} Formatted date
   */
  formatDate(timestamp) {
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
  },

  /**
   * Generate a unique ID for a file
   * @param {File} file - File object
   * @returns {string} Unique file ID
   */
  generateFileId(file) {
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
  },

  /**
   * Generate a unique ID
   * @returns {string} Unique ID
   */
  generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  },

  /**
   * Get file icon based on file extension
   * @param {string} filename - File name
   * @returns {string} Material icon name
   */
  getFileIcon(filename) {
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
};

// Export the utilities
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
} else {
  window.Utils = Utils;
} 