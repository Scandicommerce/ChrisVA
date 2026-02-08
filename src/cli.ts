#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { loadConfig } from './core/config';
import { VAEngine } from './core/engine';
import { GmailClient } from './integrations/gmail';
import { JiraClient } from './integrations/jira';
import { EmailTriageModule } from './modules/email-triage';
import { JiraTriageModule } from './modules/jira-triage';
import { SchedulerModule } from './modules/scheduler';
import { banner, header, subHeader, priorityBadge, categoryBadge, truncate } from './utils/display';
import { VAConfig, TriageResult } from './core/types';

const program = new Command();

program
  .name('chrisva')
  .description('ChrisVA — Your virtual assistant for email, Jira, and workday management')
  .version('0.1.0');

// ─── briefing ────────────────────────────────────────
program
  .command('briefing')
  .description('Get your daily morning briefing')
  .action(async () => {
    console.log(banner());
    const spinner = ora('Loading your daily briefing...').start();

    try {
      const config = loadConfig();
      const gmail = new GmailClient();
      const jira = new JiraClient(config.jira);
      const emailTriage = new EmailTriageModule(config);
      const jiraTriage = new JiraTriageModule(config);
      const scheduler = new SchedulerModule(config);

      // Fetch data
      spinner.text = 'Connecting to Gmail...';
      await gmail.authorize();
      const emails = await gmail.getUnreadEmails();

      spinner.text = 'Fetching Jira issues...';
      const [myIssues, unassigned] = await Promise.all([
        jira.getMyOpenIssues(),
        jira.getUnassignedIssues(),
      ]);

      spinner.text = 'Analyzing...';
      const emailSummaries = emailTriage.triageEmails(emails);
      const triageResults = jiraTriage.triageIssues(unassigned, config.team);
      const briefing = scheduler.generateBriefing(emailSummaries, myIssues, triageResults);

      spinner.stop();

      // Display briefing
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
      const config = loadConfig();
      const gmail = new GmailClient();
      const emailTriage = new EmailTriageModule(config);

      await gmail.authorize();
      const emails = await gmail.getUnreadEmails(parseInt(opts.count, 10));
      const summaries = emailTriage.triageEmails(emails);
      const stats = emailTriage.getSummaryStats(summaries);

      spinner.stop();

      console.log(header('EMAIL TRIAGE'));
      console.log(`\n  ${stats.total} unread emails analyzed`);
      console.log(`  ${chalk.red(String(stats.byPriority.critical))} critical  ${chalk.yellow(String(stats.byPriority.high))} high  ${chalk.blue(String(stats.byPriority.medium))} medium  ${chalk.gray(String(stats.byPriority.low))} low`);
      console.log(`  ${chalk.magenta(String(stats.merchantRequests))} merchant requests`);

      for (const summary of summaries) {
        console.log(`\n  ${priorityBadge(summary.priority)} ${categoryBadge(summary.category)}`);
        console.log(`  ${chalk.bold(truncate(summary.email.subject, 70))}`);
        console.log(`  ${chalk.gray('From:')} ${summary.email.from}`);
        console.log(`  ${chalk.gray('Action:')} ${summary.suggestedAction}`);
      }
      console.log('');
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
  .action(async (opts) => {
    const spinner = ora('Fetching unassigned Jira issues...').start();

    try {
      const config = loadConfig();
      const jira = new JiraClient(config.jira);
      const jiraTriage = new JiraTriageModule(config);

      const unassigned = await jira.getUnassignedIssues();
      const results = jiraTriage.triageIssues(unassigned, config.team);
      const stats = jiraTriage.getTriageStats(results);

      spinner.stop();

      console.log(header('JIRA TRIAGE'));
      console.log(`\n  ${stats.total} unassigned issue(s)`);
      console.log(`  ${chalk.magenta(String(stats.merchantRequests))} merchant request(s)\n`);

      for (const r of results) {
        console.log(`  ${priorityBadge(r.priority)} ${chalk.bold(r.issue.key)}: ${truncate(r.issue.summary, 60)}`);
        console.log(`    ${chalk.gray('Suggested:')} ${chalk.cyan(r.suggestedAssignee.name)}`);
        console.log(`    ${chalk.gray('Reason:')} ${r.reason}`);
        console.log('');
      }

      if (opts.assign && results.length > 0) {
        await interactiveAssign(jira, results, config);
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
  .action(async (issueKey: string, memberName: string) => {
    const spinner = ora(`Assigning ${issueKey}...`).start();

    try {
      const config = loadConfig();
      const jira = new JiraClient(config.jira);

      const member = config.team.find(
        (m) => m.name.toLowerCase() === memberName.toLowerCase()
      );
      if (!member) {
        spinner.fail(`Team member "${memberName}" not found. Available: ${config.team.map((m) => m.name).join(', ')}`);
        process.exit(1);
      }

      await jira.assignIssue(issueKey, member.jiraAccountId);
      spinner.succeed(`${issueKey} assigned to ${member.name}`);
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
      const config = loadConfig();
      const gmail = new GmailClient();
      const jira = new JiraClient(config.jira);
      const emailTriage = new EmailTriageModule(config);
      const jiraTriage = new JiraTriageModule(config);
      const scheduler = new SchedulerModule(config);

      await gmail.authorize();
      const emails = await gmail.getUnreadEmails();
      const [myIssues, unassigned] = await Promise.all([
        jira.getMyOpenIssues(),
        jira.getUnassignedIssues(),
      ]);

      const emailSummaries = emailTriage.triageEmails(emails);
      const triageResults = jiraTriage.triageIssues(unassigned, config.team);
      const briefing = scheduler.generateBriefing(emailSummaries, myIssues, triageResults);

      spinner.stop();

      console.log(header('TODAY\'S SCHEDULE'));
      for (const block of briefing.suggestedSchedule) {
        const icon =
          block.category === 'email' ? chalk.yellow('[E]') :
          block.category === 'jira' ? chalk.blue('[J]') :
          block.category === 'focus' ? chalk.green('[F]') :
          block.category === 'meeting' ? chalk.magenta('[M]') :
          chalk.gray('[~]');

        console.log(`\n  ${chalk.bold(`${block.start}–${block.end}`)}  ${icon} ${block.activity}`);
        if (block.relatedItems?.length) {
          console.log(`  ${chalk.gray('Related:')} ${block.relatedItems.join(', ')}`);
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
  .description('Quick status check — your open issues and unread count')
  .action(async () => {
    const spinner = ora('Checking status...').start();

    try {
      const config = loadConfig();
      const gmail = new GmailClient();
      const jira = new JiraClient(config.jira);

      await gmail.authorize();
      const emails = await gmail.getUnreadEmails(100);

      const myIssues = await jira.getMyOpenIssues();
      const unassigned = await jira.getUnassignedIssues();

      spinner.stop();

      console.log(header('STATUS'));
      console.log(`\n  ${chalk.bold('Emails:')} ${emails.length} unread`);
      console.log(`  ${chalk.bold('My Jira issues:')} ${myIssues.length} open`);
      console.log(`  ${chalk.bold('Unassigned issues:')} ${unassigned.length} in queue`);

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

// ─── interactive assign helper ───────────────────────
async function interactiveAssign(
  jira: JiraClient,
  results: TriageResult[],
  config: VAConfig
): Promise<void> {
  console.log(subHeader('Interactive Assignment'));

  for (const r of results) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `${r.issue.key}: ${truncate(r.issue.summary, 50)} → ${r.suggestedAssignee.name}?`,
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
    const assigneeName = action === 'accept'
      ? r.suggestedAssignee.name
      : config.team.find((m) => m.jiraAccountId === assigneeId)?.name || assigneeId;

    const assignSpinner = ora(`Assigning ${r.issue.key} to ${assigneeName}...`).start();
    try {
      await jira.assignIssue(r.issue.key, assigneeId);
      assignSpinner.succeed(`${r.issue.key} → ${assigneeName}`);
    } catch (err) {
      assignSpinner.fail(`Failed: ${(err as Error).message}`);
    }
  }
}

program.parse();
