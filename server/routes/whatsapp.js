import express from 'express';
import { authenticate } from '../auth/middleware.js';
import { getStatus, getSessions, getPortHandler } from '../controllers/whatsappController.js';
import { AVATARS_DIR, MEDIA_DIR } from '../services/whatsappService.js';
import fs from 'fs';
import { extname, join } from 'path';
import multer from 'multer';

export function setupRoutes(app, server) {
  // Serve avatars and media statically
  app.use('/avatars', authenticate, express.static(AVATARS_DIR));
  app.use('/media', authenticate, express.static(MEDIA_DIR));

  const upload = multer({ dest: MEDIA_DIR });
  app.post('/api/upload', authenticate, upload.single('file'), (req, res) => {
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

  app.get('/api/status/:sessionId', authenticate, getStatus);
  app.get('/api/sessions', authenticate, getSessions);
  app.get('/api/port', authenticate, getPortHandler(server));
}
