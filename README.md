# ChrisVA

Personal virtual assistant for email triage, Jira task management, and workday planning.

## What it does

- **Email triage** — Fetches unread Gmail, classifies by priority and category (merchant request, internal, external, automated), and suggests actions
- **Jira triage** — Pulls unassigned issues, detects merchant requests, and suggests team assignments using load-balanced round-robin
- **Workday scheduling** — Generates a structured daily schedule with time blocks for email, deep work, Jira triage, and breaks
- **Interactive assignment** — Walk through unassigned tickets one by one and assign to your team

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your `.env`:

| Variable | Description |
|----------|-------------|
| `JIRA_HOST` | Your Atlassian URL (e.g., `https://your-org.atlassian.net`) |
| `JIRA_EMAIL` | Your Jira email |
| `JIRA_API_TOKEN` | [Create an API token](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_PROJECT_KEY` | Project key (e.g., `PROJ`) |
| `GMAIL_USER` | Your Gmail address |
| `TEAM_MEMBERS` | Comma-separated `Name:jiraAccountId` pairs |

### 3. Gmail OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Desktop application)
3. Download the JSON and save as `credentials.json` in the project root
4. On first run, a browser window will open for authorization

### 4. Build

```bash
npm run build
```

## Usage

```bash
# Morning briefing — emails, issues, and a suggested schedule
npx chrisva briefing

# Triage unread emails by priority
npx chrisva emails

# Triage unassigned Jira issues with team assignment suggestions
npx chrisva triage

# Triage and interactively assign to team members
npx chrisva triage --assign

# Assign a specific issue directly
npx chrisva assign PROJ-123 Alice

# Generate today's schedule
npx chrisva schedule

# Quick status check
npx chrisva status
```

## Project structure

```
src/
  core/
    types.ts       — All TypeScript interfaces
    config.ts      — Environment config loader
    engine.ts      — Plugin-based VA engine
  integrations/
    gmail.ts       — Gmail API client (OAuth2)
    jira.ts        — Jira REST API client
  modules/
    email-triage.ts — Email classification and prioritization
    jira-triage.ts  — Issue triage and team assignment logic
    scheduler.ts    — Daily schedule builder
  utils/
    display.ts     — Terminal formatting helpers
  cli.ts           — Commander-based CLI entry point
  index.ts         — Library exports
```

## Extending

The engine supports plugins. Create a class implementing `VAPlugin` and register it:

```typescript
import { VAEngine, loadConfig } from 'chrisva';

const engine = new VAEngine(loadConfig());
engine.registerPlugin(myCustomPlugin);
await engine.initialize();
```
