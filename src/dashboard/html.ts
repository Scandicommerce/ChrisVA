/**
 * ChrisVA Dashboard — Single-page HTML template.
 * Rendered server-side, fetches data from /api/* endpoints.
 */
export function getDashboardHTML(isDemo: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ChrisVA${isDemo ? ' (Demo)' : ''}</title>
  <style>
    :root {
      --bg: #f5f6fa;
      --card: #ffffff;
      --border: #e1e4ea;
      --text: #1a1d26;
      --text-muted: #6b7280;
      --accent: #4f6df5;
      --accent-light: #e8ecff;
      --critical: #ef4444;
      --critical-bg: #fef2f2;
      --high: #f59e0b;
      --high-bg: #fffbeb;
      --medium: #3b82f6;
      --medium-bg: #eff6ff;
      --low: #6b7280;
      --low-bg: #f3f4f6;
      --merchant: #8b5cf6;
      --merchant-bg: #f5f3ff;
      --meeting: #0ea5e9;
      --meeting-bg: #f0f9ff;
      --focus: #10b981;
      --focus-bg: #ecfdf5;
      --email-cat: #f59e0b;
      --jira-cat: #3b82f6;
      --break-cat: #6b7280;
      --slack-cat: #e11d48;
      --radius: 12px;
      --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      --shadow-lg: 0 4px 12px rgba(0,0,0,0.08);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      min-height: 100vh;
    }

    /* ── Header ─────────────────────────────── */
    .header {
      background: var(--card);
      border-bottom: 1px solid var(--border);
      padding: 16px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: var(--shadow);
    }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .logo {
      font-size: 22px;
      font-weight: 700;
      color: var(--accent);
      letter-spacing: -0.5px;
    }
    .logo span { color: var(--text); }
    .mode-badge {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      padding: 3px 10px;
      border-radius: 20px;
      background: ${isDemo ? '#fef3c7; color: #92400e' : '#dcfce7; color: #166534'};
    }
    .header-right { display: flex; align-items: center; gap: 16px; }
    .clock { font-size: 14px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
    .refresh-info { font-size: 12px; color: var(--text-muted); }
    .btn-refresh {
      background: var(--accent);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-refresh:hover { background: #3d5bd9; }
    .btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Layout ─────────────────────────────── */
    .container { max-width: 1440px; margin: 0 auto; padding: 24px 32px; }

    /* ── Overview Cards ─────────────────────── */
    .overview {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px 24px;
      box-shadow: var(--shadow);
      transition: box-shadow 0.15s;
    }
    .stat-card:hover { box-shadow: var(--shadow-lg); }
    .stat-card .label { font-size: 13px; color: var(--text-muted); font-weight: 500; margin-bottom: 4px; }
    .stat-card .value { font-size: 32px; font-weight: 700; line-height: 1.2; }
    .stat-card .detail { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
    .stat-card.urgent .value { color: var(--critical); }
    .stat-card.meetings .value { color: var(--meeting); }
    .stat-card.issues .value { color: var(--jira-cat); }
    .stat-card.merchant .value { color: var(--merchant); }

    /* ── Panels ─────────────────────────────── */
    .grid-main {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .panel {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .panel-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      font-size: 15px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .panel-header .count {
      background: var(--accent-light);
      color: var(--accent);
      font-size: 12px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
    }
    .panel-body { padding: 8px 0; max-height: 480px; overflow-y: auto; }
    .panel-body::-webkit-scrollbar { width: 6px; }
    .panel-body::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }

    /* ── Schedule Timeline ──────────────────── */
    .schedule-item {
      display: flex;
      align-items: flex-start;
      padding: 10px 20px;
      gap: 12px;
      border-bottom: 1px solid #f3f4f6;
      transition: background 0.1s;
    }
    .schedule-item:last-child { border-bottom: none; }
    .schedule-item:hover { background: #fafbfc; }
    .schedule-time {
      font-size: 13px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--text-muted);
      min-width: 100px;
      padding-top: 1px;
    }
    .schedule-cat {
      width: 4px;
      min-height: 32px;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .schedule-cat.meeting { background: var(--meeting); }
    .schedule-cat.email { background: var(--email-cat); }
    .schedule-cat.jira { background: var(--jira-cat); }
    .schedule-cat.focus { background: var(--focus); }
    .schedule-cat.break { background: var(--break-cat); }
    .schedule-cat.slack { background: var(--slack-cat); }
    .schedule-activity { font-size: 14px; flex: 1; }
    .schedule-activity .related {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    /* ── Email List ─────────────────────────── */
    .email-item {
      padding: 12px 20px;
      border-bottom: 1px solid #f3f4f6;
      cursor: default;
      transition: background 0.1s;
    }
    .email-item:last-child { border-bottom: none; }
    .email-item:hover { background: #fafbfc; }
    .email-row { display: flex; align-items: center; gap: 10px; }
    .priority-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    }
    .priority-dot.critical { background: var(--critical); }
    .priority-dot.high { background: var(--high); }
    .priority-dot.medium { background: var(--medium); }
    .priority-dot.low { background: var(--low); }
    .email-subject { font-size: 14px; font-weight: 500; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .email-from { font-size: 12px; color: var(--text-muted); max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .email-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; padding-left: 18px; }
    .tag {
      font-size: 11px;
      font-weight: 500;
      padding: 1px 8px;
      border-radius: 4px;
    }
    .tag.merchant { background: var(--merchant-bg); color: var(--merchant); }
    .tag.critical { background: var(--critical-bg); color: var(--critical); }
    .tag.high { background: var(--high-bg); color: var(--high); }
    .tag.medium { background: var(--medium-bg); color: var(--medium); }
    .tag.low { background: var(--low-bg); color: var(--low); }
    .email-action { font-size: 12px; color: var(--text-muted); }

    /* ── Calendar ───────────────────────────── */
    .cal-item {
      display: flex;
      align-items: flex-start;
      padding: 12px 20px;
      gap: 12px;
      border-bottom: 1px solid #f3f4f6;
    }
    .cal-item:last-child { border-bottom: none; }
    .cal-time {
      font-size: 13px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--meeting);
      min-width: 100px;
    }
    .cal-details { flex: 1; }
    .cal-subject { font-size: 14px; font-weight: 500; }
    .cal-info { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .cal-link {
      font-size: 12px;
      color: var(--accent);
      text-decoration: none;
    }
    .cal-link:hover { text-decoration: underline; }

    /* ── Jira Issues ───────────────────────── */
    .jira-item {
      padding: 12px 20px;
      border-bottom: 1px solid #f3f4f6;
    }
    .jira-item:last-child { border-bottom: none; }
    .jira-row { display: flex; align-items: center; gap: 10px; }
    .jira-key {
      font-size: 12px;
      font-weight: 600;
      color: var(--accent);
      min-width: 70px;
    }
    .jira-summary { font-size: 14px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .jira-status {
      font-size: 11px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--accent-light);
      color: var(--accent);
    }
    .jira-meta { display: flex; gap: 8px; margin-top: 4px; padding-left: 80px; }

    /* ── Triage ─────────────────────────────── */
    .triage-item {
      padding: 14px 20px;
      border-bottom: 1px solid #f3f4f6;
    }
    .triage-item:last-child { border-bottom: none; }
    .triage-header { display: flex; align-items: center; gap: 10px; }
    .triage-key { font-size: 12px; font-weight: 600; color: var(--merchant); min-width: 70px; }
    .triage-summary { font-size: 14px; font-weight: 500; flex: 1; }
    .triage-details { margin-top: 6px; padding-left: 80px; font-size: 13px; color: var(--text-muted); }
    .triage-assignee { font-weight: 500; color: var(--text); }

    /* ── Loading / Error States ─────────────── */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: var(--text-muted);
      font-size: 15px;
    }
    .spinner {
      width: 20px; height: 20px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-banner {
      background: var(--critical-bg);
      color: var(--critical);
      padding: 12px 20px;
      font-size: 14px;
      text-align: center;
      border-bottom: 1px solid #fca5a5;
    }
    .empty { padding: 32px 20px; text-align: center; color: var(--text-muted); font-size: 14px; }

    /* ── Responsive ─────────────────────────── */
    @media (max-width: 1100px) {
      .overview { grid-template-columns: repeat(2, 1fr); }
      .grid-main { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .overview { grid-template-columns: 1fr; }
      .header { padding: 12px 16px; flex-wrap: wrap; gap: 8px; }
      .container { padding: 16px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="logo">Chris<span>VA</span></div>
      <span class="mode-badge">${isDemo ? 'Demo Mode' : 'Live'}</span>
    </div>
    <div class="header-right">
      <span class="clock" id="clock"></span>
      <span class="refresh-info" id="refresh-info"></span>
      <button class="btn-refresh" id="btn-refresh" onclick="refresh()">Refresh</button>
    </div>
  </div>

  <div id="error-banner"></div>

  <div class="container">
    <!-- Overview Cards -->
    <div class="overview" id="overview">
      <div class="stat-card urgent">
        <div class="label">Priority Emails</div>
        <div class="value" id="stat-emails">-</div>
        <div class="detail" id="stat-emails-detail">Loading...</div>
      </div>
      <div class="stat-card meetings">
        <div class="label">Meetings Today</div>
        <div class="value" id="stat-meetings">-</div>
        <div class="detail" id="stat-meetings-detail">Loading...</div>
      </div>
      <div class="stat-card issues">
        <div class="label">Open Issues</div>
        <div class="value" id="stat-issues">-</div>
        <div class="detail" id="stat-issues-detail">Loading...</div>
      </div>
      <div class="stat-card merchant">
        <div class="label">Merchant Requests</div>
        <div class="value" id="stat-merchant">-</div>
        <div class="detail" id="stat-merchant-detail">Loading...</div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="grid-main">
      <!-- Left: Schedule -->
      <div class="panel">
        <div class="panel-header">Today's Schedule <span class="count" id="schedule-count">0</span></div>
        <div class="panel-body" id="schedule-body">
          <div class="loading"><div class="spinner"></div> Building your schedule...</div>
        </div>
      </div>

      <!-- Right: Priority Emails -->
      <div class="panel">
        <div class="panel-header">Priority Emails <span class="count" id="emails-count">0</span></div>
        <div class="panel-body" id="emails-body">
          <div class="loading"><div class="spinner"></div> Triaging emails...</div>
        </div>
      </div>

      <!-- Left: Calendar -->
      <div class="panel">
        <div class="panel-header">Calendar <span class="count" id="calendar-count">0</span></div>
        <div class="panel-body" id="calendar-body">
          <div class="loading"><div class="spinner"></div> Loading calendar...</div>
        </div>
      </div>

      <!-- Right: Jira Issues -->
      <div class="panel">
        <div class="panel-header">My Open Issues <span class="count" id="jira-count">0</span></div>
        <div class="panel-body" id="jira-body">
          <div class="loading"><div class="spinner"></div> Fetching issues...</div>
        </div>
      </div>

      <!-- Full Width: Merchant Triage -->
      <div class="panel" style="grid-column: 1 / -1;">
        <div class="panel-header">Merchant Requests — Triage & Assign <span class="count" id="triage-count">0</span></div>
        <div class="panel-body" id="triage-body">
          <div class="loading"><div class="spinner"></div> Analyzing merchant requests...</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let refreshTimer = null;
    let nextRefresh = null;
    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

    // ── Clock ──────────────────────────────
    function updateClock() {
      const now = new Date();
      document.getElementById('clock').textContent =
        now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
        '  ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    setInterval(updateClock, 10000);
    updateClock();

    // ── Countdown ──────────────────────────
    function updateCountdown() {
      if (!nextRefresh) return;
      const remaining = Math.max(0, Math.round((nextRefresh - Date.now()) / 1000));
      const min = Math.floor(remaining / 60);
      const sec = remaining % 60;
      document.getElementById('refresh-info').textContent =
        'Next refresh in ' + min + ':' + String(sec).padStart(2, '0');
    }
    setInterval(updateCountdown, 1000);

    // ── Helpers ────────────────────────────
    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function fmtTime(iso) {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    function fmtTimeRange(start, end) { return fmtTime(start) + ' – ' + fmtTime(end); }
    function timeAgo(iso) {
      const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
      if (diff < 1) return 'just now';
      if (diff < 60) return diff + 'm ago';
      if (diff < 1440) return Math.round(diff / 60) + 'h ago';
      return Math.round(diff / 1440) + 'd ago';
    }

    // ── Render ─────────────────────────────
    function render(data) {
      // Overview cards
      const actionCount = data.priorityEmails.filter(e => e.actionRequired).length;
      document.getElementById('stat-emails').textContent = actionCount;
      document.getElementById('stat-emails-detail').textContent = data.unreadEmailCount + ' unread total';

      document.getElementById('stat-meetings').textContent = data.todaysMeetings.length;
      const nextMeeting = data.todaysMeetings.find(m => new Date(m.start) > new Date());
      document.getElementById('stat-meetings-detail').textContent =
        nextMeeting ? 'Next: ' + fmtTime(nextMeeting.start) + ' ' + esc(nextMeeting.subject) : 'No upcoming meetings';

      document.getElementById('stat-issues').textContent = data.openJiraIssues.length;
      const inProgress = data.openJiraIssues.filter(i => i.status === 'In Progress').length;
      document.getElementById('stat-issues-detail').textContent = inProgress + ' in progress';

      document.getElementById('stat-merchant').textContent = data.merchantRequests.length;
      const critMerchant = data.merchantRequests.filter(t => t.priority === 'critical' || t.priority === 'high').length;
      document.getElementById('stat-merchant-detail').textContent = critMerchant + ' urgent, need assignment';

      // Schedule
      const scheduleEl = document.getElementById('schedule-body');
      document.getElementById('schedule-count').textContent = data.suggestedSchedule.length;
      if (data.suggestedSchedule.length === 0) {
        scheduleEl.innerHTML = '<div class="empty">No schedule generated yet.</div>';
      } else {
        scheduleEl.innerHTML = data.suggestedSchedule.map(b => \`
          <div class="schedule-item">
            <span class="schedule-time">\${esc(b.start)} – \${esc(b.end)}</span>
            <div class="schedule-cat \${b.category}"></div>
            <div class="schedule-activity">
              \${esc(b.activity)}
              \${b.relatedItems && b.relatedItems.length ? '<div class="related">' + b.relatedItems.map(esc).join(', ') + '</div>' : ''}
            </div>
          </div>
        \`).join('');
      }

      // Priority Emails
      const emailsEl = document.getElementById('emails-body');
      document.getElementById('emails-count').textContent = data.priorityEmails.length;
      if (data.priorityEmails.length === 0) {
        emailsEl.innerHTML = '<div class="empty">No priority emails right now.</div>';
      } else {
        emailsEl.innerHTML = data.priorityEmails.map(es => \`
          <div class="email-item">
            <div class="email-row">
              <span class="priority-dot \${es.priority}"></span>
              <span class="email-subject">\${esc(es.email.subject)}</span>
              <span class="email-from">\${esc(es.email.from)}</span>
            </div>
            <div class="email-meta">
              <span class="tag \${es.priority}">\${es.priority}</span>
              \${es.isMerchantRequest ? '<span class="tag merchant">merchant</span>' : ''}
              <span class="email-action">\${esc(es.suggestedAction)}</span>
            </div>
          </div>
        \`).join('');
      }

      // Calendar
      const calEl = document.getElementById('calendar-body');
      document.getElementById('calendar-count').textContent = data.todaysMeetings.length;
      if (data.todaysMeetings.length === 0) {
        calEl.innerHTML = '<div class="empty">No meetings today.</div>';
      } else {
        calEl.innerHTML = data.todaysMeetings.map(m => {
          const loc = m.isOnline ? 'Online' : (m.location || 'No location');
          const link = m.isOnline && m.onlineUrl ? ' &middot; <a class="cal-link" href="' + esc(m.onlineUrl) + '" target="_blank">Join</a>' : '';
          return \`
            <div class="cal-item">
              <span class="cal-time">\${fmtTime(m.start)} – \${fmtTime(m.end)}</span>
              <div class="cal-details">
                <div class="cal-subject">\${esc(m.subject)}</div>
                <div class="cal-info">\${esc(loc)}\${link} &middot; \${m.attendees.length} attendees</div>
              </div>
            </div>
          \`;
        }).join('');
      }

      // Jira Issues
      const jiraEl = document.getElementById('jira-body');
      document.getElementById('jira-count').textContent = data.openJiraIssues.length;
      if (data.openJiraIssues.length === 0) {
        jiraEl.innerHTML = '<div class="empty">No open issues assigned to you.</div>';
      } else {
        jiraEl.innerHTML = data.openJiraIssues.map(i => \`
          <div class="jira-item">
            <div class="jira-row">
              <span class="jira-key">\${esc(i.key)}</span>
              <span class="jira-summary">\${esc(i.summary)}</span>
              <span class="jira-status">\${esc(i.status)}</span>
            </div>
            <div class="jira-meta">
              <span class="tag \${i.priority.toLowerCase().includes('high') ? 'high' : i.priority.toLowerCase().includes('low') ? 'low' : 'medium'}">\${esc(i.priority)}</span>
              <span style="font-size:12px;color:var(--text-muted)">\${esc(i.issueType)} &middot; Updated \${timeAgo(i.updated)}</span>
            </div>
          </div>
        \`).join('');
      }

      // Merchant Triage
      const triageEl = document.getElementById('triage-body');
      document.getElementById('triage-count').textContent = data.merchantRequests.length;
      if (data.merchantRequests.length === 0) {
        triageEl.innerHTML = '<div class="empty">No merchant requests pending triage.</div>';
      } else {
        triageEl.innerHTML = data.merchantRequests.map(t => \`
          <div class="triage-item">
            <div class="triage-header">
              <span class="triage-key">\${esc(t.issue.key)}</span>
              <span class="tag \${t.priority}">\${t.priority}</span>
              <span class="triage-summary">\${esc(t.issue.summary)}</span>
            </div>
            <div class="triage-details">
              Assign to <span class="triage-assignee">\${esc(t.suggestedAssignee.name)}</span>
              &middot; \${esc(t.reason)}
            </div>
          </div>
        \`).join('');
      }
    }

    // ── Fetch & Refresh ───────────────────
    async function refresh() {
      const btn = document.getElementById('btn-refresh');
      btn.disabled = true;
      btn.textContent = 'Loading...';
      document.getElementById('error-banner').innerHTML = '';

      try {
        const res = await fetch('/api/briefing');
        if (!res.ok) throw new Error('API returned ' + res.status);
        const data = await res.json();
        render(data);
        document.getElementById('refresh-info').textContent = 'Updated just now';
      } catch (err) {
        document.getElementById('error-banner').innerHTML =
          '<div class="error-banner">Failed to load data: ' + esc(err.message) + '. Will retry on next refresh.</div>';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Refresh';
        nextRefresh = Date.now() + REFRESH_INTERVAL;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refresh, REFRESH_INTERVAL);
      }
    }

    // ── Init ──────────────────────────────
    refresh();
  </script>
</body>
</html>`;
}
