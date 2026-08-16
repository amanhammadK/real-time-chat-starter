# Real-Time Chat Starter

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version 1.0.0"/>
  <img src="https://img.shields.io/badge/node.js-20+-green.svg" alt="Node.js 20+"/>
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License"/>
  <img src="https://img.shields.io/badge/WebSocket-ready-blue.svg" alt="WebSocket Ready"/>
</p>

A real-time chat application starter with a WebSocket server, a full Next.js chat frontend, and an MCP server. Join channels, send messages, see typing indicators, and search history — with Zod validation on the MCP side and production-ready deployment configs.

## What's Included

- WebSocket chat server (`server/index.ts`) with join/message/typing/read/search
- Next.js chat frontend with channel sidebar, message bubbles, and search
- Node.js MCP server with chat tools
- GitHub Actions CI workflow
- Multi-stage Dockerfile with health checks
- ESLint + Prettier code quality setup
- Jest test suite for ES Modules

## Features

- **Real-Time Messaging**: Instant message delivery over WebSocket
- **Channels**: Join or create channels with a member list
- **Typing Indicators**: See who's typing in real time
- **Message Search**: Full-text search with channel filter
- **MCP Integration**: Model Context Protocol server
- **Zod Validation**: Type-safe message schemas
- **ES Module Support**: Modern JavaScript
- **Testing**: Jest configured for ES modules
- **Code Quality**: ESLint + Prettier standards
- **Dockerized**: Multi-stage build with HEALTHCHECK

## Quick Start

### Prerequisites

- Node.js 20 or higher
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/amanhammadK/real-time-chat-starter.git
cd real-time-chat-starter

# Install dependencies
npm install

# Set up environment
cp .env.example .env
```

### Running (two terminals)

Terminal 1 — WebSocket server:

```bash
npm run dev:server
```

Terminal 2 — web frontend:

```bash
npm run dev
```

Open http://localhost:3000, enter a display name, and start chatting. The frontend connects to the WebSocket server at `ws://localhost:3001` by default (override with `NEXT_PUBLIC_WS_URL`).

### Running the MCP server

```bash
npm start
```

### Testing

```bash
# Run tests
npm test
```

### Linting

```bash
# Lint source code
npm run lint
```

## Project Structure

```
real-time-chat-starter/
├── server/
│   └── index.ts                 # WebSocket chat server
├── app/
│   ├── layout.js                # App shell
│   └── page.js                  # Chat frontend
├── src/
│   ├── index.js                # MCP server entry point
│   ├── mcpServer.js            # MCP server implementation
│   └── schemas.js              # Zod validation schemas
├── tests/
│   └── template.test.js        # Test suite
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── .prettierrc                # Prettier configuration
├── Dockerfile                 # Multi-stage Docker build
├── eslint.config.js           # ESLint configuration
├── jest.config.js             # Jest configuration
├── next.config.js             # Next.js configuration
├── package.json               # Project dependencies
└── README.md                  # This file
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment mode (development/production) | No |
| `PORT` | MCP server port (default: 3000) | No |
| `WS_HOST` | WebSocket host (default: 0.0.0.0) | No |
| `WS_PORT` | WebSocket port (default: 3001) | No |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL the frontend connects to (default: ws://localhost:3001) | No |

### Chat Configuration

Customize the chat interface in `app/page.js`:

- Add message formatting and timestamps
- Implement user authentication
- Add file sharing or emoji support
- Connect to WebSocket backend

## Deployment

### Docker

```bash
# Build the image
docker build -t real-time-chat .

# Run the container
docker run -p 3000:3000 --env-file .env real-time-chat
```

### Production Deployment

- **AWS ECS/Fargate**: Containerized deployment
- **Railway**: Auto-deploy from GitHub
- **Render**: Web service with health checks

## Development Guide

### Implementing WebSocket Messages

```javascript
// WebSocket message handler
ws.on('message', (data) => {
    const message = JSON.parse(data);
    // Broadcast to all connected clients
    clients.forEach(client => {
        client.send(JSON.stringify(message));
    });
});
```

### Adding Chat Features

```javascript
function ChatMessage({ user, text, timestamp }) {
    return (
        <div className="message">
            <strong>{user}:</strong> {text}
            <small>{timestamp}</small>
        </div>
    );
}
```

### Code Style

- ESLint with recommended config
- Prettier for formatting
- ES module syntax
- Run `npm run lint` before committing

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with Node.js and ❤️
</p>