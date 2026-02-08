import { JiraIssue, TeamMember, TriageResult, Priority, VAConfig } from '../core/types';

export class JiraTriageModule {
  private merchantKeywords: string[];

  constructor(private config: VAConfig) {
    this.merchantKeywords = config.preferences.merchantKeywords.map((k) => k.toLowerCase());
  }

  triageIssues(issues: JiraIssue[], team: TeamMember[]): TriageResult[] {
    // Track assignment counts for load balancing within this batch
    const assignmentCounts = new Map<string, number>();
    for (const member of team) {
      assignmentCounts.set(member.jiraAccountId, member.currentLoad || 0);
    }

    return issues.map((issue) => {
      const result = this.triageIssue(issue, team, assignmentCounts);
      // Increment the assigned member's count
      const current = assignmentCounts.get(result.suggestedAssignee.jiraAccountId) || 0;
      assignmentCounts.set(result.suggestedAssignee.jiraAccountId, current + 1);
      return result;
    });
  }

  private triageIssue(
    issue: JiraIssue,
    team: TeamMember[],
    loadMap: Map<string, number>
  ): TriageResult {
    const searchText = `${issue.summary} ${issue.description}`.toLowerCase();
    const isMerchantRequest = this.merchantKeywords.some((kw) => searchText.includes(kw));
    const priority = this.mapPriority(issue.priority, isMerchantRequest);

    const suggestedAssignee = this.selectAssignee(issue, team, loadMap);
    const reason = this.buildReason(issue, suggestedAssignee, priority, isMerchantRequest, loadMap);

    return { issue, suggestedAssignee, reason, priority, isMerchantRequest };
  }

  private mapPriority(jiraPriority: string, isMerchant: boolean): Priority {
    const p = jiraPriority.toLowerCase();
    if (p.includes('highest') || p.includes('blocker')) return 'critical';
    if (p.includes('high') || p.includes('critical')) return 'high';
    if (p.includes('low') || p.includes('lowest')) return isMerchant ? 'medium' : 'low';
    return isMerchant ? 'high' : 'medium';
  }

  private selectAssignee(
    issue: JiraIssue,
    team: TeamMember[],
    loadMap: Map<string, number>
  ): TeamMember {
    if (team.length === 0) {
      return { name: 'Unassigned', jiraAccountId: '' };
    }

    // Score each team member
    const scored = team.map((member) => {
      let score = 0;
      const load = loadMap.get(member.jiraAccountId) || 0;

      // Lower load = higher score (round-robin style balancing)
      score -= load * 10;

      // Skill matching bonus
      if (member.skills) {
        const issueText = `${issue.summary} ${issue.description} ${issue.labels.join(' ')}`.toLowerCase();
        for (const skill of member.skills) {
          if (issueText.includes(skill.toLowerCase())) {
            score += 5;
          }
        }
      }

      return { member, score };
    });

    // Sort by score descending and pick the best
    scored.sort((a, b) => b.score - a.score);
    return scored[0].member;
  }

  private buildReason(
    issue: JiraIssue,
    assignee: TeamMember,
    priority: Priority,
    isMerchant: boolean,
    loadMap: Map<string, number>
  ): string {
    const parts: string[] = [];

    if (isMerchant) parts.push('Merchant request detected');
    parts.push(`Priority: ${priority}`);

    const load = loadMap.get(assignee.jiraAccountId) || 0;
    parts.push(`${assignee.name} has the lowest current load (${load} issues)`);

    if (assignee.skills?.length) {
      const issueText = `${issue.summary} ${issue.description}`.toLowerCase();
      const matchedSkills = assignee.skills.filter((s) => issueText.includes(s.toLowerCase()));
      if (matchedSkills.length > 0) {
        parts.push(`Skill match: ${matchedSkills.join(', ')}`);
      }
    }

    return parts.join('. ');
  }

  getTriageStats(results: TriageResult[]): {
    total: number;
    merchantRequests: number;
    byPriority: Record<Priority, number>;
    byAssignee: Record<string, number>;
  } {
    const byPriority: Record<Priority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byAssignee: Record<string, number> = {};
    let merchantRequests = 0;

    for (const r of results) {
      byPriority[r.priority]++;
      byAssignee[r.suggestedAssignee.name] = (byAssignee[r.suggestedAssignee.name] || 0) + 1;
      if (r.isMerchantRequest) merchantRequests++;
    }

    return { total: results.length, merchantRequests, byPriority, byAssignee };
  }
}
