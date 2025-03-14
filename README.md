# P2P File-Sharing Platform

A simple, secure, and efficient peer-to-peer file-sharing application that allows direct file transfers between devices without server storage.

## Features

- **Direct P2P Connection**: Files are transferred directly between devices using WebRTC.
- **No Server Storage**: Your files never touch the server, ensuring privacy.
- **Simple Room System**: Connect devices using an easy-to-share 6-digit room code.
- **Progress Tracking**: Monitor transfer progress, speed, and estimated time remaining.
- **Multiple File Support**: Send multiple files in a single session.
- **Drag & Drop**: Simple and intuitive file selection.
- **Responsive Design**: Works on desktop and mobile devices.
- **Dark Mode**: Toggle between light and dark themes.
- **Transfer History**: Keep track of sent and received files.

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript (Modular architecture)
- **Backend**: Node.js, Express.js
- **WebRTC**: Simple-peer library for P2P connections
- **WebSockets**: For signaling between peers
- **UUID Generation**: Nanoid for creating unique room codes

## Prerequisites

- Node.js (v14 or later)
- npm or yarn

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/p2p-file-sharing.git
cd p2p-file-sharing
```

2. Install the dependencies:

```bash
npm install
```

3. Start the application (both backend and frontend):

```bash
# Start the backend server
npm run backend

# In a separate terminal, start the frontend server
npm run frontend
```

4. Access the application in your browser:

```
http://localhost:8080
```

## Usage

### Sending Files

1. Open the application in your browser.
2. Click on "Generate Code" to create a new room.
3. Share the 6-digit code with the recipient.
4. Once the recipient connects, select files to send.
5. Click "Send Files" to begin the transfer.

### Receiving Files

1. Open the application in your browser.
2. Enter the 6-digit room code provided by the sender.
3. Click "Connect" to join the room.
4. Files will be received automatically once the sender initiates the transfer.
5. Click "Download" to save received files.

## Project Structure

```
p2p-file-sharing/
├── backend/
│   ├── signaling-server.js  # WebSocket server for signaling
│   ├── generate-code.js     # Room code generation utility
├── frontend/
│   ├── public/
│   │   ├── index.html       # Main HTML file
│   │   ├── styles.css       # CSS styles
│   │   ├── js/
│   │   │   ├── app.js       # Main application logic
│   │   │   ├── config.js    # Configuration parameters
│   │   │   ├── connection.js # Connection management
│   │   │   ├── fileTransfer.js # File transfer logic
│   │   │   ├── ui.js        # UI management
│   │   │   ├── utils.js     # Utility functions
├── package.json             # Project dependencies and scripts
├── README.md                # Project documentation
```

## Modular Architecture

The application is built with a modular architecture to improve maintainability and code organization:

- **Config Module**: Contains configuration parameters for the application.
- **Utils Module**: Provides utility functions for formatting, ID generation, etc.
- **UI Module**: Handles all DOM interactions and UI updates.
- **Connection Module**: Manages WebSocket and peer connections.
- **FileTransfer Module**: Handles sending and receiving files.
- **App Module**: Integrates all modules and initializes the application.

## Security Considerations

- The application uses WebRTC's built-in DTLS/SRTP encryption for secure data transfer.
- Files are transferred directly between peers without being stored on any server.
- Room codes expire after a period of inactivity.

## Troubleshooting

### Connection Issues

- Ensure both devices are connected to the internet.
- Some corporate networks or firewalls may block WebRTC connections.
- Try using a different browser if you experience connection issues.

### File Transfer Issues

- Large files may take longer to transfer, depending on your connection speed.
- If a file transfer gets stuck, try refreshing the page and reconnecting.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Simple-Peer](https://github.com/feross/simple-peer) - WebRTC library
- [WebSockets](https://github.com/websockets/ws) - WebSocket implementation
- [Nanoid](https://github.com/ai/nanoid) - Unique ID generation 