# ChatGPT MCP Todo Connector

A simple implementation of ChatGPT's Model Context Protocol (MCP) that lets you manage a todo list through natural conversation.

## What is MCP?

Model Context Protocol allows ChatGPT to connect to external tools and services. This project demonstrates how to build a custom connector that ChatGPT can interact with.

## Features

- **Add todos** - Create tasks with categories (grocery, learning, work, exercise, etc.)
- **View todos** - See all your tasks with status and categories
- **Update todos** - Mark complete or edit task details
- **Delete todos** - Remove tasks you no longer need

All through natural language with ChatGPT!

## Tech Stack

- **TypeScript** + **Express** - Server framework
- **MCP Protocol** - JSON-RPC 2.0 implementation
- **Vercel** - Serverless deployment

## Quick Start

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run locally
npm start
```

Server runs on `http://localhost:3000`

## Connect to ChatGPT

1. Deploy this server (or use the local URL)
2. In ChatGPT, add a new connector
3. Point it to your `/mcp` endpoint
4. Start chatting: "Add a todo to buy groceries"

## API Endpoints

- `POST /mcp` - MCP JSON-RPC endpoint
- `GET /health` - Health check

## Deployment

Deploy to Vercel with one click:

```bash
npm run build
vercel deploy
```

## License

MIT

---

*Built for a Medium article on ChatGPT connectors*
