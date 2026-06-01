import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupDatabase } from './db.js';
import { setupSocket } from './socket/index.js';
import listsRouter from './routes/lists.js';
import itemsRouter from './routes/items.js';

// Initialize database
setupDatabase();

const app = express();
const httpServer = createServer(app);

// Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
});

// Make io accessible in route handlers
app.locals.io = io;

// Middleware
app.use(cors({ origin: ['http://localhost:5173'] }));
app.use(express.json());

// Routes
app.use('/api/lists', listsRouter);
app.use('/api/lists', itemsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Socket.io event handlers
setupSocket(io);

// Start server
const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
