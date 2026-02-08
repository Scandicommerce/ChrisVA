#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { loadConfig, loadDemoConfig } from './core/config';
import { OutlookMailClient } from './integrations/outlook-mail';
import { OutlookCalendarClient } from './integrations/outlook-calendar';
import { JiraClient } from './integrations/jira';
import { SlackClient } from './integrations/slack';
import { EmailTriageModule } from './modules/email-triage';
import { JiraTriageModule } from './modules/jira-triage';
import { SchedulerModule } from './modules/scheduler';
import { mockEmails, mockCalendarEvents, mockMyIssues, mockUnassignedIssues } from './demo/mock-data';
import { banner, header, subHeader, priorityBadge, categoryBadge, truncate } from './utils/display';
import { VAConfig, TriageResult, Email, CalendarEvent, JiraIssue } from './core/types';
import dayjs from 'dayjs';

const program = new Command();

program
  .name('chrisva')
  .description('ChrisVA — Your virtual assistant for Outlook, Jira, Slack, and workday management')
  .version('0.2.0')
  .option('--demo', 'Run in demo mode with simulated data (no credentials needed)');

function isDemo(): boolean {
  return process.argv.includes('--demo');
}

function getConfig(): VAConfig {
  return isDemo() ? loadDemoConfig() : loadConfig();
}

// ─── demo ────────────────────────────────────────────
program
  .command('demo')
  .description('Full demo run — see how ChrisVA handles a typical workday')
  .action(async () => {
    const config = loadDemoConfig();

    console.log(banner());
    console.log(chalk.yellow('  Running in DEMO MODE with simulated Scandicommerce data\n'));

    const spinner = ora('Loading your daily briefing...').start();
    await sleep(800);

    const emailTriage = new EmailTriageModule(config);
    const jiraTriage = new JiraTriageModule(config);
    const scheduler = new SchedulerModule(config);

    spinner.text = 'Connecting to Outlook...';
    await sleep(500);

    spinner.text = 'Fetching calendar...';
    await sleep(400);

    spinner.text = 'Fetching Jira issues...';
    await sleep(400);

    spinner.text = 'Checking Slack...';
    await sleep(300);

    spinner.text = 'Analyzing and triaging...';
    await sleep(500);

    const emailSummaries = emailTriage.triageEmails(mockEmails);
    const triageResults = jiraTriage.triageIssues(mockUnassignedIssues, config.team);
    const briefing = scheduler.generateBriefing(emailSummaries, mockMyIssues, triageResults, mockCalendarEvents);

    spinner.stop();

    // Full briefing
    console.log(scheduler.formatBriefing(briefing));

    // Separator
    console.log(chalk.cyan('─'.repeat(60)));
    console.log(chalk.bold.white('  DETAILED EMAIL TRIAGE'));
    console.log(chalk.cyan('─'.repeat(60)));

    const stats = emailTriage.getSummaryStats(emailSummaries);
    console.log(`\n  ${stats.total} emails analyzed:`);
    console.log(`  ${chalk.red(String(stats.byPriority.critical))} critical  ${chalk.yellow(String(stats.byPriority.high))} high  ${chalk.blue(String(stats.byPriority.medium))} medium  ${chalk.gray(String(stats.byPriority.low))} low`);
    console.log(`  ${chalk.magenta(String(stats.merchantRequests))} merchant requests  |  ${stats.actionRequired} need action\n`);

    for (const summary of emailSummaries) {
      console.log(`  ${priorityBadge(summary.priority)} ${categoryBadge(summary.category)}`);
      console.log(`  ${chalk.bold(truncate(summary.email.subject, 70))}`);
      console.log(`  ${chalk.gray('From:')} ${summary.email.from}`);
      if (summary.email.hasAttachments) console.log(`  ${chalk.gray('Attachments:')} Yes`);
      console.log(`  ${chalk.gray('Action:')} ${summary.suggestedAction}`);
      console.log('');
    }

    // Jira triage detail
    console.log(chalk.cyan('─'.repeat(60)));
    console.log(chalk.bold.white('  JIRA TRIAGE — TEAM ASSIGNMENTS'));
    console.log(chalk.cyan('─'.repeat(60)));

    const triageStats = jiraTriage.getTriageStats(triageResults);
    console.log(`\n  ${triageStats.total} issues to assign:`);
    console.log(`  ${chalk.magenta(String(triageStats.merchantRequests))} merchant request(s)\n`);

    console.log(`  ${chalk.gray('Assignments by team member:')}`);
    for (const [name, count] of Object.entries(triageStats.byAssignee)) {
      const bar = chalk.cyan('\u2588'.repeat(count * 3));
      console.log(`    ${name.padEnd(10)} ${bar} ${count}`);
    }
    console.log('');

    for (const r of triageResults) {
      const merchantTag = r.isMerchantRequest ? chalk.magenta(' [MERCHANT]') : '';
      console.log(`  ${priorityBadge(r.priority)} ${chalk.bold(r.issue.key)}: ${truncate(r.issue.summary, 55)}${merchantTag}`);
      console.log(`    ${chalk.gray('Assign to:')} ${chalk.cyan.bold(r.suggestedAssignee.name)}`);
      console.log(`    ${chalk.gray('Reason:')} ${r.reason}`);
      console.log('');
    }

    // Calendar detail
    console.log(chalk.cyan('─'.repeat(60)));
    console.log(chalk.bold.white('  TODAY\'S CALENDAR'));
    console.log(chalk.cyan('─'.repeat(60)));
    console.log('');

    for (const evt of mockCalendarEvents) {
      const start = dayjs(evt.start).format('HH:mm');
      const end = dayjs(evt.end).format('HH:mm');
      const online = evt.isOnline ? chalk.green(' [Teams]') : '';
      const loc = evt.location ? chalk.gray(` @ ${evt.location}`) : '';
      console.log(`  ${chalk.bold(`${start}–${end}`)}  ${evt.subject}${online}${loc}`);
      if (evt.attendees.length > 0) {
        console.log(`    ${chalk.gray('With:')} ${evt.attendees.slice(0, 4).map((a) => a.split('@')[0]).join(', ')}`);
      }
    }
    console.log('');

    // Slack preview
    console.log(chalk.cyan('─'.repeat(60)));
    console.log(chalk.bold.white('  SLACK NOTIFICATIONS (would be sent)'));
    console.log(chalk.cyan('─'.repeat(60)));
    console.log('');

    console.log(`  ${chalk.gray('#merchant-triage')}`);
    for (const r of triageResults.filter((t) => t.isMerchantRequest)) {
      const emoji = r.priority === 'critical' ? '!!!' : r.priority === 'high' ? ' !!' : '  !';
      console.log(`    [${emoji}] ${r.issue.key} assigned to @${r.suggestedAssignee.name.toLowerCase()}: ${truncate(r.issue.summary, 50)}`);
    }
    console.log('');
    console.log(`  ${chalk.gray('#general')}`);
    console.log(`    Daily Briefing: ${briefing.unreadEmailCount} emails, ${briefing.openJiraIssues.length} issues, ${briefing.todaysMeetings.length} meetings`);
    console.log('');

    console.log(chalk.green.bold('  Demo complete! To connect your real accounts, run:'));
    console.log(chalk.white('    1. cp .env.example .env'));
    console.log(chalk.white('    2. Fill in your Outlook, Jira, and Slack credentials'));
    console.log(chalk.white('    3. npx chrisva briefing'));
    console.log('');
  });

