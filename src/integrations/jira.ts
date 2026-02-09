import fetch from 'node-fetch';
import { JiraIssue, VAConfig } from '../core/types';

export class JiraClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(private config: VAConfig['jira']) {
    this.baseUrl = config.host.replace(/\/$/, '');
    this.authHeader = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  }

  private async request(endpoint: string, options: Record<string, unknown> = {}): Promise<unknown> {
    const url = `${this.baseUrl}/rest/api/3${endpoint}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${this.authHeader}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...options,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jira API error (${res.status}): ${body}`);
    }

    return res.json();
  }

  private get projectFilter(): string {
    return this.config.projectKey ? `project = ${this.config.projectKey} AND ` : '';
  }

  async getMyOpenIssues(): Promise<JiraIssue[]> {
    const jql = `${this.projectFilter}assignee = currentUser() AND status != Done ORDER BY priority DESC, updated DESC`;
    return this.searchIssues(jql);
  }

  async getUnassignedIssues(): Promise<JiraIssue[]> {
    const jql = `${this.projectFilter}assignee is EMPTY AND status != Done ORDER BY created DESC`;
    return this.searchIssues(jql);
  }

  async getRecentIssues(hours = 24): Promise<JiraIssue[]> {
    const jql = `${this.projectFilter}created >= -${hours}h ORDER BY created DESC`;
    return this.searchIssues(jql);
  }

  async getProjectKeys(): Promise<string[]> {
    const data = (await this.request('/project')) as Array<{ key: string; name: string }>;
    return data.map((p) => p.key);
  }

  async searchIssues(jql: string): Promise<JiraIssue[]> {
    const data = (await this.request(`/search?jql=${encodeURIComponent(jql)}&maxResults=50`)) as {
      issues: Array<{
        key: string;
        fields: {
          summary: string;
          description: { content?: Array<{ content?: Array<{ text?: string }> }> } | string | null;
          status: { name: string };
          priority: { name: string };
          assignee: { displayName: string } | null;
          reporter: { displayName: string };
          created: string;
          updated: string;
          labels: string[];
          issuetype: { name: string };
          project: { key: string };
        };
      }>;
    };

    return data.issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      description: this.extractDescription(issue.fields.description),
      status: issue.fields.status.name,
      priority: issue.fields.priority.name,
      assignee: issue.fields.assignee?.displayName || null,
      reporter: issue.fields.reporter.displayName,
      created: new Date(issue.fields.created),
      updated: new Date(issue.fields.updated),
      labels: issue.fields.labels || [],
      issueType: issue.fields.issuetype.name,
      projectKey: issue.fields.project.key,
    }));
  }

  async assignIssue(issueKey: string, accountId: string): Promise<void> {
    await this.request(`/issue/${issueKey}/assignee`, {
      method: 'PUT',
      body: JSON.stringify({ accountId }),
    });
  }

  async transitionIssue(issueKey: string, transitionName: string): Promise<void> {
    const transitions = (await this.request(`/issue/${issueKey}/transitions`)) as {
      transitions: Array<{ id: string; name: string }>;
    };

    const match = transitions.transitions.find(
      (t) => t.name.toLowerCase() === transitionName.toLowerCase()
    );

    if (!match) {
      const available = transitions.transitions.map((t) => t.name).join(', ');
      throw new Error(`Transition "${transitionName}" not found. Available: ${available}`);
    }

    await this.request(`/issue/${issueKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ transition: { id: match.id } }),
    });
  }

  async addComment(issueKey: string, comment: string): Promise<void> {
    await this.request(`/issue/${issueKey}/comment`, {
      method: 'POST',
      body: JSON.stringify({
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: comment }],
            },
          ],
        },
      }),
    });
  }

  private extractDescription(desc: unknown): string {
    if (!desc) return '';
    if (typeof desc === 'string') return desc;

    const doc = desc as { content?: Array<{ content?: Array<{ text?: string }> }> };
    if (doc.content) {
      return doc.content
        .flatMap((block) => (block.content || []).map((inline) => inline.text || ''))
        .join('\n');
    }
    return '';
  }
}
