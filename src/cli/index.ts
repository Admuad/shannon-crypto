#!/usr/bin/env node
/**
 * Shannon Crypto CLI
 * Autonomous smart contract security auditing system
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

import { startAudit } from '../audit/audit.js';
import { generateReport } from '../audit/report.js';
import { showWorkspace } from '../cli/workspace.js';

const packageJson = JSON.parse(
  await import('fs').then((fs) => fs.readFile('./package.json', 'utf-8'))
);

const program = new Command()
  .name('shannon-crypto')
  .description(packageJson.description)
  .version(packageJson.version);

// Audit command
program
  .command('audit')
  .description('Run a smart contract security audit')
  .option('-c, --contract <address>', 'Smart contract address to audit')
  .option('-s, --source <path>', 'Local source code directory')
  .option('-r, --repo <owner/repo>', 'GitHub repository to audit')
  .option('-n, --network <network>', 'Blockchain network (default: ethereum)', 'ethereum')
  .option('-e, --simulate-exploits', 'Simulate exploits on testnet', false)
  .option('-t, --testnet', 'Use testnet for exploit simulation', false)
  .option('-o, --output <path>', 'Output directory for reports', './audit-logs')
  .option('-w, --workspace <name>', 'Workspace name for resuming')
  .action(async (options) => {
    const spinner = ora('Starting audit...').start();

    try {
      await startAudit(options);
      spinner.succeed('Audit completed');
    } catch (error: any) {
      spinner.fail(`Audit failed: ${error.message}`);
      console.error(error);
      process.exit(1);
    }
  });

// Report command
program
  .command('report')
  .description('Generate report from audit results')
  .option('-w, --workspace <name>', 'Workspace name', 'latest')
  .option('-f, --format <format>', 'Report format (markdown, json, html)', 'markdown')
  .option('-o, --output <path>', 'Output path for report')
  .action(async (options) => {
    const spinner = ora('Generating report...').start();

    try {
      await generateReport(options);
      spinner.succeed('Report generated');
    } catch (error: any) {
      spinner.fail(`Report generation failed: ${error.message}`);
      console.error(error);
      process.exit(1);
    }
  });

// Workspace command
program
  .command('workspace')
  .description('List or manage workspaces')
  .option('-l, --list', 'List all workspaces', false)
  .option('-s, --show <name>', 'Show workspace details')
  .option('-r, --resume <name>', 'Resume a workspace')
  .action(async (options) => {
    try {
      await showWorkspace(options);
    } catch (error: any) {
      console.error(`Workspace error: ${error.message}`);
      console.error(error);
      process.exit(1);
    }
  });

// Benchmark command
program
  .command('benchmark')
  .description('Run benchmark tests')
  .option('-s, --suite <name>', 'Benchmark suite (evmbench, custom)', 'evmbench')
  .option('-o, --output <path>', 'Output path for results', './benchmarks/results')
  .action(async (options) => {
    const spinner = ora('Running benchmarks...').start();
    console.log(chalk.yellow('Benchmarking is in development - coming soon!'));
    spinner.stop();
  });

program.parse();

// Display banner if no command provided
if (!process.argv.slice(2).length) {
  console.log(`
${chalk.cyan.bold('╔══════════════════════════════════════════╗')}
${chalk.cyan.bold('║')}${chalk.white.bold('  Shannon Crypto - AI-Powered Smart Contract Auditor  ')}${chalk.cyan.bold('  ║')}
${chalk.cyan.bold('╚══════════════════════════════════════════╝')}
${chalk.gray('Autonomous smart contract security auditing for Ethereum and beyond.')}
${chalk.white.bold('\nQuick Start:')}
  ${chalk.cyan('npx shannon-crypto audit --contract 0x1234...')}
  ${chalk.cyan('npx shannon-crypto audit --repo owner/repo')}
${chalk.white.bold('\nCommands:')}
  ${chalk.cyan('audit')}    Run a security audit
  ${chalk.cyan('report')}   Generate audit report
  ${chalk.cyan('workspace')} Manage audit workspaces
  ${chalk.cyan('benchmark')} Run benchmark tests
${chalk.white.bold('\nDocumentation:')}
  ${chalk.blue('https://github.com/Admuad/shannon-crypto')}
${chalk.white.bold('\nLicense:')}
  ${chalk.gray('AGPL-3.0')}
  `);
}