// ─── briefing ────────────────────────────────────────
program
  .command('briefing')
  .description('Get your daily morning briefing')
  .action(async () => {
    console.log(banner());

    if (isDemo()) {
      // Delegate to demo command logic with mock data
      const config = loadDemoConfig();
      const emailTriage = new EmailTriageModule(config);
      const jiraTriage = new JiraTriageModule(config);
      const scheduler = new SchedulerModule(config);

      const emailSummaries = emailTriage.triageEmails(mockEmails);
      const triageResults = jiraTriage.triageIssues(mockUnassignedIssues, config.team);
      const briefing = scheduler.generateBriefing(emailSummaries, mockMyIssues, triageResults, mockCalendarEvents);
      console.log(scheduler.formatBriefing(briefing));
      return;
    }

    const spinner = ora('Loading your daily briefing...').start();

    try {
      const config = getConfig();
      const outlook = new OutlookMailClient(config.outlook);
      const calendar = new OutlookCalendarClient(config.outlook);
      const jira = new JiraClient(config.jira);
      const emailTriage = new EmailTriageModule(config);
      const jiraTriage = new JiraTriageModule(config);
      const scheduler = new SchedulerModule(config);

      spinner.text = 'Connecting to Outlook...';
      await outlook.authorize();
      await calendar.authorize();

      const [emails, events, myIssues, unassigned] = await Promise.all([
        outlook.getUnreadEmails(),
        calendar.getTodaysEvents(),
        jira.getMyOpenIssues(),
        jira.getUnassignedIssues(),
      ]);

      spinner.text = 'Analyzing...';
      const emailSummaries = emailTriage.triageEmails(emails);
      const triageResults = jiraTriage.triageIssues(unassigned, config.team);
      const briefing = scheduler.generateBriefing(emailSummaries, myIssues, triageResults, events);

      spinner.stop();
      console.log(scheduler.formatBriefing(briefing));
    } catch (err) {
      spinner.fail((err as Error).message);
      process.exit(1);
    }
  });

