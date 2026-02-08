import fetch from 'node-fetch';
import { CalendarEvent, VAConfig } from '../core/types';

/**
 * Microsoft Graph API client for Outlook Calendar.
 */
export class OutlookCalendarClient {
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
      throw new Error(`Outlook Calendar auth failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { access_token: string };
    this.accessToken = data.access_token;
  }

  /** Reuse an existing access token (e.g., from OutlookMailClient) */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async graphRequest(endpoint: string): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authorized. Call authorize() first.');

    const url = `https://graph.microsoft.com/v1.0/users/${this.config.userEmail}${endpoint}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Graph Calendar API error (${res.status}): ${err}`);
    }

    return res.json();
  }

  async getTodaysEvents(): Promise<CalendarEvent[]> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    return this.getEvents(startOfDay, endOfDay);
  }

  async getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    const startStr = start.toISOString();
    const endStr = end.toISOString();

    const data = (await this.graphRequest(
      `/calendarView?startDateTime=${startStr}&endDateTime=${endStr}&$top=50&$orderby=start/dateTime&$select=id,subject,start,end,location,isAllDay,organizer,attendees,isOnlineMeeting,onlineMeeting,showAs,body`
    )) as { value: OutlookEvent[] };

    return data.value.map((evt) => this.mapEvent(evt));
  }

  private mapEvent(evt: OutlookEvent): CalendarEvent {
    const statusMap: Record<string, CalendarEvent['status']> = {
      free: 'free',
      tentative: 'tentative',
      busy: 'busy',
      oof: 'oof',
      workingElsewhere: 'busy',
    };

    return {
      id: evt.id,
      subject: evt.subject || '(no subject)',
      start: new Date(evt.start.dateTime + 'Z'),
      end: new Date(evt.end.dateTime + 'Z'),
      location: evt.location?.displayName || '',
      isAllDay: evt.isAllDay || false,
      organizer: evt.organizer?.emailAddress?.address || '',
      attendees: (evt.attendees || []).map((a) => a.emailAddress?.address || ''),
      isOnline: evt.isOnlineMeeting || false,
      onlineUrl: evt.onlineMeeting?.joinUrl || '',
      status: statusMap[evt.showAs] || 'unknown',
      body: evt.body?.content || '',
    };
  }
}

interface OutlookEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location: { displayName: string };
  isAllDay: boolean;
  organizer: { emailAddress: { name: string; address: string } };
  attendees: Array<{ emailAddress: { name: string; address: string } }>;
  isOnlineMeeting: boolean;
  onlineMeeting: { joinUrl: string } | null;
  showAs: string;
  body: { content: string; contentType: string };
}
