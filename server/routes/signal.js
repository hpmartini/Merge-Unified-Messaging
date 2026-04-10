import express from 'express';
import { authenticate } from '../auth/middleware.js';
import { signalProcesses, AVATARS_DIR, MEDIA_DIR } from '../services/signalService.js';

const router = express.Router();

router.use('/avatars', authenticate, express.static(AVATARS_DIR));
router.use('/media', authenticate, express.static(MEDIA_DIR));

router.get('/api/status/:sessionId', authenticate, (req, res) => {
  const procData = signalProcesses.get(req.params.sessionId);
  if (procData) {
    res.json({ connected: true, user: { id: procData.phoneNumber, name: procData.phoneNumber } });
  } else {
    res.json({ connected: false });
  }
});

router.get('/api/sessions', authenticate, (req, res) => {
  const sessions = [];
  signalProcesses.forEach((procData, sessionId) => {
    sessions.push({ sessionId, connected: true, user: { id: procData.phoneNumber, name: procData.phoneNumber } });
  });
  res.json(sessions);
});

// Since we need server.address().port for /api/port, we might need a way to pass it.
// We'll export a function to attach the port route or just pass the server instance.
export function createSignalRouter(server) {
  router.get('/api/port', authenticate, (req, res) => {
    res.json({ port: server ? server.address().port : null, service: 'signal' });
  });
  return router;
}

export default router;
