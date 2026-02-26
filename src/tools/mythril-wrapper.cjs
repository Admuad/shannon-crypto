/**
 * Mythril Wrapper
 * Wrapper for Mythril symbolic execution analyzer
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class MythrilWrapper {
  constructor() {
    this.binaryPath = process.env.MYTHRIL_PATH || 'mythril';
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
  }

  /**
   * Check if Mythril is installed
   */
  async checkInstallation() {
    try {
      const { stdout } = await this.execCommand(`${this.pythonPath} -m mythril --version`);
      const version = stdout.trim();
      console.log(`✅ Mythril found: ${version}`);
      return true;
    } catch (error) {
      console.error('❌ Mythril not found in PATH');
      console.error('Install: pip install mythril');
      return false;
    }
  }

  /**
   * Run Mythril analysis
   */
  async analyze(config) {
    const spinner = 'Running Mythril...';

    try {
      // Build command
      const args = [this.binaryPath, '-x', config.target];

      if (config.solcVersion) {
        args.push('--solv', config.solcVersion);
      }

      if (config.maxDepth) {
        args.push('--max-depth', config.maxDepth.toString());
      }

      const timeout = config.timeout || 300000; // 5 minutes default

      const startTime = Date.now();

      // Execute Mythril
      const { stdout, stderr } = await this.execCommand(args.join(' '), { timeout });

      spinner = `Mythril complete (${((Date.now() - startTime) / 1000).toFixed(1)}s)`;

      // Parse results
      return this.parseResults(stdout, stderr, config);
    } catch (error) {
      spinner = `Mythril analysis failed: ${error.message}`;
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
  parseResults(stdout, stderr, config) {
    const result = {
      vulnerabilities: [],
      executionTraces: [],
      counterexamples: [],
    };

    // Parse vulnerabilities from output
    const vulnPattern = /Error: (.+?) at (.+?)\((\d+)-(\d+)\)/g;
    const matches = stdout.match(vulnPattern);

    if (matches) {
      const vulns = [];

      for (const match of matches) {
        const fullMatch = match[0];
        const type = fullMatch.substring(6).trim();
        const location = fullMatch.split(' at ')[1];
        
        let severity = 'medium';
        if (type.includes('reentrancy') || type.includes('delegatecall') || type.includes('call injection')) {
          severity = 'critical';
        } else if (type.includes('overflow') || type.includes('underflow')) {
          severity = 'critical';
        } else if (type.includes('access control') || type.includes('tx.origin')) {
          severity = 'high';
        }

        vulns.push({
          id: `MYTH-${vulns.length + 1}`,
          title: type,
          severity,
          description: `Mythril detected: ${type}`,
          location: {
            file: 'unknown',
            lineStart: 0,
            lineEnd: 0,
          },
          tool: 'Mythril',
          address: config.target,
          type,
          confidence: 'medium',
        });
      }

      result.vulnerabilities = vulns;
    }

    return result;
  }

  /**
   * Helper: Execute command with timeout
   */
  async execCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const opts = {
        timeout: options.timeout || 300000,
        maxBuffer: 50 * 1024 * 1024, // 50MB
        ...options,
      };

      exec(command, opts, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }
}

module.exports = MythrilWrapper;
