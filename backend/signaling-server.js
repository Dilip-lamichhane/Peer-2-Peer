const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { nanoid } = require('nanoid');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { generateRoomCode, validateRoomCode } = require('./generate-code');

// Verify nanoid is working
console.log('Testing nanoid:', nanoid(6));

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());

// Parse JSON requests
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server with ping/pong to keep connections alive
const wss = new WebSocket.Server({ 
  server,
  // Increase the timeout for better reliability
  clientTracking: true,
});

// Create the public/js directory if it doesn't exist
const publicJsDir = path.join(__dirname, '../frontend/public/js');
if (!fs.existsSync(publicJsDir)) {
  fs.mkdirSync(publicJsDir, { recursive: true });
}

// Copy the App.js file to the public/js directory as app.js (if it exists)
const sourceAppJs = path.join(__dirname, '../frontend/src/App.js');
const destAppJs = path.join(publicJsDir, 'app.js');
if (fs.existsSync(sourceAppJs)) {
  try {
    fs.copyFileSync(sourceAppJs, destAppJs);
    console.log('Successfully copied App.js to public/js/app.js');
  } catch (error) {
    console.error('Error copying App.js:', error.message);
  }
} else {
  console.log('Source App.js not found, skipping copy operation');
}

// Serve static files from the frontend/public directory
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check request received');
  res.status(200).json({ status: 'ok' });
});

// API endpoint for generating a room code
app.get('/api/generate-code', (req, res) => {
  try {
    console.log('Received code generation request');
    
    // Generate a room code
    const code = generateRoomCode();
    console.log('Generated room code:', code);
    
    // Send the code back to the client
    res.json({
      success: true,
      code: code
    });
  } catch (error) {
    console.error('Error generating room code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate room code'
    });
  }
});

// Store active connections and rooms
const connections = new Map(); // userId -> { ws, roomId }
const rooms = new Map(); // roomId -> Set of userIds

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  // Generate a unique ID for this connection
  const userId = nanoid();
  console.log(`User ${userId} connected`);
  
  // Store the connection
  connections.set(userId, { ws, roomId: null });
  
  // Set up ping/pong for connection health
  ws.isAlive = true;
  ws.on('pong', heartbeat);
  
  // Send the user their ID
  ws.send(JSON.stringify({
    type: 'connection-established',
    userId: userId
  }));
  
  // Handle messages from clients
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received message from ${userId}:`, data.type);
      
      // Add the sender's ID to the message
      data.senderId = userId;
      
      switch (data.type) {
        case 'join':
          // User wants to join a room
          const roomId = data.room;
          console.log(`User ${userId} wants to join room ${roomId}`);
          
          if (!roomId) {
            console.error(`User ${userId} tried to join with invalid room ID`);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid room ID'
            }));
            return;
          }
          
          handleJoinRoom(userId, roomId);
          break;
          
        case 'offer':
        case 'answer':
          // Forward offer/answer to the other peer in the room
          const targetRoom = data.room;
          console.log(`Forwarding ${data.type} from ${userId} to other users in room ${targetRoom}`);
          
          if (!targetRoom) {
            console.error(`User ${userId} sent ${data.type} with invalid room ID`);
            return;
          }
          
          forwardMessageToRoom(userId, data);
          break;
          
        case 'ice-candidate':
        case 'candidate':
          // Forward ICE candidate to the other peer in the room
          const candidateRoom = data.room;
          console.log(`Forwarding ICE candidate from ${userId} to other users in room ${candidateRoom}`);
          
          if (!candidateRoom) {
            console.error(`User ${userId} sent ICE candidate with invalid room ID`);
            return;
          }
          
          forwardMessageToRoom(userId, data);
          break;
          
        default:
          console.log(`Unknown message type: ${data.type}`);
          if (data.room) {
            console.log(`Attempting to forward message of type ${data.type} to room ${data.room}`);
            forwardMessageToRoom(userId, data);
          } else {
            console.error(`Message of type ${data.type} has no room ID`);
          }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log(`User ${userId} disconnected`);
    
    // Get the user's room
    const user = connections.get(userId);
    if (user && user.roomId) {
      // Notify other users in the room
      notifyUserLeft(userId, user.roomId);
      
      // Remove the user from the room
      const room = rooms.get(user.roomId);
      if (room) {
        room.delete(userId);
        
        // If the room is empty, remove it
        if (room.size === 0) {
          rooms.delete(user.roomId);
        }
      }
    }
    
    // Remove the user from the clients map
    connections.delete(userId);
  });
});

function heartbeat() {
  this.isAlive = true;
}

// Forward a message to all other users in a room
function forwardMessageToRoom(senderId, data) {
  const roomId = data.room;
  
  // Check if the room exists
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} does not exist`);
    return;
  }
  
  // Get the room
  const room = rooms.get(roomId);
  
  // Forward the message to all other users in the room
  room.forEach((userId) => {
    // Don't send the message back to the sender
    if (userId !== senderId) {
      const user = connections.get(userId);
      if (user && user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(JSON.stringify(data));
      }
    }
  });
}

// Ping clients every 30 seconds to keep connections alive
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

// Error handling for the server
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server is ready for connections`);
});

// Handle a user joining a room
function handleJoinRoom(userId, roomId) {
  // Create room if it doesn't exist
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  
  // Add user to room
  rooms.get(roomId).add(userId);
  
  // Update user's room in connections map
  if (connections.has(userId)) {
    connections.get(userId).roomId = roomId;
  }
  
  console.log(`User ${userId} joined room ${roomId}`);
  
  // Notify user they've joined
  const userWs = connections.get(userId).ws;
  if (userWs.readyState === WebSocket.OPEN) {
    userWs.send(JSON.stringify({
      type: 'joined',
      room: roomId,
      userId: userId
    }));
  }
  
  // Notify other users in the room that someone joined
  notifyUserJoined(userId, roomId);
}

// Notify other users in a room that a user joined
function notifyUserJoined(userId, roomId) {
  if (!rooms.has(roomId)) return;
  
  const room = rooms.get(roomId);
  
  // Send notification to all other users in the room
  room.forEach((memberId) => {
    if (memberId !== userId && connections.has(memberId)) {
      const memberWs = connections.get(memberId).ws;
      if (memberWs.readyState === WebSocket.OPEN) {
        memberWs.send(JSON.stringify({
          type: 'user-joined',
          userId: userId,
          room: roomId
        }));
      }
    }
  });
}

// Notify users in a room that a user left
function notifyUserLeft(userId, roomId) {
  if (!rooms.has(roomId)) return;
  
  const room = rooms.get(roomId);
  
  // Send notification to all other users in the room
  room.forEach((memberId) => {
    if (memberId !== userId && connections.has(memberId)) {
      const memberWs = connections.get(memberId).ws;
      if (memberWs.readyState === WebSocket.OPEN) {
        memberWs.send(JSON.stringify({
          type: 'user-left',
          userId: userId,
          room: roomId
        }));
      }
    }
  });
}