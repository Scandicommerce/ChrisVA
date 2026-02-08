import fetch from 'node-fetch';
import { Email, VAConfig } from '../core/types';

/**
 * Microsoft Graph API client for Outlook Mail.
 * Uses OAuth2 client credentials flow (app-only) or delegated flow.
 */
export class OutlookMailClient {
  private accessToken: string | null = null;

  constructor(private config: VAConfig['outlook']) {}

  async authorize(): Promise<void> {
    const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Outlook auth failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { access_token: string };
    this.accessToken = data.access_token;
  }

  private async graphRequest(endpoint: string): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authorized. Call authorize() first.');

    const url = `https://graph.microsoft.com/v1.0/users/${this.config.userEmail}${endpoint}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Graph API error (${res.status}): ${err}`);
    }

    return res.json();
  }

  async getUnreadEmails(count = 50): Promise<Email[]> {
    const data = (await this.graphRequest(
      `/mailFolders/inbox/messages?$filter=isRead eq false&$top=${count}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,isRead,importance,hasAttachments,conversationId,categories`
    )) as { value: OutlookMessage[] };

    return data.value.map((msg) => this.mapMessage(msg));
  }

  async getRecentEmails(hours = 24, count = 100): Promise<Email[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const data = (await this.graphRequest(
      `/mailFolders/inbox/messages?$filter=receivedDateTime ge ${since}&$top=${count}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,isRead,importance,hasAttachments,conversationId,categories`
    )) as { value: OutlookMessage[] };

    return data.value.map((msg) => this.mapMessage(msg));
  }

  private mapMessage(msg: OutlookMessage): Email {
    return {
      id: msg.id,
      from: msg.from?.emailAddress?.address || 'unknown',
      to: (msg.toRecipients || []).map((r) => r.emailAddress?.address || ''),
      subject: msg.subject || '(no subject)',
      body: msg.body?.content || '',
      snippet: msg.bodyPreview || '',
      date: new Date(msg.receivedDateTime),
      isRead: msg.isRead,
      labels: msg.categories || [],
      threadId: msg.conversationId || '',
      importance: msg.importance as Email['importance'] || 'normal',
      hasAttachments: msg.hasAttachments || false,
      conversationId: msg.conversationId || '',
    };
  }
}

interface OutlookMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body: { content: string; contentType: string };
  from: { emailAddress: { name: string; address: string } };
  toRecipients: Array<{ emailAddress: { name: string; address: string } }>;
  receivedDateTime: string;
  isRead: boolean;
  importance: string;
  hasAttachments: boolean;
  conversationId: string;
  categories: string[];
}
