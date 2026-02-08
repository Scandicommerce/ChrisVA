// ===== ChrisVA Core Types =====

// ─── Email (Outlook) ─────────────────────────────────
export interface Email {
  id: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  snippet: string;
  date: Date;
  isRead: boolean;
  labels: string[];
  threadId: string;
  importance: 'low' | 'normal' | 'high';
  hasAttachments: boolean;
  conversationId: string;
}

export interface EmailSummary {
  email: Email;
  priority: Priority;
  category: EmailCategory;
  actionRequired: boolean;
  suggestedAction: string;
  isMerchantRequest: boolean;
}

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type EmailCategory = 'merchant-request' | 'internal' | 'external' | 'automated' | 'newsletter';

// ─── Calendar (Outlook) ──────────────────────────────
export interface CalendarEvent {
  id: string;
  subject: string;
  start: Date;
  end: Date;
  location: string;
  isAllDay: boolean;
  organizer: string;
  attendees: string[];
  isOnline: boolean;
  onlineUrl: string;
  status: 'free' | 'tentative' | 'busy' | 'oof' | 'unknown';
  body: string;
}

// ─── Jira ────────────────────────────────────────────
export interface JiraIssue {
  key: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  assignee: string | null;
  reporter: string;
  created: Date;
  updated: Date;
  labels: string[];
  issueType: string;
  projectKey: string;
}

export interface TeamMember {
  name: string;
  jiraAccountId: string;
  slackUserId?: string;
  skills?: string[];
  currentLoad?: number;
}

export interface TriageResult {
  issue: JiraIssue;
  suggestedAssignee: TeamMember;
  reason: string;
  priority: Priority;
  isMerchantRequest: boolean;
}

// ─── Slack ───────────────────────────────────────────
export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: SlackBlock[];
  threadTs?: string;
}

export interface SlackBlock {
  type: 'section' | 'divider' | 'header' | 'context';
  text?: { type: 'mrkdwn' | 'plain_text'; text: string };
  fields?: Array<{ type: 'mrkdwn' | 'plain_text'; text: string }>;
}

export interface SlackChannelInfo {
  id: string;
  name: string;
  purpose: string;
}

// ─── Daily Briefing ──────────────────────────────────
export interface DailyBriefing {
  date: Date;
  unreadEmailCount: number;
  priorityEmails: EmailSummary[];
  openJiraIssues: JiraIssue[];
  merchantRequests: TriageResult[];
  todaysMeetings: CalendarEvent[];
  suggestedSchedule: TimeBlock[];
}

export interface TimeBlock {
  start: string; // HH:mm
  end: string;   // HH:mm
  activity: string;
  category: 'email' | 'jira' | 'meeting' | 'focus' | 'break' | 'slack';
  relatedItems?: string[];
}

// ─── Config ──────────────────────────────────────────
export interface VAConfig {
  jira: {
    host: string;
    email: string;
    apiToken: string;
    projectKey: string;
  };
  outlook: {
    clientId: string;
    tenantId: string;
    clientSecret: string;
    userEmail: string;
  };
  slack: {
    botToken: string;
    defaultChannel: string;
    triageChannel: string;
  };
  team: TeamMember[];
  schedule: {
    workStartHour: number;
    workEndHour: number;
    timezone: string;
  };
  preferences: {
    emailCheckIntervalMinutes: number;
    priorityKeywords: string[];
    merchantKeywords: string[];
  };
}

// ─── Plugin system ───────────────────────────────────
export interface PluginContext {
  config: VAConfig;
  log: (message: string) => void;
}

export interface VAPlugin {
  name: string;
  initialize(context: PluginContext): Promise<void>;
  shutdown?(): Promise<void>;
}
