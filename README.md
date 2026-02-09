# ChrisVA

Personal virtual assistant for Outlook email/calendar triage, Jira task management, Slack notifications, and workday planning.

## Quick start

```bash
npm install && npm run build

# See the demo (no credentials needed)
npm run demo

# Or set up your real accounts with the guided wizard
npm run setup
```

## What it does

- **Outlook email triage** — Fetches unread mail via Microsoft Graph API, classifies by priority and category (merchant request, internal, external, automated, newsletter), suggests actions
- **Outlook calendar** — Pulls today's meetings and builds your schedule around them
- **Jira triage** — Fetches unassigned issues, detects merchant requests, suggests team assignments using skill-matching and load-balanced round-robin
- **Slack notifications** — Posts triage results to a channel, DMs assignees, shares daily briefing summaries
- **Workday scheduling** — Generates a structured daily schedule with time blocks for email, meetings, Jira triage, deep focus, Slack catch-up, and breaks
- **Interactive assignment** — Walk through unassigned tickets one by one and assign to your team with Slack notifications

## Setup

The easiest way to configure everything is the interactive wizard:

```bash
npm run setup
```

It walks you through each service step by step, tells you exactly where to go, what to click, and what to copy. It writes your `.env` file at the end.

### Where to get each API key

| Service | Where to go | What you need |
|---------|-------------|---------------|
| **Outlook** | [Azure Portal > App registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) | Register an app, get Client ID + Tenant ID + Client Secret. Grant `Mail.Read` and `Calendars.Read` permissions. |
| **Jira** | [Atlassian API tokens](https://id.atlassian.com/manage-profile/security/api-tokens) | Click "Create API token", copy it. You also need your Atlassian URL and project key. |
| **Slack** | [Slack API > Your Apps](https://api.slack.com/apps) | Create an app, add bot scopes (`chat:write`, `conversations:list`, `conversations:open`, `users:read`), install to workspace, copy Bot Token. |

### Manual setup (alternative)

```bash
cp .env.example .env
# Fill in the values — see .env.example for all variables
```

## Usage

### Quick shortcuts (npm run)

```bash
npm run demo        # Full demo with simulated data
npm run setup       # Interactive setup wizard
npm run briefing    # Morning briefing
npm run emails      # Triage inbox
npm run calendar    # Today's meetings
npm run triage      # Jira triage + assignments
npm run schedule    # Optimized day plan
npm run status      # Quick dashboard
```

### Full commands (npx)

```bash
# Full demo with simulated data
npx chrisva demo

# Interactive setup — get all API keys configured
npx chrisva setup

# Morning briefing — emails, calendar, issues, schedule
npx chrisva briefing

# Triage unread Outlook emails by priority
npx chrisva emails

# Show today's calendar with Teams links
npx chrisva calendar

# Triage unassigned Jira issues
npx chrisva triage

# Triage + interactively assign + Slack notify
npx chrisva triage --assign --notify

# Assign a specific issue with Slack DM
npx chrisva assign SC-123 Alice --notify

# Generate today's optimized schedule
npx chrisva schedule

# Quick status dashboard
npx chrisva status

# Any command works in demo mode too
npx chrisva emails --demo
npx chrisva calendar --demo
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
  setup/
    wizard.ts            — Interactive setup wizard
  demo/
    mock-data.ts         — Realistic mock data for demo mode
  utils/
    display.ts           — Terminal formatting helpers
  cli.ts                 — Commander-based CLI entry point
  index.ts               — Library exports
```
