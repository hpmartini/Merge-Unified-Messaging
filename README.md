# Merge - Unified Messaging

A unified messaging interface that consolidates conversations from multiple platforms (WhatsApp, Signal, Mail, SMS, Telegram, Slack, Teams, etc.) into a single timeline view with AI-powered summarization.

## Features

- Unified conversation view across 13+ messaging platforms
- AI-powered conversation summarization
- Platform-specific filtering
- Global and local search
- Media gallery and attachment handling
- Dark/Dimmed/Light theme support
- Mobile-responsive design

## Run Locally

**Prerequisites:** Node.js, Docker (optional)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up environment variables:
   Copy `.env.staging.example` to `.env` or `.env.local` and fill in:
   - `GEMINI_API_KEY`
   - Platform Credentials (Telegram, Slack, Email)
   - DB credentials
3. Run the app:
   ```bash
   npm run dev
   ```

The app will be available at http://localhost:3001

## Docker Production & Secrets
For production deployments, `docker-compose.prod.yml` uses Docker Secrets to securely manage sensitive credentials. Ensure the following environment variables are passed securely as secrets or set in the `.env.production` file:
- `TELEGRAM_BOT_TOKEN`
- `EMAIL_PASSWORD`
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`
- Database Credentials

Deploy with:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

**For more detailed deployment instructions, including firewall requirements and health monitoring, please read the [Deployment Guide](docs/DEPLOYMENT.md).**
