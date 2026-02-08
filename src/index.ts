// ChrisVA — Core exports
export { VAEngine } from './core/engine';
export { loadConfig, loadDemoConfig } from './core/config';
export { OutlookMailClient } from './integrations/outlook-mail';
export { OutlookCalendarClient } from './integrations/outlook-calendar';
export { JiraClient } from './integrations/jira';
export { SlackClient } from './integrations/slack';
export { EmailTriageModule } from './modules/email-triage';
export { JiraTriageModule } from './modules/jira-triage';
export { SchedulerModule } from './modules/scheduler';
export * from './core/types';
