/**
 * Connection module for the P2P file sharing application
 * Handles WebSocket and peer connections
 */

const Connection = {
  // Connection state
  ws: null,
  peer: null,
  currentRoom: null,
  isInitiator: false,
  reconnectAttempts: 0,
  reconnectTimeout: null,
  
  /**
   * Initialize the connection module
   * @param {Object} callbacks - Callback functions
   */
  initialize(callbacks) {
    this.callbacks = callbacks || {};
    
    // Check server health
    this.checkServerHealth();
  },
  
  /**
   * Check if the server is healthy
   */
  async checkServerHealth() {
    try {
      const response = await fetch(`${CONFIG.API_URL}/health`, { 
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (response.ok) {
        console.log('Server is healthy');
        if (this.callbacks.onConnectionStatusChange) {
          this.callbacks.onConnectionStatusChange('connected');
        }
      } else {
        console.error('Server health check failed');
        if (this.callbacks.onConnectionStatusChange) {
          this.callbacks.onConnectionStatusChange('disconnected');
        }
        if (this.callbacks.onError) {
          this.callbacks.onError('Server is not responding. Please try again later.');
        }
      }
    } catch (error) {
      console.error('Error checking server health:', error);
      if (this.callbacks.onConnectionStatusChange) {
        this.callbacks.onConnectionStatusChange('disconnected');
      }
      if (this.callbacks.onError) {
        this.callbacks.onError('Cannot connect to the server. Please check your internet connection.');
      }
    }
  },
  
  /**
   * Generate a room code
   */
  async generateCode() {
    try {
      console.log('Generating room code...');
      
      // Request a room code from the server
      const response = await fetch(`${CONFIG.API_URL}/api/generate-code`);
      
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
      this.currentRoom = roomCode;
      
      // Set as initiator (sender)
      this.isInitiator = true;
      
      // Connect to signaling server
      this.connectToSignalingServer();
      
      // Return the room code
      return roomCode;
      
    } catch (error) {
      console.error('Failed to generate room code:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(`Failed to generate room code: ${error.message}`);
      }
      throw error;
    }
  },
  
  /**
   * Join a room with the provided code
   * @param {string} roomCode - Room code to join
   */
  joinRoom(roomCode) {
    if (!roomCode) {
      if (this.callbacks.onError) {
        this.callbacks.onError('Please enter a room code.');
      }
      return;
    }
    
    console.log('Attempting to join room:', roomCode);
    
    // Set as non-initiator (receiver)
    this.isInitiator = false;
    this.currentRoom = roomCode;
    
    // Connect to signaling server
    this.connectToSignalingServer();
  },
  
  /**
   * Connect to the signaling server
   */
  connectToSignalingServer() {
    console.log('Connecting to signaling server...');
    
    // Create WebSocket connection with proper URL construction
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:3001`;
    console.log('WebSocket URL:', wsUrl);
    
    this.ws = new WebSocket(wsUrl);
    
    // Handle WebSocket events
    this.ws.onopen = () => {
      console.log('Connected to signaling server');
      if (this.callbacks.onConnectionStatusChange) {
        this.callbacks.onConnectionStatusChange('connected');
      }
      
      // If we have a room code, join the room
      if (this.currentRoom) {
        console.log('Sending join request for room:', this.currentRoom);
        this.ws.send(JSON.stringify({
          type: 'join',
          room: this.currentRoom
        }));
      } else {
        console.error('No room code available');
        if (this.callbacks.onError) {
          this.callbacks.onError('No room code available. Please refresh and try again.');
        }
      }
    };
    
    this.ws.onmessage = this.handleSignalingMessage.bind(this);
    
    this.ws.onclose = () => {
      console.log('Disconnected from signaling server');
      if (this.callbacks.onConnectionStatusChange) {
        this.callbacks.onConnectionStatusChange('disconnected');
      }
      
      // Try to reconnect
      setTimeout(this.attemptReconnect.bind(this), 5000);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (this.callbacks.onConnectionStatusChange) {
        this.callbacks.onConnectionStatusChange('disconnected');
      }
      if (this.callbacks.onError) {
        this.callbacks.onError('Connection error. Please refresh the page.');
      }
    };
  },
  
  /**
   * Attempt to reconnect to the signaling server
   */
  attemptReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff with max 30s
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${CONFIG.MAX_RECONNECT_ATTEMPTS})`);
    if (this.callbacks.onConnectionStatusChange) {
      this.callbacks.onConnectionStatusChange('connecting');
    }
    
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      if (this.currentRoom) {
        this.connectToSignalingServer();
      }
    }, delay);
  },
  
  /**
   * Handle signaling messages
   * @param {MessageEvent} event - WebSocket message event
   */
  handleSignalingMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log('Received signaling message:', message.type);
      
      switch (message.type) {
        case 'joined':
          console.log('Successfully joined room:', message.room);
          this.currentRoom = message.room;
          if (this.callbacks.onConnectionStatusChange) {
            this.callbacks.onConnectionStatusChange('connected');
          }
          
          // If we're the receiver (joining an existing room), create peer connection
          if (!this.peer && !this.isInitiator) {
            console.log('Creating peer connection as receiver');
            this.initiatePeerConnection(false);
          }
          
          // Notify the application
          if (this.callbacks.onRoomJoined) {
            this.callbacks.onRoomJoined(message.room);
          }
          break;
          
        case 'user-joined':
          console.log('Another user joined the room:', message.userId);
          if (this.callbacks.onConnectionStatusChange) {
            this.callbacks.onConnectionStatusChange('connected');
          }
          
          // If we're the initiator (created the room), create peer connection
          if (!this.peer && this.isInitiator) {
            console.log('Creating peer connection as initiator');
            this.initiatePeerConnection(true);
          }
          
          // Notify the application
          if (this.callbacks.onUserJoined) {
            this.callbacks.onUserJoined(message.userId);
          }
          break;
          
        case 'user-left':
          console.log('User left the room:', message.userId);
          if (this.callbacks.onConnectionStatusChange) {
            this.callbacks.onConnectionStatusChange('disconnected');
          }
          if (this.peer) {
            this.peer.destroy();
            this.peer = null;
          }
          
          // Notify the application
          if (this.callbacks.onUserLeft) {
            this.callbacks.onUserLeft(message.userId);
          }
          break;
          
        case 'offer':
          console.log('Received offer from peer');
          if (this.peer) {
            this.handleVideoOffer(message);
          } else {
            console.error('Received offer but peer connection not initialized');
            this.initiatePeerConnection(false);
            setTimeout(() => this.handleVideoOffer(message), 100);
          }
          break;
          
        case 'answer':
          console.log('Received answer from peer');
          if (this.peer) {
            this.handleVideoAnswer(message);
          } else {
            console.error('Received answer but peer connection not initialized');
          }
          break;
          
        case 'ice-candidate':
        case 'candidate':
          console.log('Received ICE candidate');
          if (this.peer) {
            this.handleNewICECandidate(message);
          } else {
            console.error('Received ICE candidate but peer connection not initialized');
          }
          break;
          
        case 'error':
          console.error('Signaling error:', message.message);
          if (this.callbacks.onError) {
            this.callbacks.onError(message.message);
          }
          break;
          
        default:
          // Forward other messages to the application
          if (this.callbacks.onSignalingMessage) {
            this.callbacks.onSignalingMessage(message);
          }
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
    }
  },
  
  /**
   * Handle video offer message
   * @param {Object} message - Offer message
   */
  handleVideoOffer(message) {
    if (!this.peer) {
      console.log('Creating peer connection to handle offer');
      this.initiatePeerConnection(false);
    }
    
    try {
      console.log('Setting remote description from offer');
      this.peer.signal(message.data);
    } catch (error) {
      console.error('Error handling video offer:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError('Failed to process connection offer.');
      }
    }
  },
  
  /**
   * Handle video answer message
   * @param {Object} message - Answer message
   */
  handleVideoAnswer(message) {
    try {
      console.log('Setting remote description from answer');
      this.peer.signal(message.data);
    } catch (error) {
      console.error('Error handling video answer:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError('Failed to process connection answer.');
      }
    }
  },
  
  /**
   * Handle ICE candidate
   * @param {Object} message - ICE candidate message
   */
  handleNewICECandidate(message) {
    try {
      const candidate = message.data.candidate || message.data;
      console.log('Adding ICE candidate:', candidate);
      
      if (this.peer) {
        this.peer.signal(message.data);
        console.log('ICE candidate added successfully');
      } else {
        console.error('Cannot add ICE candidate, peer connection not initialized');
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  },
  
  /**
   * Initiate a peer connection
   * @param {boolean} isInitiator - Whether this peer is the initiator
   */
  initiatePeerConnection(isInitiator) {
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
    this.peer = new SimplePeer(peerOptions);
    console.log('Peer created with options:', peerOptions);
    
    // Setup peer events
    this.setupPeerEvents();
    
    return this.peer;
  },
  
  /**
   * Setup peer connection events
   */
  setupPeerEvents() {
    this.peer.on('signal', (data) => {
      console.log('Generated signal data:', data.type || 'candidate');
      
      // Send signal data to the other peer via the signaling server
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('Sending signal to peer in room:', this.currentRoom);
        this.ws.send(JSON.stringify({
          type: data.type || 'ice-candidate',
          data: data,
          room: this.currentRoom
        }));
      } else {
        console.error('WebSocket not connected, cannot send signal');
        if (this.callbacks.onError) {
          this.callbacks.onError('Signaling server connection lost. Please refresh the page.');
        }
      }
    });
    
    this.peer.on('connect', () => {
      console.log('Peer connection established!');
      console.log('Connection details:', {
        isInitiator: this.peer._initiator,
        channelReady: this.peer._channel ? this.peer._channel.readyState : 'No data channel',
        connected: this.peer.connected,
        currentRoom: this.currentRoom
      });
      
      if (this.callbacks.onConnectionStatusChange) {
        this.callbacks.onConnectionStatusChange('connected');
      }
      
      // Notify the application
      if (this.callbacks.onPeerConnected) {
        this.callbacks.onPeerConnected();
      }
    });
    
    this.peer.on('data', (data) => {
      console.log('Received data type:', typeof data, data instanceof ArrayBuffer ? 'ArrayBuffer' : data instanceof Uint8Array ? 'Uint8Array' : 'other');
      console.log('Data size:', typeof data === 'string' ? data.length + ' chars' : data.byteLength + ' bytes');
      
      // Forward data to the application
      if (this.callbacks.onData) {
        this.callbacks.onData(data);
      }
    });
    
    this.peer.on('error', (error) => {
      console.error('Peer connection error:', error);
      console.error('Error details:', error.stack);
      
      if (this.callbacks.onConnectionStatusChange) {
        this.callbacks.onConnectionStatusChange('disconnected');
      }
      
      if (this.callbacks.onError) {
        this.callbacks.onError('Connection error. Please try again.');
      }
    });
    
    this.peer.on('close', () => {
      console.log('Peer connection closed');
      
      if (this.callbacks.onConnectionStatusChange) {
        this.callbacks.onConnectionStatusChange('disconnected');
      }
      
      this.peer = null;
      
      // Notify the application
      if (this.callbacks.onPeerDisconnected) {
        this.callbacks.onPeerDisconnected();
      }
    });
  },
  
  /**
   * Send data to the peer
   * @param {*} data - Data to send
   * @returns {boolean} - Whether the data was sent
   */
  send(data) {
    if (!this.peer || !this.peer.connected) {
      console.error('Cannot send data: peer not connected');
      return false;
    }
    
    try {
      this.peer.send(data);
      return true;
    } catch (error) {
      console.error('Error sending data:', error);
      return false;
    }
  },
  
  /**
   * Check if the peer connection is ready
   * @returns {boolean} - Whether the peer connection is ready
   */
  isPeerReady() {
    if (!this.peer) return false;
    if (!this.peer.connected) return false;
    if (this.peer._channel && this.peer._channel.readyState !== 'open') return false;
    return true;
  },
  
  /**
   * Disconnect from the peer and signaling server
   */
  disconnect() {
    // Close peer connection
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    
    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Reset state
    this.currentRoom = null;
    this.isInitiator = false;
    this.reconnectAttempts = 0;
    
    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
};

// Export the connection module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Connection;
} else {
  window.Connection = Connection;
} 