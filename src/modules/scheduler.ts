import dayjs from 'dayjs';
import {
  DailyBriefing, EmailSummary, JiraIssue, TriageResult,
  CalendarEvent, TimeBlock, VAConfig,
} from '../core/types';

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
    triageResults: TriageResult[],
    calendarEvents: CalendarEvent[] = []
  ): DailyBriefing {
    const priorityEmails = emailSummaries.filter((e) => e.actionRequired);
    const merchantRequests = triageResults.filter((t) => t.isMerchantRequest);
    const schedule = this.buildSchedule(priorityEmails, openIssues, merchantRequests, calendarEvents);

    return {
      date: new Date(),
      unreadEmailCount: emailSummaries.filter((e) => !e.email.isRead).length,
      priorityEmails,
      openJiraIssues: openIssues,
      merchantRequests,
      todaysMeetings: calendarEvents,
      suggestedSchedule: schedule,
    };
  }

  private buildSchedule(
    priorityEmails: EmailSummary[],
    openIssues: JiraIssue[],
    merchantRequests: TriageResult[],
    meetings: CalendarEvent[]
  ): TimeBlock[] {
    const blocks: TimeBlock[] = [];

    // Add meetings as fixed blocks first
    const meetingBlocks: TimeBlock[] = meetings
      .filter((m) => !m.isAllDay)
      .map((m) => ({
        start: dayjs(m.start).format('HH:mm'),
        end: dayjs(m.end).format('HH:mm'),
        activity: m.subject + (m.isOnline ? ' (online)' : m.location ? ` @ ${m.location}` : ''),
        category: 'meeting' as const,
        relatedItems: [m.id],
      }));

    // Build work blocks around meetings
    let currentMinute = this.startHour * 60;
    const endMinute = this.endHour * 60;

    // Sort meetings by start time
    const sortedMeetings = [...meetingBlocks].sort((a, b) => this.toMinutes(a.start) - this.toMinutes(b.start));

    // Morning briefing
    blocks.push({
      start: this.fmtMin(currentMinute),
      end: this.fmtMin(currentMinute + 15),
      activity: 'Morning briefing — review ChrisVA dashboard, plan the day',
      category: 'email',
    });
    currentMinute += 15;

    // Critical merchant requests first
    const criticalMerchant = merchantRequests.filter((t) => t.priority === 'critical' || t.priority === 'high');
    if (criticalMerchant.length > 0) {
      const nextMeeting = this.nextMeetingAfter(sortedMeetings, currentMinute);
      const available = nextMeeting ? nextMeeting - currentMinute : 60;
      const duration = Math.min(available, 60);

      blocks.push({
        start: this.fmtMin(currentMinute),
        end: this.fmtMin(currentMinute + duration),
        activity: `Handle ${criticalMerchant.length} urgent merchant request(s) — triage and assign`,
        category: 'jira',
        relatedItems: criticalMerchant.map((t) => t.issue.key),
      });
      currentMinute += duration;
    }

    // Interleave meetings with work blocks
    for (const meeting of sortedMeetings) {
      const meetingStart = this.toMinutes(meeting.start);
      const meetingEnd = this.toMinutes(meeting.end);

      // Fill gap before meeting with productive work
      if (meetingStart > currentMinute + 15) {
        const gapDuration = meetingStart - currentMinute;
        blocks.push(this.fillGap(currentMinute, gapDuration, priorityEmails, openIssues, merchantRequests));
      }

      // Add the meeting
      blocks.push(meeting);
      currentMinute = meetingEnd;
    }

    // Fill remaining time after last meeting
    if (currentMinute < endMinute - 60) {
      // Afternoon email check
      const criticalEmails = priorityEmails.filter((e) => e.priority === 'critical' || e.priority === 'high');
      if (criticalEmails.length > 0) {
        blocks.push({
          start: this.fmtMin(currentMinute),
          end: this.fmtMin(currentMinute + 30),
          activity: `Respond to ${criticalEmails.length} high-priority email(s)`,
          category: 'email',
          relatedItems: criticalEmails.slice(0, 5).map((e) => e.email.id),
        });
        currentMinute += 30;
      }

      // Remaining Jira triage
      const remainingTriage = merchantRequests.filter((t) => t.priority === 'medium' || t.priority === 'low');
      if (remainingTriage.length > 0 && currentMinute < endMinute - 90) {
        blocks.push({
          start: this.fmtMin(currentMinute),
          end: this.fmtMin(currentMinute + 30),
          activity: `Triage ${remainingTriage.length} remaining ticket(s) and assign`,
          category: 'jira',
          relatedItems: remainingTriage.map((t) => t.issue.key),
        });
        currentMinute += 30;
      }

      // Focus block
      const myIssues = openIssues.filter((i) => i.status !== 'Done');
      if (myIssues.length > 0 && currentMinute < endMinute - 60) {
        const focusEnd = Math.min(currentMinute + 120, endMinute - 30);
        blocks.push({
          start: this.fmtMin(currentMinute),
          end: this.fmtMin(focusEnd),
          activity: `Deep focus — ${myIssues.length} open issue(s) to progress`,
          category: 'focus',
          relatedItems: myIssues.slice(0, 5).map((i) => i.key),
        });
        currentMinute = focusEnd;
      }

      // Slack catch-up
      blocks.push({
        start: this.fmtMin(currentMinute),
        end: this.fmtMin(currentMinute + 15),
        activity: 'Slack catch-up — respond to team messages and threads',
        category: 'slack',
      });
      currentMinute += 15;
    }

    // End of day wrap-up
    blocks.push({
      start: this.fmtMin(endMinute - 30),
      end: this.fmtMin(endMinute),
      activity: 'End-of-day wrap-up — update tickets, prep tomorrow, post Slack summary',
      category: 'jira',
    });

    return blocks;
  }

  private fillGap(
    startMin: number,
    duration: number,
    emails: EmailSummary[],
    issues: JiraIssue[],
    _triage: TriageResult[]
  ): TimeBlock {
    if (duration >= 90) {
      return {
        start: this.fmtMin(startMin),
        end: this.fmtMin(startMin + duration),
        activity: `Deep focus block — work on ${issues.length} open issue(s)`,
        category: 'focus',
        relatedItems: issues.slice(0, 3).map((i) => i.key),
      };
    }
    if (duration >= 45) {
      const mediumEmails = emails.filter((e) => e.priority === 'medium');
      return {
        start: this.fmtMin(startMin),
        end: this.fmtMin(startMin + duration),
        activity: mediumEmails.length > 0
          ? `Process ${mediumEmails.length} email(s) and review Slack`
          : 'Email + Slack catch-up',
        category: 'email',
      };
    }
    return {
      start: this.fmtMin(startMin),
      end: this.fmtMin(startMin + duration),
      activity: 'Quick break / buffer time',
      category: 'break',
    };
  }

  private nextMeetingAfter(meetings: TimeBlock[], afterMinute: number): number | null {
    for (const m of meetings) {
      const mStart = this.toMinutes(m.start);
      if (mStart > afterMinute) return mStart;
    }
    return null;
  }

  private toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private fmtMin(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(Math.round(m)).padStart(2, '0')}`;
  }

  formatBriefing(briefing: DailyBriefing): string {
    const lines: string[] = [];
    const dateStr = dayjs(briefing.date).format('dddd, MMMM D, YYYY');

    lines.push('');
    lines.push(`  DAILY BRIEFING — ${dateStr}`);
    lines.push('  ' + '='.repeat(56));
    lines.push('');

    // Overview
    lines.push('  OVERVIEW');
    lines.push(`    Unread emails:           ${briefing.unreadEmailCount}`);
    lines.push(`    Emails needing action:   ${briefing.priorityEmails.length}`);
    lines.push(`    Open Jira issues:        ${briefing.openJiraIssues.length}`);
    lines.push(`    Meetings today:          ${briefing.todaysMeetings.length}`);
    lines.push(`    Merchant requests:       ${briefing.merchantRequests.length}`);
    lines.push('');

    // Meetings
    if (briefing.todaysMeetings.length > 0) {
      lines.push('  MEETINGS');
      for (const m of briefing.todaysMeetings) {
        const start = dayjs(m.start).format('HH:mm');
        const end = dayjs(m.end).format('HH:mm');
        const loc = m.isOnline ? '(online)' : m.location ? `@ ${m.location}` : '';
        lines.push(`    ${start}–${end}  ${m.subject} ${loc}`);
      }
      lines.push('');
    }

    // Priority emails
    if (briefing.priorityEmails.length > 0) {
      lines.push('  PRIORITY EMAILS');
      for (const es of briefing.priorityEmails.slice(0, 10)) {
        const icon = es.priority === 'critical' ? '!!!' : es.priority === 'high' ? ' !!' : '  !';
        const tag = es.isMerchantRequest ? ' [MERCHANT]' : '';
        lines.push(`    [${icon}] ${es.email.subject}${tag}`);
        lines.push(`          From: ${es.email.from}`);
        lines.push(`          Action: ${es.suggestedAction}`);
      }
      lines.push('');
    }

    // Merchant requests
    if (briefing.merchantRequests.length > 0) {
      lines.push('  MERCHANT REQUESTS TO ASSIGN');
      for (const tr of briefing.merchantRequests) {
        lines.push(`    ${tr.issue.key}: ${tr.issue.summary}`);
        lines.push(`          Assign to: ${tr.suggestedAssignee.name}`);
        lines.push(`          Reason: ${tr.reason}`);
      }
      lines.push('');
    }

    // Schedule
    lines.push('  SUGGESTED SCHEDULE');
    for (const block of briefing.suggestedSchedule) {
      const icon =
        block.category === 'email'   ? '[E]' :
        block.category === 'jira'    ? '[J]' :
        block.category === 'focus'   ? '[F]' :
        block.category === 'meeting' ? '[M]' :
        block.category === 'slack'   ? '[S]' :
        '[~]';
      lines.push(`    ${block.start}–${block.end}  ${icon} ${block.activity}`);
      if (block.relatedItems?.length) {
        lines.push(`                     ${block.relatedItems.join(', ')}`);
      }
    }
    lines.push('');

    return lines.join('\n');
  }
}
