import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/ai-proxy.js';
import { signToken } from '../server/auth/jwt.js';
import fs from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('POST /api/upload', () => {
  let token;
  const testFilePath = join(__dirname, 'test-file.txt');

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
    
    // Either it rejects it with 400, or handles it safely returning 200 without traversal
    if (res.status === 400) {
      expect(res.body).toHaveProperty('error');
    } else {
      expect(res.status).toBe(200);
      expect(res.body.name).not.toMatch(/\.\.\//);
      expect(res.body.url).not.toMatch(/\.\.\//);
    }
  });

  it('should reject invalid file types', async () => {
    const invalidFilePath = join(__dirname, 'test-invalid.exe');
    fs.writeFileSync(invalidFilePath, 'MZ...'); // Fake executable
    
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', invalidFilePath);
    
    fs.unlinkSync(invalidFilePath);
    
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid file type/);
  });

  it('should prevent text/plain fallback bypass for binary files', async () => {
    const bypassFilePath = join(__dirname, 'test-bypass.txt');
    // Create a file with a null byte to simulate a binary that file-type might miss
    const buffer = Buffer.from([0x61, 0x62, 0x63, 0x00, 0x64]);
    fs.writeFileSync(bypassFilePath, buffer);
    
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', bypassFilePath, { contentType: 'text/plain' });
    
    fs.unlinkSync(bypassFilePath);
    
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid file type/);
  });
});