// ─── emails ──────────────────────────────────────────
program
  .command('emails')
  .description('Triage and summarize unread emails')
  .option('-n, --count <number>', 'Number of emails to fetch', '20')
  .action(async (opts) => {
    const spinner = ora('Fetching emails...').start();

    try {
      const config = getConfig();
      const emailTriage = new EmailTriageModule(config);

      let emails: Email[];
      if (isDemo()) {
        await sleep(500);
        emails = mockEmails;
      } else {
        const outlook = new OutlookMailClient(config.outlook);
        await outlook.authorize();
        emails = await outlook.getUnreadEmails(parseInt(opts.count, 10));
      }

      const summaries = emailTriage.triageEmails(emails);
      const stats = emailTriage.getSummaryStats(summaries);

      spinner.stop();

      console.log(header('EMAIL TRIAGE'));
      console.log(`\n  ${stats.total} unread emails analyzed`);
      console.log(`  ${chalk.red(String(stats.byPriority.critical))} critical  ${chalk.yellow(String(stats.byPriority.high))} high  ${chalk.blue(String(stats.byPriority.medium))} medium  ${chalk.gray(String(stats.byPriority.low))} low`);
      console.log(`  ${chalk.magenta(String(stats.merchantRequests))} merchant requests  |  ${stats.actionRequired} need action\n`);

      for (const summary of summaries) {
        console.log(`  ${priorityBadge(summary.priority)} ${categoryBadge(summary.category)}`);
        console.log(`  ${chalk.bold(truncate(summary.email.subject, 70))}`);
        console.log(`  ${chalk.gray('From:')} ${summary.email.from}`);
        console.log(`  ${chalk.gray('Action:')} ${summary.suggestedAction}`);
        console.log('');
      }
    } catch (err) {
      spinner.fail((err as Error).message);
      process.exit(1);
    }
  });

// ─── calendar ────────────────────────────────────────
program
  .command('calendar')
  .description('Show today\'s calendar with meeting details')
  .action(async () => {
    const spinner = ora('Fetching calendar...').start();

    try {
      const config = getConfig();

      let events: CalendarEvent[];
      if (isDemo()) {
        await sleep(400);
        events = mockCalendarEvents;
      } else {
        const calendar = new OutlookCalendarClient(config.outlook);
        await calendar.authorize();
        events = await calendar.getTodaysEvents();
      }

      spinner.stop();

      console.log(header('TODAY\'S CALENDAR'));
      if (events.length === 0) {
        console.log('\n  No meetings today — full focus day!\n');
        return;
      }

      console.log(`\n  ${events.length} meeting(s) today\n`);

      for (const evt of events) {
        const start = dayjs(evt.start).format('HH:mm');
        const end = dayjs(evt.end).format('HH:mm');
        const online = evt.isOnline ? chalk.green(' [Teams]') : '';
        const loc = evt.location ? chalk.gray(` @ ${evt.location}`) : '';

        console.log(`  ${chalk.bold(`${start}–${end}`)}  ${evt.subject}${online}${loc}`);
        if (evt.attendees.length > 0) {
          console.log(`    ${chalk.gray('With:')} ${evt.attendees.map((a) => a.split('@')[0]).join(', ')}`);
        }
        if (evt.isOnline && evt.onlineUrl) {
          console.log(`    ${chalk.gray('Join:')} ${chalk.cyan(evt.onlineUrl)}`);
        }
        console.log('');
      }
    } catch (err) {
      spinner.fail((err as Error).message);
      process.exit(1);
    }
  });

