import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { banner, header } from '../utils/display';

const ENV_PATH = path.join(process.cwd(), '.env');
const ENV_EXAMPLE_PATH = path.join(process.cwd(), '.env.example');

interface SetupAnswers {
  outlookClientId: string;
  outlookTenantId: string;
  outlookClientSecret: string;
  outlookUserEmail: string;
  jiraHost: string;
  jiraEmail: string;
  jiraApiToken: string;
  jiraProjectKey: string;
  slackBotToken: string;
  slackDefaultChannel: string;
  slackTriageChannel: string;
  teamMembers: string;
  timezone: string;
  workStartHour: string;
  workEndHour: string;
}

export async function runSetupWizard(): Promise<void> {
  console.log(banner());
  console.log(header('SETUP WIZARD'));
  console.log(`
  This wizard will walk you through connecting your accounts.
  You'll need to create API keys/tokens for each service.
  I'll tell you exactly where to go and what to click.
`);

  // Check if .env already exists
  if (fs.existsSync(ENV_PATH)) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: '.env file already exists. Overwrite it?',
      default: false,
    }]);
    if (!overwrite) {
      console.log(chalk.yellow('\n  Setup cancelled. Your existing .env was not modified.\n'));
      return;
    }
  }

  // ─── Step 1: Outlook ──────────────────────────────
  console.log(chalk.cyan('\n  ── STEP 1: OUTLOOK (Microsoft Graph API) ──\n'));
  console.log(chalk.white(`  You need to register an app in Azure AD to read your email and calendar.

  Follow these steps:

    1. Go to ${chalk.cyan('https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade')}

    2. Click ${chalk.bold('"+ New registration"')}
       - Name: ${chalk.green('ChrisVA')}
       - Supported account types: ${chalk.green('Single tenant')} (your org only)
       - Redirect URI: leave blank
       - Click ${chalk.bold('Register')}

    3. On the app overview page, copy:
       - ${chalk.bold('Application (client) ID')}  ->  OUTLOOK_CLIENT_ID
       - ${chalk.bold('Directory (tenant) ID')}    ->  OUTLOOK_TENANT_ID

    4. Go to ${chalk.bold('"Certificates & secrets"')} in the left menu
       - Click ${chalk.bold('"+ New client secret"')}
       - Description: ${chalk.green('ChrisVA')} / Expiry: ${chalk.green('24 months')}
       - Copy the ${chalk.bold('Value')} (not the Secret ID)  ->  OUTLOOK_CLIENT_SECRET

    5. Go to ${chalk.bold('"API permissions"')} in the left menu
       - Click ${chalk.bold('"+ Add a permission"')} -> ${chalk.bold('Microsoft Graph')} -> ${chalk.bold('Application permissions')}
       - Add: ${chalk.green('Mail.Read')} and ${chalk.green('Calendars.Read')}
       - Click ${chalk.bold('"Grant admin consent"')} (you may need an admin to do this)
`));

  const outlookAnswers = await inquirer.prompt([
    { type: 'input', name: 'outlookClientId', message: 'Outlook Client ID:', validate: notEmpty },
    { type: 'input', name: 'outlookTenantId', message: 'Outlook Tenant ID:', validate: notEmpty },
    { type: 'password', name: 'outlookClientSecret', message: 'Outlook Client Secret:', mask: '*', validate: notEmpty },
    { type: 'input', name: 'outlookUserEmail', message: 'Your Outlook email:', validate: isEmail },
  ]);

  const spinner1 = ora('Outlook configured').start();
  spinner1.succeed('Outlook configured');

  // ─── Step 2: Jira ──────────────────────────────────
  console.log(chalk.cyan('\n  ── STEP 2: JIRA ──\n'));
  console.log(chalk.white(`  You need a Jira API token.

  Follow these steps:

    1. Go to ${chalk.cyan('https://id.atlassian.com/manage-profile/security/api-tokens')}

    2. Click ${chalk.bold('"Create API token"')}
       - Label: ${chalk.green('ChrisVA')}
       - Click ${chalk.bold('Create')}
       - Copy the token  ->  JIRA_API_TOKEN

    3. Your Jira host is your Atlassian URL, e.g. ${chalk.green('https://yourcompany.atlassian.net')}

    4. Your project key is the prefix on your tickets, e.g. ${chalk.green('SC')} for SC-123
`));

  const jiraAnswers = await inquirer.prompt([
    { type: 'input', name: 'jiraHost', message: 'Jira host URL (e.g. https://company.atlassian.net):', validate: notEmpty },
    { type: 'input', name: 'jiraEmail', message: 'Your Jira email:', validate: isEmail },
    { type: 'password', name: 'jiraApiToken', message: 'Jira API token:', mask: '*', validate: notEmpty },
    { type: 'input', name: 'jiraProjectKey', message: 'Project key (e.g. SC):', validate: notEmpty },
  ]);

  const spinner2 = ora('Jira configured').start();
  spinner2.succeed('Jira configured');

  // ─── Step 3: Slack ─────────────────────────────────
  console.log(chalk.cyan('\n  ── STEP 3: SLACK ──\n'));
  console.log(chalk.white(`  You need to create a Slack app with a Bot token.

  Follow these steps:

    1. Go to ${chalk.cyan('https://api.slack.com/apps')}

    2. Click ${chalk.bold('"Create New App"')} -> ${chalk.bold('"From scratch"')}
       - App name: ${chalk.green('ChrisVA')}
       - Pick your workspace
       - Click ${chalk.bold('Create App')}

    3. In the left menu, go to ${chalk.bold('"OAuth & Permissions"')}
       - Scroll to ${chalk.bold('"Bot Token Scopes"')} and add:
         ${chalk.green('chat:write')}  ${chalk.green('conversations:list')}  ${chalk.green('conversations:open')}  ${chalk.green('users:read')}

    4. Scroll up and click ${chalk.bold('"Install to Workspace"')} -> ${chalk.bold('Allow')}
       - Copy the ${chalk.bold('Bot User OAuth Token')} (starts with xoxb-)  ->  SLACK_BOT_TOKEN

    5. In Slack, create two channels (or use existing ones):
       - One for daily briefings (e.g. #general)
       - One for merchant triage notifications (e.g. #merchant-triage)
`));

  const slackAnswers = await inquirer.prompt([
    { type: 'input', name: 'slackBotToken', message: 'Slack Bot Token (xoxb-...):', validate: (v) => v.startsWith('xoxb-') ? true : 'Must start with xoxb-' },
    { type: 'input', name: 'slackDefaultChannel', message: 'Briefing channel name:', default: 'general' },
    { type: 'input', name: 'slackTriageChannel', message: 'Triage channel name:', default: 'merchant-triage' },
  ]);

  const spinner3 = ora('Slack configured').start();
  spinner3.succeed('Slack configured');

  // ─── Step 4: Team & Schedule ───────────────────────
  console.log(chalk.cyan('\n  ── STEP 4: TEAM & SCHEDULE ──\n'));
  console.log(chalk.white(`  Add your team members so ChrisVA can assign Jira tickets.

  For each member you need:
    - Their name
    - Their Jira account ID (find it in Jira: open their profile -> the ID is in the URL)
    - Their Slack user ID (optional — find it: click their profile in Slack -> "..." -> "Copy member ID")

  Format: ${chalk.green('Name:jiraAccountId:slackUserId')} separated by commas
  Example: ${chalk.green('Alice:5e8f1234abcd:U01ABC,Bob:5e8f5678efgh:U02DEF')}
`));

  const teamAnswers = await inquirer.prompt([
    { type: 'input', name: 'teamMembers', message: 'Team members (or press Enter to skip for now):', default: '' },
    { type: 'input', name: 'timezone', message: 'Your timezone:', default: 'Europe/Amsterdam' },
    { type: 'input', name: 'workStartHour', message: 'Work start hour (0-23):', default: '9' },
    { type: 'input', name: 'workEndHour', message: 'Work end hour (0-23):', default: '17' },
  ]);

  const spinner4 = ora('Team configured').start();
  spinner4.succeed('Team configured');

  // ─── Write .env ────────────────────────────────────
  const answers: SetupAnswers = { ...outlookAnswers, ...jiraAnswers, ...slackAnswers, ...teamAnswers };

  const envContent = `# ===== ChrisVA Configuration =====
# Generated by: npx chrisva setup

# --- Outlook (Microsoft Graph API) ---
OUTLOOK_CLIENT_ID=${answers.outlookClientId}
OUTLOOK_TENANT_ID=${answers.outlookTenantId}
OUTLOOK_CLIENT_SECRET=${answers.outlookClientSecret}
OUTLOOK_USER_EMAIL=${answers.outlookUserEmail}

# --- Jira ---
JIRA_HOST=${answers.jiraHost}
JIRA_EMAIL=${answers.jiraEmail}
JIRA_API_TOKEN=${answers.jiraApiToken}
JIRA_PROJECT_KEY=${answers.jiraProjectKey}

# --- Slack ---
SLACK_BOT_TOKEN=${answers.slackBotToken}
SLACK_DEFAULT_CHANNEL=${answers.slackDefaultChannel}
SLACK_TRIAGE_CHANNEL=${answers.slackTriageChannel}

# --- Team Members ---
TEAM_MEMBERS=${answers.teamMembers}

# --- Work Schedule ---
WORK_START_HOUR=${answers.workStartHour}
WORK_END_HOUR=${answers.workEndHour}
TIMEZONE=${answers.timezone}

# --- VA Preferences ---
EMAIL_CHECK_INTERVAL_MINUTES=15
PRIORITY_KEYWORDS=urgent,critical,blocker,asap,p0,production
MERCHANT_KEYWORDS=merchant,our store,our shop,my store,my shop,order issue,payment issue,checkout issue,storefront
`;

  fs.writeFileSync(ENV_PATH, envContent);

  console.log(chalk.green.bold(`\n  .env file written successfully!`));
  console.log(`
  ${chalk.bold('You\'re all set. Try these commands:')}

    ${chalk.cyan('npx chrisva briefing')}    Morning briefing
    ${chalk.cyan('npx chrisva status')}      Quick dashboard
    ${chalk.cyan('npx chrisva emails')}      Triage your inbox
    ${chalk.cyan('npx chrisva triage')}      Assign Jira tickets
    ${chalk.cyan('npx chrisva calendar')}    Today's meetings
    ${chalk.cyan('npx chrisva schedule')}    Full day plan

  ${chalk.gray('Tip: If something doesn\'t work, double-check the API permissions.')}
  ${chalk.gray('     For Outlook, admin consent is often the missing piece.')}
`);
}

function notEmpty(val: string): boolean | string {
  return val.trim().length > 0 ? true : 'This field is required';
}

function isEmail(val: string): boolean | string {
  return val.includes('@') ? true : 'Please enter a valid email address';
}
