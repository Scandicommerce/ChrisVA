import * as dotenv from 'dotenv';
import { VAConfig, TeamMember } from './types';

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function parseTeamMembers(raw: string): TeamMember[] {
  if (!raw) return [];
  return raw.split(',').map((entry) => {
    const parts = entry.trim().split(':');
    if (parts.length < 2) {
      throw new Error(`Invalid TEAM_MEMBERS format. Expected "Name:jiraId" or "Name:jiraId:slackId", got "${entry}"`);
    }
    return {
      name: parts[0].trim(),
      jiraAccountId: parts[1].trim(),
      slackUserId: parts[2]?.trim() || undefined,
    };
  });
}

export function loadConfig(): VAConfig {
  return {
    jira: {
      host: required('JIRA_HOST'),
      email: required('JIRA_EMAIL'),
      apiToken: required('JIRA_API_TOKEN'),
      projectKey: optional('JIRA_PROJECT_KEY', ''),
    },
    outlook: {
      clientId: required('OUTLOOK_CLIENT_ID'),
      tenantId: required('OUTLOOK_TENANT_ID'),
      clientSecret: required('OUTLOOK_CLIENT_SECRET'),
      userEmail: required('OUTLOOK_USER_EMAIL'),
    },
    slack: {
      botToken: required('SLACK_BOT_TOKEN'),
      defaultChannel: optional('SLACK_DEFAULT_CHANNEL', 'general'),
      triageChannel: optional('SLACK_TRIAGE_CHANNEL', 'merchant-triage'),
    },
    team: parseTeamMembers(optional('TEAM_MEMBERS', '')),
    schedule: {
      workStartHour: parseInt(optional('WORK_START_HOUR', '9'), 10),
      workEndHour: parseInt(optional('WORK_END_HOUR', '17'), 10),
      timezone: optional('TIMEZONE', 'Europe/Amsterdam'),
    },
    preferences: {
      emailCheckIntervalMinutes: parseInt(optional('EMAIL_CHECK_INTERVAL_MINUTES', '15'), 10),
      priorityKeywords: optional('PRIORITY_KEYWORDS', 'urgent,critical,blocker,asap,p0,production').split(','),
      merchantKeywords: optional('MERCHANT_KEYWORDS', 'merchant,store,shop,commerce,order,payment').split(','),
    },
  };
}

/** Config loader for demo mode — no env vars required */
export function loadDemoConfig(): VAConfig {
  return {
    jira: { host: 'https://scandicommerce.atlassian.net', email: 'chris@scandicommerce.com', apiToken: 'demo', projectKey: 'SC' },
    outlook: { clientId: 'demo', tenantId: 'demo', clientSecret: 'demo', userEmail: 'chris@scandicommerce.com' },
    slack: { botToken: 'demo', defaultChannel: 'general', triageChannel: 'merchant-triage' },
    team: [
      { name: 'Alice', jiraAccountId: 'alice-001', slackUserId: 'U_ALICE', skills: ['frontend', 'checkout', 'react'], currentLoad: 3 },
      { name: 'Bob', jiraAccountId: 'bob-002', slackUserId: 'U_BOB', skills: ['backend', 'api', 'payments', 'integrations'], currentLoad: 2 },
      { name: 'Carol', jiraAccountId: 'carol-003', slackUserId: 'U_CAROL', skills: ['devops', 'infrastructure', 'monitoring', 'ci'], currentLoad: 4 },
      { name: 'Dave', jiraAccountId: 'dave-004', slackUserId: 'U_DAVE', skills: ['backend', 'catalog', 'search', 'performance'], currentLoad: 1 },
      { name: 'Eve', jiraAccountId: 'eve-005', slackUserId: 'U_EVE', skills: ['frontend', 'ux', 'accessibility', 'design-system'], currentLoad: 2 },
    ],
    schedule: { workStartHour: 9, workEndHour: 17, timezone: 'Europe/Amsterdam' },
    preferences: {
      emailCheckIntervalMinutes: 15,
      priorityKeywords: ['urgent', 'critical', 'blocker', 'asap', 'p0', 'production'],
      merchantKeywords: ['merchant', 'our store', 'our shop', 'my store', 'my shop', 'order issue', 'payment issue', 'checkout issue', 'storefront'],
    },
  };
}
