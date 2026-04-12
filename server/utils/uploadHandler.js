import fs from 'fs';
import { extname, join } from 'path';
import multer from 'multer';
import { fileTypeFromFile } from 'file-type';

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_DOC_SIZE = 50 * 1024 * 1024;   // 50MB

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'application/msword', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'video/mp4', 'audio/mpeg', 'audio/ogg', 'audio/mp4'
];

export const createUploadMiddleware = (mediaDir) => {
  const upload = multer({ 
    dest: mediaDir,
    limits: { fileSize: MAX_DOC_SIZE }
  });

  const handleUpload = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const cleanup = () => {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    };

    if (req.file.originalname.includes('/') || req.file.originalname.includes('\\') || req.file.originalname.includes('..')) {
      cleanup();
      return res.status(400).json({ error: 'Invalid filename: Path traversal detected' });
    }

    try {
      const fileType = await fileTypeFromFile(req.file.path);
      
      // file-type might not detect plain text files. Fallback to req.file.mimetype if it's text/plain.
      let mimeType = fileType ? fileType.mime : null;
      if (!mimeType && req.file.mimetype === 'text/plain') {
        mimeType = 'text/plain';
      }

      if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
        cleanup();
        return res.status(400).json({ error: `Invalid file type: ${mimeType || req.file.mimetype}` });
      }

      const isImageOrMedia = mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/');
      if (isImageOrMedia && req.file.size > MAX_IMAGE_SIZE) {
        cleanup();
        return res.status(400).json({ error: 'Media file size exceeds 20MB limit' });
      }
      if (!isImageOrMedia && req.file.size > MAX_DOC_SIZE) {
        cleanup();
        return res.status(400).json({ error: 'Document file size exceeds 50MB limit' });
      }

      const ext = extname(req.file.originalname);
      const finalName = req.file.filename + ext;
      fs.renameSync(req.file.path, join(mediaDir, finalName));
      
      res.json({ url: `/media/${finalName}`, type: mimeType, size: req.file.size, name: req.file.originalname });
    } catch (err) {
      cleanup();
      console.error('File upload processing error:', err);
      res.status(500).json({ error: 'Internal server error during file processing' });
    }
  };

  return { upload, handleUpload };
};