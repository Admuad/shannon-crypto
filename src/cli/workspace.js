/**
 * Workspace Manager
 * Handles audit workspace creation, listing, and resumption
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import ora from 'ora';
import chalk from 'chalk';

interface WorkspaceOptions {
  list?: boolean;
  show?: string;
  resume?: string;
}

interface WorkspaceInfo {
  name: string;
  createdAt: string;
  status: string;
  contractAddress?: string;
  vulnerabilities: number;
  reportPath?: string;
}

/**
 * List all workspaces
 */
async function listWorkspaces(): Promise<void> {
  const auditLogsPath = join(process.cwd(), 'audit-logs');

  try {
    const directories = await fs.readdir(auditLogsPath);
    const workspaces: WorkspaceInfo[] = [];

    for (const dir of directories) {
      const workspacePath = join(auditLogsPath, dir);
      const stats = await fs.stat(workspacePath);

      if (!stats.isDirectory()) continue;

      // Try to read session info
      let status = 'completed';
      let vulns = 0;
      let reportPath: string | undefined;
      let contractAddress: string | undefined;

      try {
        const sessionPath = join(workspacePath, 'session.json');
        const sessionData = await fs.readFile(sessionPath, 'utf-8');
        const session = JSON.parse(sessionData);

        status = session.status || 'unknown';
        vulns = session.vulnerabilities || 0;
        reportPath = session.reportPath;
        contractAddress = session.contractAddress;
      } catch {
        // No session file, infer from report
        const reportFilePath = join(workspacePath, 'report.md');
        try {
          await fs.access(reportFilePath);
          status = 'completed';
          reportPath = reportFilePath;
        } catch {
          status = 'incomplete';
        }
      }

      workspaces.push({
        name: dir,
        createdAt: stats.mtime.toISOString(),
        status,
        contractAddress,
        vulnerabilities: vulns,
        reportPath,
      });
    }

    if (workspaces.length === 0) {
      console.log(chalk.yellow('No workspaces found'));
      return;
    }

    console.log(chalk.white.bold('\n📁 Workspaces:\n'));

    // Sort by creation date (newest first)
    workspaces.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    for (const ws of workspaces) {
      const statusColor =
        ws.status === 'completed'
          ? chalk.green('✅')
          : ws.status === 'failed'
          ? chalk.red('❌')
          : chalk.yellow('⏳');

      console.log(`${statusColor} ${chalk.cyan(ws.name)}`);
      console.log(`   Created: ${chalk.gray(ws.createdAt.slice(0, 10))}`);
      console.log(`   Status: ${chalk.gray(ws.status)}`);
      if (ws.contractAddress) {
        console.log(`   Contract: ${chalk.gray(ws.contractAddress)}`);
      }
      if (ws.vulnerabilities > 0) {
        console.log(
          `   Vulnerabilities: ${chalk.red.bold(ws.vulnerabilities)}`
        );
      }
      console.log('');
    }
  } catch (error: any) {
    console.error(chalk.red(`Failed to list workspaces: ${error.message}`));
  }
}

/**
 * Show workspace details
 */
async function showWorkspaceDetails(name: string): Promise<void> {
  const workspacePath = join(process.cwd(), 'audit-logs', name);

  console.log(chalk.cyan.bold(`\n📁 Workspace: ${name}`));
  console.log(chalk.gray(`Path: ${workspacePath}`));
  console.log('');

  try {
    // Show report
    const reportPath = join(workspacePath, 'report.md');

    try {
      const report = await fs.readFile(reportPath, 'utf-8');
      console.log(chalk.white.bold('📄 Audit Report:\n'));
      console.log(report.slice(0, 500)); // First 500 chars

      if (report.length > 500) {
        console.log(chalk.gray('... (truncated)'));
      }
    } catch (error: any) {
      console.log(chalk.yellow('⚠️  No report found'));
    }

    // Show directory structure
    console.log(chalk.white.bold('\n📂 Workspace Structure:\n'));

    try {
      const { stdout } = await exec(
        `find "${workspacePath}" -type f | head -20`,
        { timeout: 5000 }
      );

      console.log(stdout);
    } catch (error: any) {
      console.log(chalk.yellow('⚠️  Could not list files'));
    }
  } catch (error: any) {
    console.error(chalk.red(`Failed to show workspace: ${error.message}`));
  }
}

/**
 * Resume a workspace
 */
async function resumeWorkspace(name: string): Promise<void> {
  console.log(chalk.cyan.bold(`\n📁 Resuming Workspace: ${name}`));
  console.log(chalk.gray('(Functionality coming in v0.2)'));
}

/**
 * Main handler for workspace commands
 */
export async function showWorkspace(options: WorkspaceOptions): Promise<void> {
  if (options.list) {
    await listWorkspaces();
    return;
  }

  if (options.show) {
    await showWorkspaceDetails(options.show);
    return;
  }

  if (options.resume) {
    await resumeWorkspace(options.resume);
    return;
  }

  // Default: list all workspaces
  await listWorkspaces();
}

export { showWorkspace, WorkspaceOptions };
