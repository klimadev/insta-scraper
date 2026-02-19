import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { MESSAGES } from './messages';

export class Logger {
  private spinner: Ora | null = null;

  private withSpinnerPaused(callback: () => void): void {
    const hasSpinner = this.spinner !== null;

    if (hasSpinner) {
      this.spinner!.stop();
    }

    callback();

    if (hasSpinner) {
      this.spinner!.start();
    }
  }

  start(text: string): void {
    this.spinner = ora({
      text: chalk.cyan(text),
      spinner: 'dots12'
    }).start();
  }

  update(text: string): void {
    if (this.spinner) {
      this.spinner.text = chalk.cyan(text);
    }
  }

  succeed(text?: string): void {
    if (this.spinner) {
      this.spinner.succeed(chalk.green(text || MESSAGES.SUCCESS));
      this.spinner = null;
    }
  }

  fail(text: string): void {
    if (this.spinner) {
      this.spinner.fail(chalk.red(text));
      this.spinner = null;
    }
  }

  error(code: string, message: string, action: string): void {
    this.withSpinnerPaused(() => {
      console.log('');
      console.log(chalk.red.bold('╔══════════════════════════════════════════╗'));
      console.log(chalk.red.bold('║           ERRO CRÍTICO                   ║'));
      console.log(chalk.red.bold('╠══════════════════════════════════════════╣'));
      console.log(chalk.red.bold('║') + chalk.yellow(` Código: ${code}`.padEnd(43)) + chalk.red.bold('║'));
      console.log(chalk.red.bold('║') + chalk.white(` ${message}`.padEnd(43)) + chalk.red.bold('║'));
      console.log(chalk.red.bold('║') + chalk.gray(` Ação: ${action}`.padEnd(43)) + chalk.red.bold('║'));
      console.log(chalk.red.bold('╚══════════════════════════════════════════╝'));
      console.log('');
    });
  }

  info(text: string): void {
    this.withSpinnerPaused(() => {
      console.log(chalk.blue('ℹ') + ' ' + chalk.white(text));
    });
  }

  warn(text: string): void {
    this.withSpinnerPaused(() => {
      console.log(chalk.yellow('⚠') + ' ' + chalk.yellow(text));
    });
  }

  header(): void {
    console.log('');
    console.log(chalk.magenta.bold('╔══════════════════════════════════════════╗'));
    console.log(chalk.magenta.bold('║') + chalk.white.bold('      Insta Launcher v1.0.0               ') + chalk.magenta.bold('║'));
    console.log(chalk.magenta.bold('╚══════════════════════════════════════════╝'));
    console.log('');
  }
}

export const logger = new Logger();
