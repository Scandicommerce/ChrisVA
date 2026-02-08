import { Email, EmailSummary, EmailCategory, Priority, VAConfig } from '../core/types';

export class EmailTriageModule {
  private priorityKeywords: string[];
  private merchantKeywords: string[];

  constructor(private config: VAConfig) {
    this.priorityKeywords = config.preferences.priorityKeywords.map((k) => k.toLowerCase());
    this.merchantKeywords = config.preferences.merchantKeywords.map((k) => k.toLowerCase());
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

    const isMerchantRequest = this.merchantKeywords.some((kw) => searchText.includes(kw));
    const priority = this.assessPriority(searchText, fromText, isMerchantRequest);
    const category = this.categorize(email, isMerchantRequest);
    const actionRequired = this.needsAction(priority, category, email);
    const suggestedAction = this.suggestAction(priority, category, isMerchantRequest, email);

    return {
      email,
      priority,
      category,
      actionRequired,
      suggestedAction,
      isMerchantRequest,
    };
  }

  private assessPriority(text: string, from: string, isMerchant: boolean): Priority {
    const hasCriticalKeyword = this.priorityKeywords
      .filter((k) => ['critical', 'p0', 'production', 'blocker'].includes(k))
      .some((kw) => text.includes(kw));

    if (hasCriticalKeyword) return 'critical';

    const hasUrgentKeyword = this.priorityKeywords.some((kw) => text.includes(kw));
    if (hasUrgentKeyword) return 'high';

    if (isMerchant) return 'high';

    // Noreply / automated senders are low priority
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
      from.includes('noreply') ||
      from.includes('no-reply') ||
      from.includes('notifications@') ||
      from.includes('automated') ||
      from.includes('jira@') ||
      from.includes('github.com')
    ) {
      return 'automated';
    }

    // Check if from same domain (internal)
    const senderDomain = this.extractDomain(from);
    const myDomain = this.extractDomain(this.config.gmail.user);
    if (senderDomain && myDomain && senderDomain === myDomain) {
      return 'internal';
    }

    return 'external';
  }

  private needsAction(priority: Priority, category: EmailCategory, _email: Email): boolean {
    if (category === 'newsletter' || category === 'automated') return false;
    if (priority === 'critical' || priority === 'high') return true;
    if (category === 'merchant-request') return true;
    return priority === 'medium';
  }

  private suggestAction(
    priority: Priority,
    category: EmailCategory,
    isMerchant: boolean,
    _email: Email
  ): string {
    if (isMerchant && priority === 'critical') {
      return 'URGENT: Create Jira ticket and assign to available team member immediately';
    }
    if (isMerchant) {
      return 'Create Jira ticket from merchant request and assign to team';
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
    if (category === 'newsletter' || category === 'automated') {
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
      'merchant-request': 0,
      internal: 0,
      external: 0,
      automated: 0,
      newsletter: 0,
    };
    let actionRequired = 0;
    let merchantRequests = 0;

    for (const s of summaries) {
      byPriority[s.priority]++;
      byCategory[s.category]++;
      if (s.actionRequired) actionRequired++;
      if (s.isMerchantRequest) merchantRequests++;
    }

    return {
      total: summaries.length,
      byPriority,
      byCategory,
      actionRequired,
      merchantRequests,
    };
  }
}
