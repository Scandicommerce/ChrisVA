import { VAConfig, VAPlugin, PluginContext } from './types';
import chalk from 'chalk';

export class VAEngine {
  private plugins: VAPlugin[] = [];
  private context: PluginContext;

  constructor(private config: VAConfig) {
    this.context = {
      config,
      log: (message: string) => {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        console.log(chalk.gray(`[${timestamp}]`) + ' ' + message);
      },
    };
  }

  registerPlugin(plugin: VAPlugin): void {
    this.plugins.push(plugin);
    this.context.log(`Plugin registered: ${chalk.cyan(plugin.name)}`);
  }

  async initialize(): Promise<void> {
    this.context.log(chalk.bold('Starting ChrisVA...'));
    for (const plugin of this.plugins) {
      try {
        await plugin.initialize(this.context);
        this.context.log(`  ${chalk.green('✓')} ${plugin.name} ready`);
      } catch (err) {
        this.context.log(`  ${chalk.red('✗')} ${plugin.name} failed: ${(err as Error).message}`);
      }
    }
    this.context.log(chalk.green('ChrisVA is ready.\n'));
  }

  async shutdown(): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.shutdown) {
        await plugin.shutdown();
      }
    }
  }

  getConfig(): VAConfig {
    return this.config;
  }

  log(message: string): void {
    this.context.log(message);
  }
}
