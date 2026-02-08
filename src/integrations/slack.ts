import fetch from 'node-fetch';
import { SlackMessage, SlackBlock, SlackChannelInfo, TriageResult, DailyBriefing, VAConfig } from '../core/types';

/**
 * Slack Bot API client.
 * Uses Bot Token (xoxb-...) for posting messages, reading channels, notifying team.
 */
export class SlackClient {
  private baseUrl = 'https://slack.com/api';

  constructor(private config: VAConfig['slack']) {}

  private async request(method: string, body: Record<string, unknown> = {}): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as { ok: boolean; error?: string; [key: string]: unknown };
    if (!data.ok) {
      throw new Error(`Slack API error (${method}): ${data.error}`);
    }
    return data;
  }

  async postMessage(message: SlackMessage): Promise<string> {
    const payload: Record<string, unknown> = {
      channel: message.channel,
      text: message.text,
    };
    if (message.blocks) payload.blocks = message.blocks;
    if (message.threadTs) payload.thread_ts = message.threadTs;

    const data = (await this.request('chat.postMessage', payload)) as { ts: string };
    return data.ts;
  }

  async sendDirectMessage(userId: string, text: string): Promise<string> {
    const conv = (await this.request('conversations.open', { users: userId })) as {
      channel: { id: string };
    };
    return this.postMessage({ channel: conv.channel.id, text });
  }

  async listChannels(): Promise<SlackChannelInfo[]> {
    const data = (await this.request('conversations.list', {
      types: 'public_channel,private_channel',
      limit: 200,
    })) as { channels: Array<{ id: string; name: string; purpose: { value: string } }> };

    return data.channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      purpose: ch.purpose.value,
    }));
  }

  // ─── High-level helpers ────────────────────────────

  async postTriageNotification(result: TriageResult): Promise<string> {
    const priorityEmoji = {
      critical: ':rotating_light:',
      high: ':warning:',
      medium: ':large_blue_circle:',
      low: ':white_circle:',
    }[result.priority];

    const merchantTag = result.isMerchantRequest ? ' :shopping_trolley: *MERCHANT REQUEST*' : '';
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${result.issue.key}: ${result.issue.summary}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Priority:* ${priorityEmoji} ${result.priority}${merchantTag}` },
          { type: 'mrkdwn', text: `*Assigned to:* <@${result.suggestedAssignee.slackUserId || result.suggestedAssignee.name}>` },
          { type: 'mrkdwn', text: `*Reason:* ${result.reason}` },
          { type: 'mrkdwn', text: `*Status:* ${result.issue.status}` },
        ],
      },
    ];

    return this.postMessage({
      channel: this.config.triageChannel,
      text: `[${result.priority.toUpperCase()}] ${result.issue.key} assigned to ${result.suggestedAssignee.name}`,
      blocks,
    });
  }

  async postBriefingSummary(briefing: DailyBriefing): Promise<string> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: ':sunrise: Daily Briefing' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Unread emails:* ${briefing.unreadEmailCount}` },
          { type: 'mrkdwn', text: `*Priority emails:* ${briefing.priorityEmails.length}` },
          { type: 'mrkdwn', text: `*Open Jira issues:* ${briefing.openJiraIssues.length}` },
          { type: 'mrkdwn', text: `*Meetings today:* ${briefing.todaysMeetings.length}` },
          { type: 'mrkdwn', text: `*Merchant requests:* ${briefing.merchantRequests.length}` },
        ],
      },
      { type: 'divider' },
    ];

    if (briefing.todaysMeetings.length > 0) {
      const meetingList = briefing.todaysMeetings
        .map((m) => {
          const start = m.start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          const end = m.end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          return `  ${start}–${end}  ${m.subject}`;
        })
        .join('\n');

      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*:calendar: Today's Meetings*\n\`\`\`${meetingList}\`\`\`` },
      });
    }

    return this.postMessage({
      channel: this.config.defaultChannel,
      text: `Daily Briefing: ${briefing.unreadEmailCount} emails, ${briefing.openJiraIssues.length} issues, ${briefing.todaysMeetings.length} meetings`,
      blocks,
    });
  }

  async notifyAssignment(member: { slackUserId?: string; name: string }, issueKey: string, summary: string): Promise<void> {
    if (!member.slackUserId) return;
    await this.sendDirectMessage(
      member.slackUserId,
      `:ticket: *${issueKey}* has been assigned to you: ${summary}`
    );
  }
}
