/**
 * Slither Tool Wrapper
 * Wrapper around Slither static analysis tool
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import ora from 'ora';

interface SlitherResult {
  vulnerabilities: any[];
  detectors: string[];
  print: string;
  json: string;
}

interface SlitherConfig {
  target: string;
  detectors?: string[];
  solcVersion?: string;
  filterPaths?: string[];
  excludePaths?: string[];
  outputJson?: string;
  outputTxt?: string;
  outputMarkdown?: string;
}

export class SlitherWrapper {
  private binaryPath: string;
  private pythonPath: string;

  constructor() {
    // Find Slither binary
    this.binaryPath = process.env.SLITHER_PATH || 'slither';
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
  }

  /**
   * Check if Slither is installed
   */
  async checkInstallation(): Promise<boolean> {
    try {
      const { stdout } = await exec(`${this.pythonPath} -m slither --version`, {
        timeout: 10000,
      });

      const version = stdout.trim();
      console.log(`✅ Slither found: ${version}`);
      return true;
    } catch (error: any) {
      console.error('❌ Slither not found in PATH');
      console.error('Install: pip install slither-analyzer');
      return false;
    }
  }

  /**
   * Run Slither analysis
   */
  async analyze(config: SlitherConfig): Promise<SlitherResult> {
    const spinner = ora('Running Slither...').start();

    try {
      // Build command
      const args: string[] = [this.binaryPath, config.target];

      // Add detectors
      if (config.detectors && config.detectors.length > 0) {
        args.push('--detectors', config.detectors.join(','));
      }

      // Add solc version
      if (config.solcVersion) {
        args.push('--solc', config.solcVersion);
      }

      // Add filter paths
      if (config.filterPaths) {
        args.push('--filter-paths', ...config.filterPaths);
      }

      // Add exclude paths
      if (config.excludePaths) {
        args.push('--exclude', ...config.excludePaths);
      }

      // Add JSON output
      if (config.outputJson) {
        args.push('--json', '-o', config.outputJson);
      }

      // Add text output
      if (config.outputTxt) {
        args.push('--print', '-o', config.outputTxt);
      }

      // Add markdown output
      if (config.outputMarkdown) {
        args.push('--markdown', '-o', config.outputMarkdown);
      }

      // Set timeout based on contract size
      const timeout = 300000; // 5 minutes

      // Execute Slither
      const { stdout, stderr } = await exec(args.join(' '), {
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      spinner.succeed('Slither analysis complete');

      // Parse results
      return this.parseResults(stdout, stderr, config);
    } catch (error: any) {
      spinner.fail(`Slither analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse Slither output into structured format
   */
  private parseResults(stdout: string, stderr: string, config: SlitherConfig): SlitherResult {
    const result: SlitherResult = {
      vulnerabilities: [],
      detectors: [],
      print: stdout,
      json: '',
    };

    // Extract JSON output if available
    if (config.outputJson) {
      try {
        const jsonMatch = stdout.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          result.json = jsonMatch[0];
          const parsed = JSON.parse(result.json);
          result.vulnerabilities = parsed.results || parsed.vulnerabilities || [];
        }
      } catch (error: any) {
        console.warn('Failed to parse Slither JSON output:', error.message);
      }
    }

    // Parse vulnerabilities from text output
    const vulnPattern = /([^:]+):.*?\n/g;
    const matches = stdout.match(vulnPattern);

    if (matches) {
      result.detectors = [...new Set(matches.map((m) => m.split(':')[0].trim()))];
    }

    // Extract common vulnerability types
    const reentrancyMatches = stdout.match(/reentrancy/gi);
    const overflowMatches = stdout.match(/overflow/gi);
    const accessControlMatches = stdout.match(/(access.control|access-control)/gi);

    const vulnerabilities: any[] = [];

    if (reentrancyMatches) {
      vulnerabilities.push({
        type: 'reentrancy',
        severity: 'critical',
        count: reentrancyMatches.length,
      });
    }

    if (overflowMatches) {
      vulnerabilities.push({
        type: 'overflow',
        severity: 'critical',
        count: overflowMatches.length,
      });
    }

    if (accessControlMatches) {
      vulnerabilities.push({
        type: 'access-control',
        severity: 'high',
        count: accessControlMatches.length,
      });
    }

    result.vulnerabilities = vulnerabilities;

    return result;
  }

  /**
   * List all available detectors
   */
  async listDetectors(): Promise<string[]> {
    try {
      const { stdout } = await exec(`${this.binaryPath} --list-detectors`, {
        timeout: 30000,
      });

      return stdout.trim().split('\n').filter((line) => line.trim());
    } catch (error: any) {
      console.error('Failed to list detectors:', error.message);
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

  /**
   * Extract Solidity version from contract or directory
   */
  async detectSolidityVersion(target: string): Promise<string> {
    try {
      const { stdout } = await exec(`grep -r "pragma solidity" ${target} 2>/dev/null || echo ""`, {
        timeout: 10000,
      });

      const matches = stdout.match(/pragma solidity\s+([\d.]+)/gi);

      if (matches && matches.length > 0) {
        // Return most common version
        const versions = matches.map((m) => m[1]);
        const counts: Record<string, number> = {};

        versions.forEach((v) => {
          counts[v] = (counts[v] || 0) + 1;
        });

        return Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0];
      }

      return '0.8.20'; // Default fallback
    } catch (error: any) {
      console.warn('Failed to detect Solidity version:', error.message);
      return '0.8.20';
    }
  }
}

export default SlitherWrapper;
