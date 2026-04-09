import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { z } from 'zod';

const emailConfigSchema = z.object({
  EMAIL_USER: z.string().email(),
  EMAIL_PASS: z.string().min(1),
  IMAP_HOST: z.string().min(1),
  IMAP_PORT: z.string().regex(/^\d+$/).transform(Number).optional().default("993"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.string().regex(/^\d+$/).transform(Number).optional().default("465")
});

class EmailService {
  constructor() {
    this.isConfigured = false;
    
    try {
      const config = emailConfigSchema.parse(process.env);
      this.emailUser = config.EMAIL_USER;
      this.emailPass = config.EMAIL_PASS;
      this.imapHost = config.IMAP_HOST;
      this.imapPort = config.IMAP_PORT;
      this.smtpHost = config.SMTP_HOST;
      this.smtpPort = config.SMTP_PORT;
      
      this.isConfigured = true;
      
      this.transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: this.smtpPort === 465,
        auth: {
          user: this.emailUser,
          pass: this.emailPass
        }
      });
      console.log('[EmailService] Initialized successfully.');
    } catch (error) {
      console.warn('[EmailService] Missing or invalid email credentials. Email features will be disabled.');
      // If we want to see the specific errors during debugging:
      // console.warn(error.errors);
    }
  }

  async getImapClient() {
    if (!this.isConfigured) throw new Error('Email service not configured');
    const client = new ImapFlow({
      host: this.imapHost,
      port: this.imapPort,
      secure: true,
      auth: {
        user: this.emailUser,
        pass: this.emailPass
      },
      logger: false
    });
    await client.connect();
    return client;
  }

  async sendEmail(to, subject, text, html) {
    if (!this.isConfigured) throw new Error('Email service not configured');
    
    const mailOptions = {
      from: this.emailUser,
      to,
      subject,
      text,
      html
    };

    const info = await this.transporter.sendMail(mailOptions);
    return info;
  }

  async getRecentChats(limit = 20) {
    if (!this.isConfigured) return [];
    
    let client;
    try {
      client = await this.getImapClient();
      let lock = await client.getMailboxLock('INBOX');
      
      const messages = [];
      try {
        const fetchOptions = {
          envelope: true,
          flags: true,
          internalDate: true
        };
        
        for await (let message of client.fetch('1:*', fetchOptions, { uid: true })) {
          messages.push(message);
        }
      } finally {
        lock.release();
      }

      // Sort by date descending
      messages.sort((a, b) => b.internalDate - a.internalDate);
      const recent = messages.slice(0, limit);

      const chats = recent.map(msg => ({
        id: msg.envelope.messageId || msg.uid.toString(),
        from: msg.envelope.from.map(f => f.address).join(', '),
        subject: msg.envelope.subject,
        date: msg.internalDate,
        flags: [...msg.flags]
      }));

      return chats;
    } catch (error) {
      console.error('[EmailService] getRecentChats error:', error);
      throw error;
    } finally {
      if (client) await client.logout();
    }
  }

  async getMessageDetails(uid) {
    if (!this.isConfigured) return null;

    let client;
    try {
      client = await this.getImapClient();
      let lock = await client.getMailboxLock('INBOX');
      let messageData = null;

      try {
        let msg = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
        if (msg) {
          const parsed = await simpleParser(msg.source);
          messageData = {
            id: msg.envelope.messageId || uid.toString(),
            from: msg.envelope.from.map(f => f.address).join(', '),
            subject: msg.envelope.subject,
            date: msg.internalDate,
            text: parsed.text,
            html: parsed.html
          };
        }
      } finally {
        lock.release();
      }
      return messageData;
    } catch (error) {
      console.error('[EmailService] getMessageDetails error:', error);
      throw error;
    } finally {
      if (client) await client.logout();
    }
  }
}

export const emailService = new EmailService();
