import * as fs from 'fs';
import * as path from 'path';
import { google, gmail_v1 } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';
import { Email } from '../core/types';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

export class GmailClient {
  private gmail: gmail_v1.Gmail | null = null;

  async authorize(): Promise<void> {
    let auth;

    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
      const { client_id, client_secret } = credentials.installed || credentials.web;
      const oAuth2Client = new google.auth.OAuth2(client_id, client_secret);
      oAuth2Client.setCredentials(token);
      auth = oAuth2Client;
    } else {
      if (!fs.existsSync(CREDENTIALS_PATH)) {
        throw new Error(
          'credentials.json not found. Download it from Google Cloud Console:\n' +
            '  1. Go to https://console.cloud.google.com/apis/credentials\n' +
            '  2. Create OAuth 2.0 Client ID (Desktop app)\n' +
            '  3. Download JSON and save as credentials.json in project root'
        );
      }
      auth = await authenticate({ scopes: SCOPES, keyfilePath: CREDENTIALS_PATH });
      if (auth.credentials) {
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(auth.credentials));
      }
    }

    this.gmail = google.gmail({ version: 'v1', auth });
  }

  private ensureClient(): gmail_v1.Gmail {
    if (!this.gmail) throw new Error('Gmail not authorized. Call authorize() first.');
    return this.gmail;
  }

  async getUnreadEmails(maxResults = 50): Promise<Email[]> {
    const gmail = this.ensureClient();
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults,
    });

    const messages = res.data.messages || [];
    const emails: Email[] = [];

    for (const msg of messages) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      });

      const headers = detail.data.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const body = this.extractBody(detail.data.payload);

      emails.push({
        id: msg.id!,
        from: getHeader('From'),
        to: getHeader('To').split(',').map((s) => s.trim()),
        subject: getHeader('Subject'),
        body,
        snippet: detail.data.snippet || '',
        date: new Date(parseInt(detail.data.internalDate || '0', 10)),
        isRead: false,
        labels: detail.data.labelIds || [],
        threadId: detail.data.threadId || '',
      });
    }

    return emails;
  }

  async getRecentEmails(hours = 24, maxResults = 100): Promise<Email[]> {
    const gmail = this.ensureClient();
    const after = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: `after:${after}`,
      maxResults,
    });

    const messages = res.data.messages || [];
    const emails: Email[] = [];

    for (const msg of messages) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      });

      const headers = detail.data.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
      const body = this.extractBody(detail.data.payload);
      const labelIds = detail.data.labelIds || [];

      emails.push({
        id: msg.id!,
        from: getHeader('From'),
        to: getHeader('To').split(',').map((s) => s.trim()),
        subject: getHeader('Subject'),
        body,
        snippet: detail.data.snippet || '',
        date: new Date(parseInt(detail.data.internalDate || '0', 10)),
        isRead: !labelIds.includes('UNREAD'),
        labels: labelIds,
        threadId: detail.data.threadId || '',
      });
    }

    return emails;
  }

  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return '';

    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
      for (const part of payload.parts) {
        const nested = this.extractBody(part);
        if (nested) return nested;
      }
    }

    return '';
  }
}
