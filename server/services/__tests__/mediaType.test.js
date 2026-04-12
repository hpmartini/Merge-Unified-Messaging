import { getMediaType } from '../whatsappService.js';

describe('Media Type Mapping', () => {
  it('should map standard audio mimetypes to audio', () => {
    expect(getMediaType('audio/ogg; codecs=opus')).toBe('audio');
    expect(getMediaType('audio/mp4')).toBe('audio');
    expect(getMediaType('audio/mpeg')).toBe('audio');
  });

  it('should fallback to extension for generic mimetypes', () => {
    expect(getMediaType('application/octet-stream', 'voice.ogg')).toBe('audio');
    expect(getMediaType('application/octet-stream', 'music.m4a')).toBe('audio');
    expect(getMediaType('application/octet-stream', 'sound.mp3')).toBe('audio');
    expect(getMediaType('application/octet-stream', 'recording.wav')).toBe('audio');
  });

  it('should map images correctly', () => {
    expect(getMediaType('image/jpeg')).toBe('image');
    expect(getMediaType('image/png')).toBe('image');
  });

  it('should map videos correctly', () => {
    expect(getMediaType('video/mp4')).toBe('video');
  });

  it('should fallback to document for unknown files', () => {
    expect(getMediaType('application/pdf')).toBe('document');
    expect(getMediaType('application/octet-stream', 'data.bin')).toBe('document');
  });
});
