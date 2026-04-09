# Deployment Guide

This document outlines the deployment configuration and procedures for the Merge Unified Messaging application.

## Docker Secrets in Production

For production environments, we use Docker Secrets to securely manage sensitive information.

1. Ensure the `secrets/` directory exists in the root of the project:
   ```bash
   mkdir -p secrets/
   ```
2. Place your secret files in the `secrets/` directory (e.g., `secrets/session_secret.txt`, `secrets/api_key.txt`). These files should not be committed to version control.
3. The `docker-compose.prod.yml` configuration is set up to read these secrets and pass them to the application securely, avoiding the need to inject sensitive data via environment variables directly.

## Firewall Rules

To ensure the application functions correctly, the following outbound firewall rules must be configured to allow the necessary external communication:

- **Slack Integration (WSS):** Allow Outbound TCP on port **443** for Secure WebSockets.
- **Email Integration (IMAP):** Allow Outbound TCP on port **993** for secure email retrieval.
- **Email Integration (SMTP):** Allow Outbound TCP on ports **465** and **587** for secure email sending.

## Container Health Monitoring

The application implements a robust health-checking mechanism via the `/api/health` endpoint.

- This endpoint continually monitors internal system statuses, including connections to external integrations.
- In the event of critical connection drops or unrecoverable integration failures, the health check will begin to fail.
- Docker's native `healthcheck` uses this endpoint. If the health check fails repeatedly, Docker will automatically restart the container. Admins should check the application logs to understand why the container restarted (e.g., persistent connection drops).
