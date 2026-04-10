import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';
import { verifyToken } from './auth/jwt.js';

import { setupRoutes } from './routes/whatsapp.js';
import { setupWebSocket } from './controllers/whatsappController.js';

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const server = createServer(app);
let wss;

setupRoutes(app, server);

// Try ports starting from preferred, find first available
const PREFERRED_PORT = parseInt(process.env.WHATSAPP_PORT) || 3042;
const MAX_PORT_ATTEMPTS = 10;

async function findAvailablePort(startPort, maxAttempts = 10) {
  const net = await import('net');

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort + attempt;
    const isAvailable = await new Promise((resolve) => {
      const tester = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () => {
          tester.close();
          resolve(true);
        })
        .listen(port);
    });

    if (isAvailable) {
      return port;
    }
    console.log(`Port ${port} in use, trying ${port + 1}...`);
  }

  throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
}

async function startServer() {
  try {
    const port = await findAvailablePort(PREFERRED_PORT, MAX_PORT_ATTEMPTS);

    wss = new WebSocketServer({ noServer: true });
    setupWebSocket(wss);

    server.on('upgrade', (request, socket, head) => {
      let token = null;
      if (request.headers.cookie) {
        const cookies = Object.fromEntries(request.headers.cookie.split('; ').map(c => c.split('=')));
        token = cookies.jwt;
      }
      
      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      
      try {
        verifyToken(token);
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } catch (err) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    });

    server.listen(port, () => {
      console.log(`WhatsApp server running on http://localhost:${port}`);
      console.log(`WebSocket available at ws://localhost:${port}`);
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

export { app };
if (process.env.NODE_ENV !== 'test') {
  startServer();
}