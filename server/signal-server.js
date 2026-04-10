import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';
import { verifyToken } from './auth/jwt.js';

import { createSignalRouter } from './routes/signal.js';
import { setupWebSocketConnection } from './controllers/signalController.js';
import { 
  signalProcesses, getLinkedAccount, importSignalDesktopMessages,
  createSignalProcess, setServerShuttingDown
} from './services/signalService.js';

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const server = createServer(app);
let wss;

// Mount routes
app.use('/', createSignalRouter(server));

const PREFERRED_PORT = parseInt(process.env.SIGNAL_PORT) || 3043;
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
    if (isAvailable) return port;
    console.log(`Port ${port} in use, trying ${port + 1}...`);
  }
  throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
}

async function startServer() {
  try {
    const port = await findAvailablePort(PREFERRED_PORT);
    wss = new WebSocketServer({ noServer: true });

    wss.on('connection', setupWebSocketConnection);

    server.on('upgrade', (request, socket, head) => {
      let token = null;
      if (request.headers.cookie) {
        const cookies = Object.fromEntries(request.headers.cookie.split('; ').map(c => c.split('=')));
        token = cookies.jwt;
      }
      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\\r\\n\\r\\n');
        socket.destroy();
        return;
      }
      try {
        verifyToken(token);
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } catch (err) {
        socket.write('HTTP/1.1 401 Unauthorized\\r\\n\\r\\n');
        socket.destroy();
      }
    });

    server.listen(port, async () => {
      console.log(`Signal server running on http://localhost:${port}`);
      console.log(`WebSocket available at ws://localhost:${port}`);

      const DEFAULT_SESSION = 'merge-app';
      await importSignalDesktopMessages(DEFAULT_SESSION);

      const linkedPhone = getLinkedAccount(DEFAULT_SESSION);
      if (linkedPhone && !signalProcesses.has(DEFAULT_SESSION)) {
        console.log(`[${DEFAULT_SESSION}] Auto-starting signal-cli for ${linkedPhone} to capture messages...`);
        try {
          await createSignalProcess(DEFAULT_SESSION, linkedPhone);
          console.log(`[${DEFAULT_SESSION}] signal-cli auto-started successfully`);
        } catch (err) {
          console.error(`[${DEFAULT_SESSION}] Failed to auto-start signal-cli:`, err.message);
        }
      }
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

function cleanupAndExit() {
  setServerShuttingDown(true);
  console.log('Signal server shutting down, killing child processes...');
  for (const [sessionId, procData] of signalProcesses) {
    try {
      console.log(`[${sessionId}] Killing signal-cli process...`);
      procData.process.kill('SIGTERM');
    } catch (e) {}
  }
  setTimeout(() => process.exit(0), 2000);
}

process.on('SIGTERM', cleanupAndExit);
process.on('SIGINT', cleanupAndExit);

export { app };
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