// ─── triage ──────────────────────────────────────────
program
  .command('triage')
  .description('Triage unassigned Jira issues and suggest team assignments')
  .option('--assign', 'Interactively assign issues after triage')
  .option('--notify', 'Send Slack notifications for assignments')
  .action(async (opts) => {
    const spinner = ora('Fetching unassigned Jira issues...').start();

    try {
      const config = getConfig();
      const jiraTriage = new JiraTriageModule(config);

      let unassigned: JiraIssue[];
      if (isDemo()) {
        await sleep(500);
        unassigned = mockUnassignedIssues;
      } else {
        const jira = new JiraClient(config.jira);
        unassigned = await jira.getUnassignedIssues();
      }

      const results = jiraTriage.triageIssues(unassigned, config.team);
      const stats = jiraTriage.getTriageStats(results);

      spinner.stop();

      console.log(header('JIRA TRIAGE'));
      console.log(`\n  ${stats.total} unassigned issue(s)`);
      console.log(`  ${chalk.magenta(String(stats.merchantRequests))} merchant request(s)\n`);

      console.log(`  ${chalk.gray('Assignments by team member:')}`);
      for (const [name, count] of Object.entries(stats.byAssignee)) {
        const bar = chalk.cyan('\u2588'.repeat(count * 3));
        console.log(`    ${name.padEnd(10)} ${bar} ${count}`);
      }
      console.log('');

      for (const r of results) {
        const merchantTag = r.isMerchantRequest ? chalk.magenta(' [MERCHANT]') : '';
        console.log(`  ${priorityBadge(r.priority)} ${chalk.bold(r.issue.key)}: ${truncate(r.issue.summary, 55)}${merchantTag}`);
        console.log(`    ${chalk.gray('Assign to:')} ${chalk.cyan.bold(r.suggestedAssignee.name)}`);
        console.log(`    ${chalk.gray('Reason:')} ${r.reason}`);
        console.log('');
      }

      if (!isDemo() && opts.assign && results.length > 0) {
        const jira = new JiraClient(config.jira);
        const slack = opts.notify ? new SlackClient(config.slack) : null;
        await interactiveAssign(jira, slack, results, config);
      }
    } catch (err) {
      spinner.fail((err as Error).message);
      process.exit(1);
    }
  });

// ─── assign ──────────────────────────────────────────
program
  .command('assign <issueKey> <teamMemberName>')
  .description('Assign a Jira issue to a team member')
  .option('--notify', 'Send Slack DM to the assignee')
  .action(async (issueKey: string, memberName: string, opts) => {
    if (isDemo()) {
      console.log(chalk.yellow(`[DEMO] Would assign ${issueKey} to ${memberName}`));
      return;
    }

    const spinner = ora(`Assigning ${issueKey}...`).start();

    try {
      const config = getConfig();
      const jira = new JiraClient(config.jira);

      const member = config.team.find((m) => m.name.toLowerCase() === memberName.toLowerCase());
      if (!member) {
        spinner.fail(`Team member "${memberName}" not found. Available: ${config.team.map((m) => m.name).join(', ')}`);
        process.exit(1);
      }

      await jira.assignIssue(issueKey, member.jiraAccountId);
      spinner.succeed(`${issueKey} assigned to ${member.name}`);

      if (opts.notify && member.slackUserId) {
        const slack = new SlackClient(config.slack);
        await slack.notifyAssignment(member, issueKey, '');
        console.log(chalk.gray(`  Slack DM sent to ${member.name}`));
      }
    } catch (err) {
      spinner.fail((err as Error).message);
      process.exit(1);
    }
  });

// ─── schedule ────────────────────────────────────────
program
  .command('schedule')
  .description('Generate a suggested schedule for today')
  .action(async () => {
    const spinner = ora('Building your schedule...').start();

    try {
      const config = getConfig();
      const emailTriage = new EmailTriageModule(config);
      const jiraTriage = new JiraTriageModule(config);
      const scheduler = new SchedulerModule(config);

      let emails: Email[], events: CalendarEvent[], myIssues: JiraIssue[], unassigned: JiraIssue[];

      if (isDemo()) {
        await sleep(500);
        emails = mockEmails;
        events = mockCalendarEvents;
        myIssues = mockMyIssues;
        unassigned = mockUnassignedIssues;
      } else {
        const outlook = new OutlookMailClient(config.outlook);
        const calendar = new OutlookCalendarClient(config.outlook);
        const jira = new JiraClient(config.jira);

        await outlook.authorize();
        await calendar.authorize();

        [emails, events, myIssues, unassigned] = await Promise.all([
          outlook.getUnreadEmails(),
          calendar.getTodaysEvents(),
          jira.getMyOpenIssues(),
          jira.getUnassignedIssues(),
        ]);
      }

      const emailSummaries = emailTriage.triageEmails(emails);
      const triageResults = jiraTriage.triageIssues(unassigned, config.team);
      const briefing = scheduler.generateBriefing(emailSummaries, myIssues, triageResults, events);

      spinner.stop();

      console.log(header('TODAY\'S SCHEDULE'));
      for (const block of briefing.suggestedSchedule) {
        const icon =
          block.category === 'email'   ? chalk.yellow('[E]') :
          block.category === 'jira'    ? chalk.blue('[J]') :
          block.category === 'focus'   ? chalk.green('[F]') :
          block.category === 'meeting' ? chalk.magenta('[M]') :
          block.category === 'slack'   ? chalk.hex('#4A154B')('[S]') :
          chalk.gray('[~]');

        console.log(`\n  ${chalk.bold(`${block.start}–${block.end}`)}  ${icon} ${block.activity}`);
        if (block.relatedItems?.length) {
          console.log(`  ${chalk.gray('  Related:')} ${block.relatedItems.join(', ')}`);
        }
      }
      console.log('');
    } catch (err) {
      spinner.fail((err as Error).message);
      process.exit(1);
    }
  });

