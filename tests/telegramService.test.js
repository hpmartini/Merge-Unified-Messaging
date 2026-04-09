import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { Telegraf } from 'telegraf';
import pino from 'pino';

// Mock telegraf to prevent actual initialization
vi.mock('telegraf', () => ({
  Telegraf: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    launch: vi.fn().mockResolvedValue(),
    stop: vi.fn()
  }))
}));

const { mockWarn, mockError } = vi.hoisted(() => {
  return {
    mockWarn: vi.fn(),
    mockError: vi.fn()
  };
});

vi.mock('pino', () => {
  return {
    default: vi.fn().mockReturnValue({
      warn: mockWarn,
      error: mockError,
      info: vi.fn()
    })
  };
});

describe('TelegramService Security & Env Validation', () => {
  let telegramService;

  beforeEach(async () => {
    vi.resetModules();
    mockWarn.mockClear();
    mockError.mockClear();
    
    // We need to re-import to pick up new env vars in the module scope
    const mod = await import('../server/services/telegramService.js');
    telegramService = mod.telegramService;
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_API_ID;
    delete process.env.TELEGRAM_API_HASH;
  });

  it('should validate and initialize successfully when env vars are valid', () => {
    process.env.TELEGRAM_BOT_TOKEN = '12345:validtoken';
    
    // Re-instantiate
    telegramService.init();

    // Warn should not be called with the Zod validation error
    expect(mockWarn).not.toHaveBeenCalledWith('Telegram environment variables validation failed. Telegram service disabled.');
  });

  it('should fail securely and warn when TELEGRAM_BOT_TOKEN is missing', () => {
    delete process.env.TELEGRAM_BOT_TOKEN; // Intentionally absent
    
    telegramService.init();

    // Verify error is logged securely without leaking secrets
    expect(mockWarn).toHaveBeenCalledWith('Telegram environment variables validation failed. Telegram service disabled.');
  });
});
