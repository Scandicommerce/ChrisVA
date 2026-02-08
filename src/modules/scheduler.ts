import dayjs from 'dayjs';
import { DailyBriefing, EmailSummary, JiraIssue, TriageResult, TimeBlock, VAConfig } from '../core/types';

export class SchedulerModule {
  private startHour: number;
  private endHour: number;

  constructor(private config: VAConfig) {
    this.startHour = config.schedule.workStartHour;
    this.endHour = config.schedule.workEndHour;
  }

  generateBriefing(
    emailSummaries: EmailSummary[],
    openIssues: JiraIssue[],
    triageResults: TriageResult[]
  ): DailyBriefing {
    const priorityEmails = emailSummaries.filter((e) => e.actionRequired);
    const merchantRequests = triageResults.filter((t) => t.isMerchantRequest);
    const schedule = this.buildSchedule(priorityEmails, openIssues, merchantRequests);

    return {
      date: new Date(),
      unreadEmailCount: emailSummaries.filter((e) => !e.email.isRead).length,
      priorityEmails,
      openJiraIssues: openIssues,
      merchantRequests,
      suggestedSchedule: schedule,
    };
  }

  private buildSchedule(
    priorityEmails: EmailSummary[],
    openIssues: JiraIssue[],
    merchantRequests: TriageResult[]
  ): TimeBlock[] {
    const blocks: TimeBlock[] = [];
    let currentHour = this.startHour;

    // Block 1: Morning briefing & critical items
    blocks.push({
      start: this.fmt(currentHour, 0),
      end: this.fmt(currentHour, 30),
      activity: 'Morning briefing — review priorities and plan the day',
      category: 'email',
      relatedItems: [],
    });
    currentHour = this.advance(currentHour, 30);

    // Block 2: Critical merchant requests (if any)
    const criticalMerchant = merchantRequests.filter((t) => t.priority === 'critical' || t.priority === 'high');
    if (criticalMerchant.length > 0) {
      blocks.push({
        start: this.fmt(currentHour, 0),
        end: this.fmt(currentHour + 1, 0),
        activity: `Handle ${criticalMerchant.length} urgent merchant request(s) — triage and assign to team`,
        category: 'jira',
        relatedItems: criticalMerchant.map((t) => t.issue.key),
      });
      currentHour += 1;
    }

    // Block 3: Priority emails
    const criticalEmails = priorityEmails.filter(
      (e) => e.priority === 'critical' || e.priority === 'high'
    );
    if (criticalEmails.length > 0) {
      blocks.push({
        start: this.fmt(currentHour, 0),
        end: this.fmt(currentHour, 45),
        activity: `Respond to ${criticalEmails.length} high-priority email(s)`,
        category: 'email',
        relatedItems: criticalEmails.map((e) => e.email.id),
      });
      currentHour = this.advance(currentHour, 45);
    }

    // Block 4: Deep focus work (Jira issues)
    const myIssues = openIssues.filter((i) => i.status !== 'Done');
    if (myIssues.length > 0) {
      const focusEnd = Math.min(currentHour + 2, 12); // Focus until lunch or 2h max
      blocks.push({
        start: this.fmt(currentHour, 0),
        end: this.fmt(focusEnd, 0),
        activity: `Deep work — ${myIssues.length} open issue(s) to progress`,
        category: 'focus',
        relatedItems: myIssues.slice(0, 5).map((i) => i.key),
      });
      currentHour = focusEnd;
    }

    // Lunch break
    if (currentHour <= 12) {
      blocks.push({
        start: this.fmt(12, 0),
        end: this.fmt(13, 0),
        activity: 'Lunch break',
        category: 'break',
      });
      currentHour = 13;
    }

    // Afternoon: remaining emails
    const mediumEmails = priorityEmails.filter((e) => e.priority === 'medium');
    if (mediumEmails.length > 0) {
      blocks.push({
        start: this.fmt(currentHour, 0),
        end: this.fmt(currentHour, 45),
        activity: `Process ${mediumEmails.length} remaining email(s)`,
        category: 'email',
        relatedItems: mediumEmails.map((e) => e.email.id),
      });
      currentHour = this.advance(currentHour, 45);
    }

    // Afternoon: remaining Jira triage
    const remainingTriage = merchantRequests.filter(
      (t) => t.priority === 'medium' || t.priority === 'low'
    );
    if (remainingTriage.length > 0) {
      blocks.push({
        start: this.fmt(currentHour, 0),
        end: this.fmt(currentHour + 1, 0),
        activity: `Triage ${remainingTriage.length} remaining ticket(s) and assign to team`,
        category: 'jira',
        relatedItems: remainingTriage.map((t) => t.issue.key),
      });
      currentHour += 1;
    }

    // Focus block in afternoon
    if (currentHour < this.endHour - 1) {
      blocks.push({
        start: this.fmt(currentHour, 0),
        end: this.fmt(this.endHour - 1, 0),
        activity: 'Afternoon focus block — continue deep work on issues',
        category: 'focus',
      });
      currentHour = this.endHour - 1;
    }

    // End of day wrap-up
    blocks.push({
      start: this.fmt(this.endHour - 1, 0),
      end: this.fmt(this.endHour, 0),
      activity: 'End-of-day wrap-up — update ticket statuses, prep tomorrow',
      category: 'jira',
    });

    return blocks;
  }