// ─── status ──────────────────────────────────────────
program
  .command('status')
  .description('Quick status check — emails, issues, meetings at a glance')
  .action(async () => {
    const spinner = ora('Checking status...').start();

    try {
      const config = getConfig();

      let emails: Email[], events: CalendarEvent[], myIssues: JiraIssue[], unassigned: JiraIssue[];

      if (isDemo()) {
        await sleep(400);
        emails = mockEmails;
        events = mockCalendarEvents;
        myIssues = mockMyIssues;
        unassigned = mockUnassignedIssues;
      } else {
        const outlook = new OutlookMailClient(config.outlook);
        const calendar = new OutlookCalendarClient(config.outlook);
        const jira = new JiraClient(config.jira);

        await outlook.authorize();
        await calendar.authorize();

        [emails, events, myIssues, unassigned] = await Promise.all([
          outlook.getUnreadEmails(100),
          calendar.getTodaysEvents(),
          jira.getMyOpenIssues(),
          jira.getUnassignedIssues(),
        ]);
      }

      spinner.stop();

      console.log(header('STATUS'));
      console.log(`\n  ${chalk.bold('Unread emails:')}      ${emails.filter((e) => !e.isRead).length}`);
      console.log(`  ${chalk.bold('Meetings today:')}     ${events.length}`);
      console.log(`  ${chalk.bold('My Jira issues:')}     ${myIssues.length} open`);
      console.log(`  ${chalk.bold('Unassigned issues:')}  ${unassigned.length} in queue`);

      // Next meeting
      const now = new Date();
      const upcoming = events.filter((e) => e.start > now);
      if (upcoming.length > 0) {
        const next = upcoming[0];
        const inMin = Math.round((next.start.getTime() - now.getTime()) / 60000);
        console.log(`\n  ${chalk.bold('Next meeting:')} ${next.subject} in ${inMin}min`);
      }

      if (myIssues.length > 0) {
        console.log(subHeader('Your Top Issues'));
        for (const issue of myIssues.slice(0, 5)) {
          console.log(`    ${chalk.cyan(issue.key)} ${issue.summary} ${chalk.gray(`[${issue.status}]`)}`);
        }
      }
      console.log('');
    } catch (err) {
      spinner.fail((err as Error).message);
      process.exit(1);
    }
  });

// ─── helpers ─────────────────────────────────────────
async function interactiveAssign(
  jira: JiraClient,
  slack: SlackClient | null,
  results: TriageResult[],
  config: VAConfig
): Promise<void> {
  console.log(subHeader('Interactive Assignment'));

  for (const r of results) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `${r.issue.key}: ${truncate(r.issue.summary, 50)} -> ${r.suggestedAssignee.name}?`,
        choices: [
          { name: `Assign to ${r.suggestedAssignee.name} (suggested)`, value: 'accept' },
          ...config.team
            .filter((m) => m.jiraAccountId !== r.suggestedAssignee.jiraAccountId)
            .map((m) => ({ name: `Assign to ${m.name}`, value: m.jiraAccountId })),
          { name: 'Skip', value: 'skip' },
        ],
      },
    ]);

    if (action === 'skip') {
      console.log(chalk.gray(`  Skipped ${r.issue.key}`));
      continue;
    }

    const assigneeId = action === 'accept' ? r.suggestedAssignee.jiraAccountId : action;
    const member = action === 'accept'
      ? r.suggestedAssignee
      : config.team.find((m) => m.jiraAccountId === assigneeId) || r.suggestedAssignee;

    const assignSpinner = ora(`Assigning ${r.issue.key} to ${member.name}...`).start();
    try {
      await jira.assignIssue(r.issue.key, assigneeId);
      assignSpinner.succeed(`${r.issue.key} -> ${member.name}`);

      if (slack) {
        await slack.postTriageNotification({ ...r, suggestedAssignee: member });
        if (member.slackUserId) {
          await slack.notifyAssignment(member, r.issue.key, r.issue.summary);
        }
      }
    } catch (err) {
      assignSpinner.fail(`Failed: ${(err as Error).message}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

program.parse();
