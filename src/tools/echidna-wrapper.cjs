/**
 * Echidna Wrapper
 * Property-based fuzzing for smart contracts
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class EchidnaWrapper {
  constructor() {
    this.binaryPath = 'echidna';
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
  }

  /**
   * Check if Echidna is installed
   */
  async checkInstallation() {
    try {
      const { stdout } = await exec(`${this.pythonPath} -c "import echidna; print(echidna.__version__)"`, {
        timeout: 10000,
      });

      const version = stdout.trim();
      console.log(`✅ Echidna found: ${version}`);
      return true;
    } catch (error) {
      console.error('❌ Echidna not found in PATH');
      console.error('Install: pip install echidna-evm');
      return false;
    }
  }

  /**
   * Run Echidna fuzzing campaign
   */
  async analyze(config) {
    const spinner = 'Running Echidna fuzzing...';

    try {
      // Build command
      const args = [
        'echidna',
        '--contract', config.contract,
        '--test-mode', 'assertion', // Test invariant violations
        '--config', config.config || 'echidna.yaml',
      ];

      const timeout = config.timeout || 600000; // 10 minutes default
      const startTime = Date.now();

      // Execute Echidna
      const { stdout, stderr } = await this.execCommand(args.join(' '), {
        timeout: timeout + 10000,
      });

      spinner = `Echidna complete (${((Date.now() - startTime) / 1000).toFixed(1)}s)`;

      // Parse results
      return this.parseResults(stdout, stderr, config);
    } catch (error) {
      spinner = `Echidna analysis failed: ${error.message}`;
      return {
        violations: [],
        failingTests: [],
        error: error.message,
      };
    }
  }

  /**
   * Parse Echidna output into structured format
   */
  parseResults(stdout, stderr, config) {
    const result = {
      violations: [],
      failingTests: [],
    };

    // Parse assertion failures
    const assertionPattern = /Assertion failed: (.+)/g;
    const assertionMatches = stdout.match(assertionPattern);

    if (assertionMatches) {
      for (const match of assertionMatches) {
        const description = match[1];
        const violation = {
          id: `ECHIDNA-${result.violations.length + 1}`,
          title: 'Assertion Violation',
          severity: 'critical',
          description,
          location: {
            file: config.contract,
            lineStart: 0,
            lineEnd: 0,
          },
          tool: 'Echidna',
          type: 'invariant-violation',
          confidence: 'high',
        };

        result.violations.push(violation);
      }
    }

    // Parse test failures
    const failurePattern = /Test failed: (.+)/g;
    const failureMatches = stdout.match(failurePattern);

    if (failureMatches) {
      for (const match of failureMatches) {
        const test = match[1];
        const failingTest = {
          test,
          reason: 'Failing test case',
        };

        result.failingTests.push(failingTest);
      }
    }

    return result;
  }

  /**
   * Generate default echidna config
   */
  generateConfig(contract) {
    return `
# Echidna Configuration
# Shannon Crypto Auto-Generated

contract: ${contract}
testMode: assertion
testLimit: 50000
corpusDir: .
deployer: "foundry-discover"
filterFunctions: "(^initialize|public)"
checkAsserts: true
    `.trim();
  }

  /**
   * Check if Solidity code exists
   */
  async checkSolidityCode(target) {
    const exists = fs.existsSync(target);
    return exists;
  }
}

module.exports = EchidnaWrapper;
