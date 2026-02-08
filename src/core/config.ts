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
    const [name, jiraAccountId] = entry.trim().split(':');
    if (!name || !jiraAccountId) {
      throw new Error(`Invalid TEAM_MEMBERS format. Expected "Name:jiraId,Name2:jiraId2", got "${entry}"`);
    }
    return { name: name.trim(), jiraAccountId: jiraAccountId.trim() };
  });
}

export function loadConfig(): VAConfig {
  return {
    jira: {
      host: required('JIRA_HOST'),
      email: required('JIRA_EMAIL'),
      apiToken: required('JIRA_API_TOKEN'),
      projectKey: required('JIRA_PROJECT_KEY'),
    },
    gmail: {
      user: required('GMAIL_USER'),
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
