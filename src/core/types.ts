// ===== ChrisVA Core Types =====

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

export interface DailyBriefing {
  date: Date;
  unreadEmailCount: number;
  priorityEmails: EmailSummary[];
  openJiraIssues: JiraIssue[];
  merchantRequests: TriageResult[];
  suggestedSchedule: TimeBlock[];
}

export interface TimeBlock {
  start: string; // HH:mm
  end: string;   // HH:mm
  activity: string;
  category: 'email' | 'jira' | 'meeting' | 'focus' | 'break';
  relatedItems?: string[]; // email IDs or Jira keys
}

export interface VAConfig {
  jira: {
    host: string;
    email: string;
    apiToken: string;
    projectKey: string;
  };
  gmail: {
    user: string;
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

export interface PluginContext {
  config: VAConfig;
  log: (message: string) => void;
}

export interface VAPlugin {
  name: string;
  initialize(context: PluginContext): Promise<void>;
  shutdown?(): Promise<void>;
}
