import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/whatsapp-server.js';
import { signToken } from '../server/auth/jwt.js';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('WhatsApp POST /api/upload', () => {
  let token;
  const testFilePath = join(__dirname, 'test-whatsapp-file.txt');

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    token = signToken({ id: 1, username: 'testuser' });
    fs.writeFileSync(testFilePath, 'test content');
  });

  afterAll(() => {
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
  });

  it('should upload a file correctly', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', testFilePath);
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
  });

  it('should securely handle/reject path traversal payloads in filename', async () => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="../../../etc/passwd"\r\nContent-Type: text/plain\r\n\r\nmalicious content\r\n--${boundary}--\r\n`;
    
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
      .send(body);
    
    if (res.status === 400) {
      expect(res.body).toHaveProperty('error');
    } else {
      expect(res.status).toBe(200);
      expect(res.body.name).not.toMatch(/\.\.\//);
      expect(res.body.url).not.toMatch(/\.\.\//);
    }
  });
});
