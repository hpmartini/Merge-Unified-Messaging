import express from 'express';
import { authenticate } from '../auth/middleware.js';
import { getStatus, getSessions, getPortHandler } from '../controllers/whatsappController.js';
import { AVATARS_DIR, MEDIA_DIR } from '../services/whatsappService.js';
import fs from 'fs';
import { extname, join } from 'path';
import multer from 'multer';
import { createUploadMiddleware } from '../utils/uploadHandler.js';

export function setupRoutes(app, server) {
  // Serve avatars and media statically
  app.use('/avatars', authenticate, express.static(AVATARS_DIR));
  app.use('/media', authenticate, express.static(MEDIA_DIR));

  const { upload, handleUpload } = createUploadMiddleware(MEDIA_DIR);
  app.post('/api/upload', authenticate, upload.single('file'), handleUpload);

  app.get('/api/status/:sessionId', authenticate, getStatus);
  app.get('/api/sessions', authenticate, getSessions);
  app.get('/api/port', authenticate, getPortHandler(server));
}
