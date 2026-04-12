import { Router } from 'express';
import { telegramService } from '../services/telegramService.js';
import { slackService } from '../services/slackService.js';
import { emailService } from '../services/emailService.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  let isHealthy = true;
  
  // Check Slack connection
  const isSlackEnabled = !!process.env.SLACK_BOT_TOKEN;
  const slackActive = isSlackEnabled ? slackService.isConnected : false;
  if (isSlackEnabled && !slackActive) isHealthy = false;

  // Check Telegram connection
  const isTelegramEnabled = !!process.env.TELEGRAM_BOT_TOKEN;
  const telegramActive = isTelegramEnabled ? telegramService.isConnected : false;
  if (isTelegramEnabled && !telegramActive) isHealthy = false;

  // Check Email (IMAP/SMTP)
  let emailActive = false;
  const isEmailEnabled = !!process.env.EMAIL_HOST || emailService.isConfigured;
  if (emailService.isConfigured) {
    try {
      const imapClient = await emailService.getImapClient();
      await imapClient.logout();
      emailActive = true;
    } catch (e) {
      emailActive = false;
      isHealthy = false;
    }
  } else if (isEmailEnabled) {
    isHealthy = false;
  }

  const statusCode = isHealthy ? 200 : 503;
  
  res.status(statusCode).json({
    status: isHealthy ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    services: {
      telegram: telegramActive,
      slack: slackActive,
      email: emailActive,
      db: !!process.env.DATABASE_URL
    }
  });
});
