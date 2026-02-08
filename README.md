# ChrisVA

Personal virtual assistant for Outlook email/calendar triage, Jira task management, Slack notifications, and workday planning.

## Quick start — Demo mode

No credentials needed. See how ChrisVA handles a realistic Scandicommerce workday:

```bash
npm install && npm run build
npx chrisva demo
```

## What it does

- **Outlook email triage** — Fetches unread Outlook mail via Microsoft Graph API, classifies by priority (critical/high/medium/low) and category (merchant request, internal, external, automated, newsletter), suggests actions
- **Outlook calendar** — Pulls today's meetings and builds your schedule around them
- **Jira triage** — Fetches unassigned issues, detects merchant requests, suggests team assignments using skill-matching and load-balanced round-robin
- **Slack notifications** — Posts triage results to a channel, DMs assignees, shares daily briefing summaries
- **Workday scheduling** — Generates a structured daily schedule with time blocks for email, meetings, Jira triage, deep focus, Slack catch-up, and breaks
- **Interactive assignment** — Walk through unassigned tickets one by one and assign to your team with Slack notifications

## Setup (production mode)

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Fill in your `.env`:

| Variable | Description |
|----------|-------------|
| `OUTLOOK_CLIENT_ID` | Azure AD App registration client ID |
| `OUTLOOK_TENANT_ID` | Azure AD tenant ID |
| `OUTLOOK_CLIENT_SECRET` | Azure AD app client secret |
| `OUTLOOK_USER_EMAIL` | Your Outlook email |
| `JIRA_HOST` | Your Atlassian URL (e.g., `https://your-org.atlassian.net`) |
| `JIRA_EMAIL` | Your Jira email |
| `JIRA_API_TOKEN` | [Create an API token](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_PROJECT_KEY` | Project key (e.g., `SC`) |
| `SLACK_BOT_TOKEN` | Slack Bot token (`xoxb-...`) |
| `SLACK_DEFAULT_CHANNEL` | Channel for daily briefings |
| `SLACK_TRIAGE_CHANNEL` | Channel for triage notifications |
| `TEAM_MEMBERS` | `Name:jiraAccountId:slackUserId` (comma-separated) |

### 3. Outlook setup

1. Go to [Azure Portal > App registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Register a new application
3. Add API permissions: `Mail.Read`, `Calendars.Read`
4. Create a client secret
5. Copy Client ID, Tenant ID, and Secret to `.env`

### 4. Slack setup

1. Go to [Slack API > Your Apps](https://api.slack.com/apps)
2. Create a new app, add Bot Token Scopes: `chat:write`, `conversations:list`, `conversations:open`, `users:read`
3. Install to workspace and copy the Bot Token to `.env`

### 5. Build

```bash
npm run build
```

## Usage

```bash
# Full demo with simulated data
npx chrisva demo

# Morning briefing — emails, calendar, issues, and a structured schedule
npx chrisva briefing

# Triage unread Outlook emails by priority
npx chrisva emails

# Show today's calendar
npx chrisva calendar

# Triage unassigned Jira issues with team assignment suggestions
npx chrisva triage

# Triage and interactively assign + Slack notify
npx chrisva triage --assign --notify

# Assign a specific issue with Slack DM
npx chrisva assign SC-123 Alice --notify

# Generate today's optimized schedule
npx chrisva schedule

# Quick status dashboard
npx chrisva status

# Any command works in demo mode
npx chrisva emails --demo
npx chrisva triage --demo
```

## Project structure

```
src/
  core/
    types.ts             — All TypeScript interfaces
    config.ts            — Environment + demo config loader
    engine.ts            — Plugin-based VA engine
  integrations/
    outlook-mail.ts      — Outlook Mail via Microsoft Graph API
    outlook-calendar.ts  — Outlook Calendar via Microsoft Graph API
    jira.ts              — Jira REST API client
    slack.ts             — Slack Bot API client
  modules/
    email-triage.ts      — Email classification and prioritization
    jira-triage.ts       — Issue triage and team assignment logic
    scheduler.ts         — Calendar-aware daily schedule builder
  demo/
    mock-data.ts         — Realistic mock data for demo mode
  utils/
    display.ts           — Terminal formatting helpers
  cli.ts                 — Commander-based CLI entry point
  index.ts               — Library exports
```

## Extending

The engine supports plugins. Create a class implementing `VAPlugin` and register it:

```typescript
import { VAEngine, loadConfig } from 'chrisva';

const engine = new VAEngine(loadConfig());
engine.registerPlugin(myCustomPlugin);
await engine.initialize();
```
