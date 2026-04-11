import express from 'express';
import { authenticate } from '../auth/middleware.js';
import { signalProcesses, AVATARS_DIR, MEDIA_DIR } from '../services/signalService.js';
import fs from 'fs';
import { extname, join } from 'path';
import multer from 'multer';

const router = express.Router();

router.use('/avatars', authenticate, express.static(AVATARS_DIR));
router.use('/media', authenticate, express.static(MEDIA_DIR));

const upload = multer({ dest: MEDIA_DIR });
router.post('/api/upload', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (req.file.originalname.includes('/') || req.file.originalname.includes('\\') || req.file.originalname.includes('..')) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Invalid filename: Path traversal detected' });
  }
  const ext = extname(req.file.originalname);
  const finalName = req.file.filename + ext;
  fs.renameSync(req.file.path, join(MEDIA_DIR, finalName));
  res.json({ url: `/media/${finalName}`, type: req.file.mimetype, size: req.file.size, name: req.file.originalname });
});

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
