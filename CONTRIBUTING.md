# Contributing to P2P File-Sharing Platform

Thank you for considering contributing to the P2P File-Sharing Platform! This document outlines the guidelines for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and considerate of others.

## How Can I Contribute?

### Reporting Bugs

- Check if the bug has already been reported in the Issues section.
- Use the bug report template when creating a new issue.
- Include detailed steps to reproduce the bug.
- Include screenshots if applicable.
- Specify your operating system and browser version.

### Suggesting Enhancements

- Check if the enhancement has already been suggested in the Issues section.
- Use the feature request template when creating a new issue.
- Provide a clear description of the enhancement.
- Explain why this enhancement would be useful to most users.

### Pull Requests

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Make your changes.
4. Run tests to ensure your changes don't break existing functionality.
5. Submit a pull request.

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/p2p-file-sharing.git
   cd p2p-file-sharing
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development servers:
   ```bash
   # Start the backend server
   npm run backend
   
   # In a separate terminal, start the frontend server
   npm run frontend
   ```

4. Access the application at `http://localhost:8080`.

## Project Structure

The project follows a modular architecture:

- **Config Module**: Contains configuration parameters for the application.
- **Utils Module**: Provides utility functions for formatting, ID generation, etc.
- **UI Module**: Handles all DOM interactions and UI updates.
- **Connection Module**: Manages WebSocket and peer connections.
- **FileTransfer Module**: Handles sending and receiving files.
- **App Module**: Integrates all modules and initializes the application.

## Coding Guidelines

- Follow the existing code style.
- Use meaningful variable and function names.
- Write comments for complex logic.
- Keep functions small and focused on a single task.
- Use ES6+ features where appropriate.

## Testing

- Test your changes in multiple browsers (Chrome, Firefox, Safari, Edge).
- Test on both desktop and mobile devices if possible.
- Ensure the application works with different file types and sizes.

## Documentation

- Update the README.md file if your changes affect the installation or usage instructions.
- Document new features or changes in behavior.
- Update JSDoc comments for functions and methods.

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT License. 