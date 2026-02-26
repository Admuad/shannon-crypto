/**
 * Mythril Wrapper
 * Wrapper for Mythril symbolic execution analyzer
 * Uses deep path analysis to find vulnerabilities
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';

interface MythrilConfig {
  target: string;
  solcVersion?: string;
  maxDepth?: number;
  timeout?: number;
  outputJson?: string;
}

interface MythrilResult {
  vulnerabilities: any[];
  executionTraces: any[];
  counterexamples: any[];
  error?: string;
}

interface MythrilVulnerability {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location: {
    file: string;
    lineStart: number;
    lineEnd: number;
  };
  tool: string;
  address: string;
  type: string;
  confidence: 'high' | 'medium' | 'low';
}

export class MythrilWrapper {
  private binaryPath: string;
  private pythonPath: string;

  constructor() {
    this.binaryPath = process.env.MYTHRIL_PATH || 'myth';
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
  }

  /**
   * Check if Mythril is installed
   */
  async checkInstallation(): Promise<boolean> {
    try {
      const { stdout } = await exec(`${this.pythonPath} -m mythril --version`, {
        timeout: 10000,
      });

      const version = stdout.trim();
      console.log(chalk.green(`✅ Mythril found: ${version}`));
      return true;
    } catch (error: any) {
      console.error(chalk.red('❌ Mythril not found in PATH'));
      console.error(chalk.gray('Install: pip install mythril'));
      return false;
    }
  }

  /**
   * Run Mythril analysis
   */
  async analyze(config: MythrilConfig): Promise<MythrilResult> {
    const spinner = ora('Running Mythril...').start();

    try {
      // Build command
      const args = [this.binaryPath, '-x', config.target];

      // Add solc version
      if (config.solcVersion) {
        args.push('--solv', config.solcVersion);
      }

      // Add max depth
      if (config.maxDepth) {
        args.push('--max-depth', config.maxDepth.toString());
      }

      // Add timeout
      const timeout = config.timeout || 300000; // 5 minutes default
      args.push('--timeout', timeout.toString());

      // Add JSON output
      if (config.outputJson) {
        args.push('-o', config.outputJson);
      }

      const startTime = Date.now();

      // Execute Mythril
      const { stdout, stderr } = await exec(args.join(' '), {
        timeout: timeout + 10000, // Add buffer
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      });

      spinner.succeed(`Mythril complete (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);

      // Parse results
      return this.parseResults(stdout, stderr, config);
    } catch (error: any) {
      spinner.fail(`Mythril analysis failed: ${error.message}`);
      return {
        vulnerabilities: [],
        executionTraces: [],
        counterexamples: [],
        error: error.message,
      };
    }
  }

  /**
   * Parse Mythril output into structured format
   */
  private parseResults(stdout: string, stderr: string, config: MythrilConfig): MythrilResult {
    const result: MythrilResult = {
      vulnerabilities: [],
      executionTraces: [],
      counterexamples: [],
    };

    // Parse JSON output if available
    if (config.outputJson) {
      try {
        const jsonMatch = stdout.match(/\{[\s\S]*?\}/g);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          result.vulnerabilities = parsed.results || parsed.vulnerabilities || [];
        }
      } catch (error: any) {
        console.warn(chalk.yellow('Failed to parse Mythril JSON output:', error.message));
      }
    }

    // Parse text output
    const vulnPattern = /Error: (.+?) at (.+?)\((\d+)-(\d+)\)/g;
    const matches = stdout.match(vulnPattern);

    if (matches) {
      const vulns: MythrilVulnerability[] = [];

      for (const match of matches) {
        const fullMatch = match[0];
        const description = fullMatch.substring(6); // Skip "Error: "

        const type = description.split(' at ')[0];
        const location = fullMatch.split(' at ')[1];

        let severity: MythrilVulnerability['severity'] = 'medium';
        if (type.includes('reentrancy') || type.includes('delegatecall') || type.includes('call injection')) {
          severity = 'critical';
        } else if (type.includes('overflow') || type.includes('underflow')) {
          severity = 'critical';
        } else if (type.includes('access control') || type.includes('tx.origin')) {
          severity = 'high';
        }

        // Parse location
        const file = location.split(':')[0];
        const lineParts = location.split(':')[1]?.split('(');
        const lineStart = parseInt(lineParts?.[0] || '0');
        const lineEnd = parseInt(lineParts?.[1]?.split(')')[0] || lineStart.toString()) || lineStart;

        vulns.push({
          id: `MYTH-${vulns.length + 1}`,
          title: type,
          severity,
          description: description,
          location: {
            file,
            lineStart,
            lineEnd,
          },
          tool: 'Mythril',
          address: config.target,
          type,
          confidence: 'medium', // Mythril confidence level
        });
      }

      result.vulnerabilities = vulns;
    }

    return result;
  }

  /**
   * List all available analyzers
   */
  async listAnalyzers(): Promise<string[]> {
    try {
      const { stdout } = await exec(`${this.binaryPath} --list-analyzers`, {
        timeout: 30000,
      });

      return stdout.trim().split('\n').filter((line) => line.trim());
    } catch (error: any) {
      console.error('Failed to list Mythril analyzers:', error.message);
      return [];
    }
  }

  /**
   * Check if Solidity code exists
   */
  async checkSolidityCode(target: string): Promise<boolean> {
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(target);

    if (isAddress) {
      // For address, try to fetch from Etherscan
      return true; // We'll handle fetching separately
    }

    // For file path, check if file exists
    try {
      await fs.access(target);
      return true;
    } catch (error: any) {
      return false;
    }
  }
}

export default MythrilWrapper;