  private fmt(hour: number, minute: number): string {
    return dayjs().hour(hour).minute(minute).format('HH:mm');
  }

  private advance(hour: number, minutes: number): number {
    return hour + minutes / 60;
  }

  formatBriefing(briefing: DailyBriefing): string {
    const lines: string[] = [];
    const dateStr = dayjs(briefing.date).format('dddd, MMMM D, YYYY');

    lines.push('');
    lines.push(`  DAILY BRIEFING — ${dateStr}`);
    lines.push('  ' + '='.repeat(50));
    lines.push('');

    // Overview
    lines.push('  OVERVIEW');
    lines.push(`    Unread emails: ${briefing.unreadEmailCount}`);
    lines.push(`    Emails needing action: ${briefing.priorityEmails.length}`);
    lines.push(`    Open Jira issues: ${briefing.openJiraIssues.length}`);
    lines.push(`    Merchant requests to triage: ${briefing.merchantRequests.length}`);
    lines.push('');

    // Priority emails
    if (briefing.priorityEmails.length > 0) {
      lines.push('  PRIORITY EMAILS');
      for (const es of briefing.priorityEmails.slice(0, 10)) {
        const icon = es.priority === 'critical' ? '!!!' : es.priority === 'high' ? '!!' : '!';
        const tag = es.isMerchantRequest ? ' [MERCHANT]' : '';
        lines.push(`    [${icon}] ${es.email.subject}${tag}`);
        lines.push(`        From: ${es.email.from}`);
        lines.push(`        Action: ${es.suggestedAction}`);
      }
      lines.push('');
    }

    // Merchant requests
    if (briefing.merchantRequests.length > 0) {
      lines.push('  MERCHANT REQUESTS TO ASSIGN');
      for (const tr of briefing.merchantRequests) {
        lines.push(`    ${tr.issue.key}: ${tr.issue.summary}`);
        lines.push(`        Suggested assignee: ${tr.suggestedAssignee.name}`);
        lines.push(`        Reason: ${tr.reason}`);
      }
      lines.push('');
    }

    // Schedule
    lines.push('  SUGGESTED SCHEDULE');
    for (const block of briefing.suggestedSchedule) {
      const icon =
        block.category === 'email' ? '[E]' :
        block.category === 'jira' ? '[J]' :
        block.category === 'focus' ? '[F]' :
        block.category === 'meeting' ? '[M]' :
        '[~]';
      lines.push(`    ${block.start}–${block.end}  ${icon} ${block.activity}`);
    }
    lines.push('');

    return lines.join('\n');
  }
}
