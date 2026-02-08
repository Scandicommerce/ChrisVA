import chalk from 'chalk';
import { Priority, EmailCategory } from '../core/types';

export function priorityBadge(priority: Priority): string {
  switch (priority) {
    case 'critical': return chalk.bgRed.white.bold(' CRITICAL ');
    case 'high':     return chalk.bgYellow.black.bold(' HIGH ');
    case 'medium':   return chalk.bgBlue.white(' MEDIUM ');
    case 'low':      return chalk.gray(' LOW ');
  }
}

export function categoryBadge(category: EmailCategory): string {
  switch (category) {
    case 'merchant-request': return chalk.bgMagenta.white(' MERCHANT ');
    case 'internal':         return chalk.bgCyan.black(' INTERNAL ');
    case 'external':         return chalk.bgGreen.black(' EXTERNAL ');
    case 'automated':        return chalk.gray(' AUTO ');
    case 'newsletter':       return chalk.gray(' NEWS ');
  }
}

export function header(text: string): string {
  const line = '─'.repeat(60);
  return `\n${chalk.cyan(line)}\n  ${chalk.bold.white(text)}\n${chalk.cyan(line)}`;
}

export function subHeader(text: string): string {
  return `\n  ${chalk.bold.cyan(text)}\n  ${'─'.repeat(text.length)}`;
}

export function indent(text: string, level = 1): string {
  const pad = '  '.repeat(level);
  return text.split('\n').map((l) => pad + l).join('\n');
}

export function truncate(text: string, maxLen = 80): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

export function banner(): string {
  return chalk.cyan(`
   _____ _          _    __     ___
  / ____| |        (_)   \\ \\   / / \\
 | |    | |__  _ __ _ ___  \\ \\_/ / _ \\
 | |    | '_ \\| '__| / __|  \\   / ___ \\
 | |____| | | | |  | \\__ \\   | |/ ___ \\
  \\_____|_| |_|_|  |_|___/   |_/_/   \\_\\

  Your Virtual Assistant
  `);
}
