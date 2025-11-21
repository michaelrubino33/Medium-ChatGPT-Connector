// src/server.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Type definitions for our todo items
interface Todo {
    id: string;
    title: string;
    category?: string;
    completed: boolean;
    createdAt: Date;
}

// In-memory storage (resets when server restarts - perfect for demo!)
const todos: Todo[] = [];

// Helper function to get category metadata
const getCategoryData = (category: string) => {
    const categoryMap: Record<string, { icon: string; color: string; emoji: string }> = {
        grocery: { icon: '🛒', color: '#4CAF50', emoji: '🛒' },
        learning: { icon: '📚', color: '#2196F3', emoji: '📚' },
        work: { icon: '💼', color: '#FF9800', emoji: '💼' },
        exercise: { icon: '💪', color: '#E91E63', emoji: '💪' },
        general: { icon: '📝', color: '#9E9E9E', emoji: '📝' },
    };
    return categoryMap[category] || categoryMap.general;
};

/**
 * MCP endpoint - handles JSON-RPC requests from ChatGPT
 */
app.post('/mcp', async (req: Request, res: Response) => {
    const { jsonrpc, method, params, id } = req.body;

    console.log('📨 MCP request received:', method);

    // Validate JSON-RPC version
    if (jsonrpc !== '2.0') {
        return res.json({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Invalid Request' },
            id: id || null,
        });
    }

    // Handle the three MCP methods...
    // 1. Initialize - Protocol handshake
    if (method === 'initialize') {
        return res.json({
            jsonrpc: '2.0',
            result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: {
                    name: 'todo-assistant',
                    version: '1.0.0',
                },
            },
            id,
        });
    }

    // Handle notifications (no response needed)
    if (method?.startsWith('notifications/')) {
        return res.status(200).send();
    }

    // 2. List Tools - Tell ChatGPT what tools are available
    if (method === 'tools/list') {
        return res.json({
            jsonrpc: '2.0',
            result: {
                tools: [
                    {
                        name: 'add_todo',
                        description: 'Add a new task to the todo list',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                title: { type: 'string', description: 'Task title' },
                                category: { type: 'string', description: 'grocery, learning, work, etc.' },
                            },
                            required: ['title'],
                        },
                    },
                    {
                        name: 'get_todos',
                        description: 'Get all todo items',
                        inputSchema: { type: 'object', properties: {} },
                    },
                    {
                        name: 'update_todo',
                        description: 'Update a todo (mark complete, change title)',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                title: { type: 'string' },
                                completed: { type: 'boolean' },
                            },
                            required: ['id'],
                        },
                    },
                    {
                        name: 'delete_todo',
                        description: 'Delete a todo by ID',
                        inputSchema: {
                            type: 'object',
                            properties: { id: { type: 'string' } },
                            required: ['id'],
                        },
                    },
                ],
            },
            id,
        });
    }

    // 3. Call Tool - Execute the requested tool
    if (method === 'tools/call') {
        const { name, arguments: args } = params;

        switch (name) {
            case 'add_todo': {
                const { title, category } = args as { title: string; category?: string };
                const newTodo: Todo = {
                    id: Date.now().toString(),
                    title: title.trim(),
                    category: category?.trim() || 'general',
                    completed: false,
                    createdAt: new Date(),
                };
                todos.push(newTodo);
                console.log(`✅ Added todo: ${newTodo.title}`);

                const categoryData = getCategoryData(newTodo.category!);

                return res.json({
                    jsonrpc: '2.0',
                    result: {
                        content: [{
                            type: 'text',
                            text: `✅ **Task Added Successfully**\n\n${newTodo.title}\n${categoryData.emoji} ${newTodo.category}\nTotal tasks: ${todos.length}`
                        }]
                    },
                    id,
                });
            }

            case 'get_todos': {
                console.log(`📋 Retrieved ${todos.length} todos`);

                if (todos.length === 0) {
                    return res.json({
                        jsonrpc: '2.0',
                        result: {
                            content: [{
                                type: 'text',
                                text: '📋 **Your Todo List**\n\nNo tasks yet! Add one to get started.'
                            }],
                        },
                        id,
                    });
                }

                let text = `📋 **Your Todo List** (${todos.length} ${todos.length === 1 ? 'task' : 'tasks'})\n\n`;
                todos.forEach((todo, i) => {
                    const categoryData = getCategoryData(todo.category!);
                    const status = todo.completed ? '✅' : '⏳';
                    text += `${i + 1}. ${status} ${todo.title}\n`;
                    text += `   ${categoryData.emoji} ${todo.category} | ID: ${todo.id}\n\n`;
                });

                return res.json({
                    jsonrpc: '2.0',
                    result: {
                        content: [{ type: 'text', text }]
                    },
                    id,
                });
            }

            case 'update_todo': {
                const { id: todoId, title, category, completed } = args as any;
                const todo = todos.find((t) => t.id === todoId);
                if (!todo) {
                    return res.json({
                        jsonrpc: '2.0',
                        result: {
                            content: [{ type: 'text', text: '❌ **Error:** Todo not found' }],
                        },
                        id,
                    });
                }

                const oldCompleted = todo.completed;
                if (title !== undefined) todo.title = title;
                if (category !== undefined) todo.category = category;
                if (completed !== undefined) todo.completed = completed;
                console.log(`✏️  Updated todo: ${todo.title}`);

                const categoryData = getCategoryData(todo.category!);
                const statusChanged = completed !== undefined && oldCompleted !== completed;
                const header = statusChanged
                    ? (todo.completed ? '🎉 **Task Completed!**' : '🔄 **Task Reopened**')
                    : '✏️ **Task Updated**';

                return res.json({
                    jsonrpc: '2.0',
                    result: {
                        content: [{
                            type: 'text',
                            text: `${header}\n\n${todo.title}\n${categoryData.emoji} ${todo.category}\nStatus: ${todo.completed ? 'Completed ✅' : 'Pending ⏳'}`
                        }]
                    },
                    id,
                });
            }

            case 'delete_todo': {
                const { id: todoId } = args as { id: string };
                const index = todos.findIndex((t) => t.id === todoId);
                if (index === -1) {
                    return res.json({
                        jsonrpc: '2.0',
                        result: {
                            content: [{ type: 'text', text: '❌ **Error:** Todo not found' }],
                        },
                        id,
                    });
                }
                const deletedTodo = todos.splice(index, 1)[0];
                console.log(`🗑️  Deleted todo: ${deletedTodo.title}`);

                const categoryData = getCategoryData(deletedTodo.category!);

                return res.json({
                    jsonrpc: '2.0',
                    result: {
                        content: [{
                            type: 'text',
                            text: `🗑️ **Task Deleted**\n\n~~${deletedTodo.title}~~\nRemoved from ${categoryData.emoji} ${deletedTodo.category}\nRemaining tasks: ${todos.length}`
                        }]
                    },
                    id,
                });
            }

            default:
                return res.json({
                    jsonrpc: '2.0',
                    error: { code: -32601, message: `Method not found: ${name}` },
                    id,
                });
        }
    }

    // Unknown method
    return res.json({
        jsonrpc: '2.0',
        error: { code: -32601, message: `Method not found: ${method}` },
        id,
    });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        todos: todos.length,
        uptime: process.uptime(),
        mcpEndpoint: '/mcp',
    });
});

export default app;

// For local development only
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('ChatGPT MCP Server');
        console.log(`Server: http://localhost:${PORT}`);
        console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
}