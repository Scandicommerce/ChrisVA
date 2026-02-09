import express from 'express';
import { loadConfig, loadDemoConfig } from './core/config';
import { OutlookMailClient } from './integrations/outlook-mail';
import { OutlookCalendarClient } from './integrations/outlook-calendar';
import { JiraClient } from './integrations/jira';
import { EmailTriageModule } from './modules/email-triage';
import { JiraTriageModule } from './modules/jira-triage';
import { SchedulerModule } from './modules/scheduler';
import { mockEmails, mockCalendarEvents, mockMyIssues, mockUnassignedIssues } from './demo/mock-data';
import { getDashboardHTML } from './dashboard/html';
import { VAConfig, Email, CalendarEvent, JiraIssue } from './core/types';

const isDemo = process.argv.includes('--demo');
const port = parseInt(process.env.PORT || '3000', 10);

async function main(): Promise<void> {
  const config: VAConfig = isDemo ? loadDemoConfig() : loadConfig();
  const app = express();

  // Integration clients (live mode only)
  let mailClient: OutlookMailClient | null = null;
  let calendarClient: OutlookCalendarClient | null = null;
  let jiraClient: JiraClient | null = null;

  if (!isDemo) {
    mailClient = new OutlookMailClient(config.outlook);
    calendarClient = new OutlookCalendarClient(config.outlook);
    jiraClient = new JiraClient(config.jira);
  }

  // Processing modules
  const emailTriage = new EmailTriageModule(config);
  const jiraTriage = new JiraTriageModule(config);
  const scheduler = new SchedulerModule(config);

  // ── Fetch all data and build briefing ─────────────────
  async function fetchBriefingData() {
    let emails: Email[];
    let events: CalendarEvent[];
    let myIssues: JiraIssue[];
    let unassignedIssues: JiraIssue[];

    if (isDemo) {
      emails = mockEmails;
      events = mockCalendarEvents;
      myIssues = mockMyIssues;
      unassignedIssues = mockUnassignedIssues;
    } else {
      // Authorize both Outlook clients
      await Promise.all([
        mailClient!.authorize(),
        calendarClient!.authorize(),
      ]);

      // Fetch data in parallel
      [emails, events, myIssues, unassignedIssues] = await Promise.all([
        mailClient!.getRecentEmails(24),
        calendarClient!.getTodaysEvents(),
        jiraClient!.getMyOpenIssues(),
        jiraClient!.getUnassignedIssues(),
      ]);
    }

    const emailSummaries = emailTriage.triageEmails(emails);
    const triageResults = jiraTriage.triageIssues(unassignedIssues, config.team);
    const briefing = scheduler.generateBriefing(emailSummaries, myIssues, triageResults, events);

    return briefing;
  }

  // ── Routes ────────────────────────────────────────────

  // Dashboard HTML
  app.get('/', (_req, res) => {
    res.type('html').send(getDashboardHTML(isDemo));
  });

  // Full briefing API
  app.get('/api/briefing', async (_req, res) => {
    try {
      const briefing = await fetchBriefingData();
      res.json({
        ...briefing,
        lastRefresh: new Date().toISOString(),
        isDemo,
      });
    } catch (err) {
      console.error('Briefing API error:', (err as Error).message);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ── Start server ──────────────────────────────────────
  app.listen(port, () => {
    console.log('');
    console.log('  ╔═══════════════════════════════════════════════╗');
    console.log('  ║          ChrisVA Dashboard Running            ║');
    console.log('  ╠═══════════════════════════════════════════════╣');
    console.log(`  ║  Open:  http://localhost:${port}                    ║`);
    console.log(`  ║  Mode:  ${isDemo ? 'DEMO (mock data)' : 'LIVE (real APIs) '}                    ║`);
    console.log('  ║  Auto-refresh: every 5 minutes                ║');
    console.log('  ╚═══════════════════════════════════════════════╝');
    console.log('');
    if (isDemo) {
      console.log('  Running in demo mode — no API credentials needed.');
      console.log('  Showing realistic Scandicommerce sample data.');
    } else {
      console.log('  Connected to Outlook, Jira, and Slack.');
    }
    console.log('');
  });
}

main().catch((err) => {
  console.error('Failed to start dashboard:', err.message);
  process.exit(1);
});
