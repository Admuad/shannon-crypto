/**
 * Medusa Wrapper
 * Value mutation fuzzing for smart contracts
 * Finds edge cases and boundary conditions
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class MedusaWrapper {
  constructor() {
    this.binaryPath = process.env.MEDUSA_PATH || 'medusa';
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
  }

  /**
   * Check if Medusa is installed
   */
  async checkInstallation() {
    try {
      const { stdout } = await exec(`${this.pythonPath} -c "import medusa; print(medusa.__version__)"`, {
        timeout: 10000,
      });

      const version = stdout.trim();
      console.log(`✅ Medusa found: ${version}`);
      return true;
    } catch (error) {
      console.error('❌ Medusa not found in PATH');
      console.error('Install: pip install medusa');
      return false;
    }
  }

  /**
   * Run Medusa fuzzing
   */
  async analyze(config) {
    const spinner = 'Running Medusa...';

    try {
      // Build command
      const args = [
        'medusa',
        'fuzz',
        '--target', config.contract,
        '--rpc', config.rpcUrl,
        '--contract-name', config.contractName || 'Target',
      ];

      // Add test config
      if (config.testLimit) {
        args.push('--test-limit', config.testLimit.toString());
      }

      if (config.seed) {
        args.push('--seed', config.seed);
      }

      const timeout = config.timeout || 600000; // 10 minutes default
      const startTime = Date.now();

      // Execute Medusa
      const { stdout, stderr } = await this.execCommand(args.join(' '), {
        timeout: timeout + 10000,
      });

      spinner = `Medusa complete (${((Date.now() - startTime) / 1000).toFixed(1)}s)`;

      // Parse results
      return this.parseResults(stdout, stderr, config);
    } catch (error) {
      spinner = `Medusa fuzzing failed: ${error.message}`;
      return {
        mutations: [],
        failingInputs: [],
        error: error.message,
      };
    }
  }

  /**
   * Parse Medusa output
   */
  parseResults(stdout, stderr, config) {
    const result = {
      mutations: [],
      failingInputs: [],
    };

    // Parse successful mutations
    const mutationPattern = /Found input: (.+?)\s+/g;
    const matches = stdout.match(mutationPattern);

    if (matches) {
      for (const match of matches) {
        const input = match[1];
        const mutation = input.match(/Mutation: (\w+)/)?.[1] || 'unknown';

        result.mutations.push({
          input,
          mutation,
          success: true,
        });
      }
    }

    // Parse failing test cases
    const failurePattern = /Test failed: (.+)/g;
    const failureMatches = stdout.match(failurePattern);

    if (failureMatches) {
      for (const match of failureMatches) {
        const test = match[1];
        const reason = test.match(/reason: (.+)/)?.[1] || 'unknown';

        result.failingInputs.push({
          test,
          reason,
          success: false,
        });
      }
    }

    return result;
  }

  /**
   * Check if Solidity code exists
   */
  async checkSolidityCode(target) {
    const exists = fs.existsSync(target);
    return exists;
  }

  /**
   * Generate default Medusa config
   */
  generateConfig(contract, rpcUrl) {
    return `
# Medusa Configuration
# Shannon Crypto Auto-Generated

# RPC Endpoint
rpc: ${rpcUrl}

# Target
contract: ${contract}
contract-name: Target

# Fuzzing
test-limit: 10000
max-time: 600
    `.trim();
  }

  /**
   * Execute command with timeout
   */
  async execCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const opts = {
        timeout: options.timeout || 600000,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
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

module.exports = MedusaWrapper;
