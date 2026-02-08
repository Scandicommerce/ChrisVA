import { Email, EmailSummary, EmailCategory, Priority, VAConfig } from '../core/types';

export class EmailTriageModule {
  private priorityKeywords: string[];
  private merchantKeywords: string[];
  private userEmail: string;

  constructor(private config: VAConfig) {
    this.priorityKeywords = config.preferences.priorityKeywords.map((k) => k.toLowerCase());
    this.merchantKeywords = config.preferences.merchantKeywords.map((k) => k.toLowerCase());
    this.userEmail = config.outlook.userEmail;
  }

  triageEmails(emails: Email[]): EmailSummary[] {
    return emails
      .map((email) => this.triageEmail(email))
      .sort((a, b) => {
        const priorityOrder: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  triageEmail(email: Email): EmailSummary {
    const searchText = `${email.subject} ${email.body} ${email.snippet}`.toLowerCase();
    const fromText = email.from.toLowerCase();

    // Only flag as merchant request if sender is external (not internal/automated)
    const isInternal = this.isInternalSender(fromText);
    const isAutomated = this.isAutomatedSender(fromText);
    const isMerchantRequest = !isInternal && !isAutomated &&
      this.merchantKeywords.some((kw) => searchText.includes(kw));

    const priority = this.assessPriority(searchText, fromText, email, isMerchantRequest);
    const category = this.categorize(email, isMerchantRequest);
    const actionRequired = this.needsAction(priority, category);
    const suggestedAction = this.suggestAction(priority, category, isMerchantRequest);

    return { email, priority, category, actionRequired, suggestedAction, isMerchantRequest };
  }

  private isInternalSender(from: string): boolean {
    const senderDomain = this.extractDomain(from);
    const myDomain = this.extractDomain(this.userEmail);
    return !!(senderDomain && myDomain && senderDomain === myDomain);
  }

  private isAutomatedSender(from: string): boolean {
    return (
      from.includes('noreply') || from.includes('no-reply') ||
      from.includes('notifications@') || from.includes('automated') ||
      from.includes('jira@') || from.includes('github.com') ||
      from.includes('atlassian.net') || from.includes('datadoghq.com') ||
      from.includes('alerts@') || from.includes('newsletter@')
    );
  }

  private assessPriority(text: string, from: string, email: Email, isMerchant: boolean): Priority {
    // Outlook importance flag overrides
    if (email.importance === 'high') {
      const hasCritical = this.priorityKeywords
        .filter((k) => ['critical', 'p0', 'production', 'blocker'].includes(k))
        .some((kw) => text.includes(kw));
      if (hasCritical) return 'critical';
      return 'high';
    }

    const hasCriticalKeyword = this.priorityKeywords
      .filter((k) => ['critical', 'p0', 'production', 'blocker'].includes(k))
      .some((kw) => text.includes(kw));
    if (hasCriticalKeyword) return 'critical';

    const hasUrgentKeyword = this.priorityKeywords.some((kw) => text.includes(kw));
    if (hasUrgentKeyword) return 'high';

    if (isMerchant) return 'high';

    if (from.includes('noreply') || from.includes('no-reply') || from.includes('notifications@')) {
      return 'low';
    }

    return 'medium';
  }

  private categorize(email: Email, isMerchant: boolean): EmailCategory {
    if (isMerchant) return 'merchant-request';

    const from = email.from.toLowerCase();
    const labels = email.labels.map((l) => l.toLowerCase());

    if (labels.includes('category_promotions') || labels.includes('category_updates')) {
      return 'newsletter';
    }

    if (
      from.includes('noreply') || from.includes('no-reply') ||
      from.includes('notifications@') || from.includes('automated') ||
      from.includes('jira@') || from.includes('github.com') ||
      from.includes('atlassian.net') || from.includes('datadoghq.com') ||
      from.includes('alerts@')
    ) {
      return 'automated';
    }

    const senderDomain = this.extractDomain(from);
    const myDomain = this.extractDomain(this.userEmail);
    if (senderDomain && myDomain && senderDomain === myDomain) {
      return 'internal';
    }

    return 'external';
  }

  private needsAction(priority: Priority, category: EmailCategory): boolean {
    if (category === 'newsletter') return false;
    if (category === 'automated') return priority === 'critical';
    if (priority === 'critical' || priority === 'high') return true;
    if (category === 'merchant-request') return true;
    return priority === 'medium';
  }

  private suggestAction(priority: Priority, category: EmailCategory, isMerchant: boolean): string {
    if (isMerchant && priority === 'critical') {
      return 'URGENT: Create Jira ticket and assign to available team member immediately';
    }
    if (isMerchant && priority === 'high') {
      return 'Create Jira ticket from merchant request and assign to team';
    }
    if (isMerchant) {
      return 'Review merchant request and create ticket during triage block';
    }
    if (priority === 'critical') {
      return 'Respond immediately — this is flagged as critical';
    }
    if (priority === 'high') {
      return 'Schedule response within the next hour';
    }
    if (category === 'internal') {
      return 'Review and respond during next email block';
    }
    if (category === 'automated') {
      return 'Check if action needed, otherwise archive';
    }
    if (category === 'newsletter') {
      return 'Archive or skim during low-priority block';
    }
    return 'Review during scheduled email time';
  }

  private extractDomain(email: string): string | null {
    const match = email.match(/@([a-zA-Z0-9.-]+)/);
    return match ? match[1].toLowerCase() : null;
  }

  getSummaryStats(summaries: EmailSummary[]): {
    total: number;
    byPriority: Record<Priority, number>;
    byCategory: Record<EmailCategory, number>;
    actionRequired: number;
    merchantRequests: number;
  } {
    const byPriority: Record<Priority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byCategory: Record<EmailCategory, number> = {
      'merchant-request': 0, internal: 0, external: 0, automated: 0, newsletter: 0,
    };
    let actionRequired = 0;
    let merchantRequests = 0;

    for (const s of summaries) {
      byPriority[s.priority]++;
      byCategory[s.category]++;
      if (s.actionRequired) actionRequired++;
      if (s.isMerchantRequest) merchantRequests++;
    }

    return { total: summaries.length, byPriority, byCategory, actionRequired, merchantRequests };
  }
}
