const { nanoid } = require('nanoid');

/**
 * Generate a unique room code
 * @param {number} length - Length of the room code (default: 6)
 * @returns {string} - The generated room code
 */
function generateRoomCode(length = 6) {
  // Generate a random code using nanoid
  const code = nanoid(length);
  console.log('Testing nanoid:', code);
  return code;
}

/**
 * Validate a room code
 * @param {string} code - The room code to validate
 * @returns {boolean} - Whether the code is valid
 */
function validateRoomCode(code) {
  // Check if the code is a string
  if (typeof code !== 'string') {
    return false;
  }
  
  // Check if the code is the right length
  if (code.length !== 6) {
    return false;
  }
  
  // Check if the code contains only alphanumeric characters
  return /^[a-zA-Z0-9_-]+$/.test(code);
}

module.exports = {
  generateRoomCode,
  validateRoomCode
}; 