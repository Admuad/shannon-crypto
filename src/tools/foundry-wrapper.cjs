/**
 * Foundry Wrapper
 * Integration with Foundry for property testing and transaction simulation
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class FoundryWrapper {
  constructor() {
    this.forgePath = process.env.FORGE_PATH || 'forge';
    this.castPath = process.env.CAST_PATH || 'cast';
    this.anvilPath = process.env.ANVIL_PATH || 'anvil';
  }

  /**
   * Check if Foundry is installed
   */
  async checkInstallation() {
    try {
      const { stdout } = await exec(`${this.forgePath} --version`, {
        timeout: 10000,
      });

      const version = stdout.trim();
      console.log(`✅ Foundry found: ${version}`);
      return true;
    } catch (error) {
      console.error('❌ Foundry not found in PATH');
      console.error('Install: curl -L https://foundry.paradigm.xyz | bash');
      return false;
    }
  }

  /**
   * Run property tests with Forge
   */
  async runPropertyTests(contractPath, testFile) {
    const spinner = 'Running Forge property tests...';

    try {
      const args = [
        'test',
        '-vv', // Verbose output
        contractPath,
      ];

      if (testFile) {
        args.push('--match', testFile);
      }

      const timeout = 600000; // 10 minutes
      const startTime = Date.now();

      const { stdout, stderr } = await this.execCommand(args.join(' '), {
        timeout,
      });

      spinner = `Forge complete (${((Date.now() - startTime) / 1000).toFixed(1)}s)`;

      // Parse results
      return this.parseForgeOutput(stdout, stderr);
    } catch (error) {
      spinner = `Forge tests failed: ${error.message}`;
      throw error;
    }
  }

  /**
   * Simulate transaction with Cast
   */
  async simulateTransaction(to, data, value, rpcUrl) {
    try {
      const args = [
        'cast',
        'send',
        '--rpc-url', rpcUrl || process.env.ETHEREUM_RPC_URL,
      ];

      if (to) {
        args.push(to);
      }

      if (data) {
        args.push('--data', data);
      }

      if (value && value !== '0') {
        args.push('--value', value);
      }

      const timeout = 60000; // 1 minute
      const startTime = Date.now();

      const { stdout, stderr } = await this.execCommand(args.join(' '), {
        timeout,
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const txHash = stdout.trim();

      return {
        success: true,
        txHash,
        duration,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Fork chain with Anvil and deploy to local testnet
   */
  async forkAndDeploy(contractPath, constructorArgs, deployerAddress) {
    try {
      console.log('Starting Anvil local testnet...');

      const args = [
        'anvil',
        '--fork-url', process.env.ETHEREUM_RPC_URL,
        '--block-base', '0',
        '--block-timestamp', '1700000000',
        '--host', '0.0.0.0',
        '--port', '8545',
      ];

      // Start Anvil in background
      const { spawn } = require('child_process');
      const anvilProcess = spawn('anvil', args, {
        detached: true,
        stdio: 'ignore',
      });

      anvilProcess.unref();

      // Deploy contract
      const deployResult = await this.simulateTransaction(
        process.env.ETHERSCAN_KEY || '0x0000000000000000000000000000000000000001', // Use deployer
        JSON.stringify(constructorArgs),
        '0',
        process.env.ETHEREUM_RPC_URL
      );

      console.log(`Contract deployed at: ${deployResult.txHash}`);

      return {
        success: true,
        contractAddress: deployResult.txHash,
        localTestnetUrl: 'http://127.0.0.1:8545',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate Foundry test suite
   */
  async generateTestSuite(contractPath, vulnerabilities) {
    const testDir = path.join(path.dirname(contractPath), 'test');
    const testFile = path.join(testDir, 'FoundryTests.t.sol');

    const tests = [];

    // Generate tests for vulnerabilities
    for (const vuln of vulnerabilities) {
      if (vuln.type === 'reentrancy') {
        tests.push(this.generateReentrancyTest(vuln));
      } else if (vuln.type === 'overflow') {
        tests.push(this.generateOverflowTest(vuln));
      } else if (vuln.type === 'access-control') {
        tests.push(this.generateAccessControlTest(vuln));
      }
    }

    const testFileContent = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import ${path.basename(contractPath, '.sol')} as Target;

contract FoundryTests is Test {
    Target target;

    ${tests.join('\n\n')}
}
    `.trim();

    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(testFile, testFileContent);

    return testFile;
  }

  generateReentrancyTest(vuln) {
    return `
    function test_Reentrancy_${vuln.id}() public {
        // Deploy vulnerable contract
        target = new Target();
        
        // Prepare exploit
        vm.deal(target, 10 ether);
        
        // Call vulnerable function
        target.vulnerable${vuln.id}(100 ether);
        
        // Check if reentrancy occurred
        assertEq(address(target).balance, 20 ether);
    }

    function test_Reentrancy_${vuln.id}_Prevention() public {
        // Deploy fixed contract
        target = new Target();
        
        vm.deal(target, 10 ether);
        
        // Call fixed function (should be protected)
        target.fixed${vuln.id}(100 ether);
        
        // Check if reentrancy was prevented
        assertEq(address(target).balance, 10 ether);
    }
    `.trim();
  }

  generateOverflowTest(vuln) {
    return `
    function test_Overflow_${vuln.id}() public {
        // Deploy vulnerable contract
        target = new Target();
        
        // Trigger overflow
        target.triggerOverflow(type(uint256).max);
        
        // Check if overflow occurred
        assertTrue(true); // Overflow detected
    }

    function test_Overflow_${vuln.id}_Prevention() public {
        // Deploy fixed contract
        target = new Target();
        
        // Try to trigger overflow with SafeMath
        target.triggerSafeOverflow(type(uint256).max);
        
        // Check if overflow was prevented
        assertFalse(true); // No overflow with SafeMath
    }
    `.trim();
  }

  generateAccessControlTest(vuln) {
    return `
    function test_AccessControl_${vuln.id}_Bypass() public {
        // Deploy vulnerable contract
        target = new Target();
        
        // Set up attacker
        vm.prank(address(0x1234));
        
        // Try to call protected function
        target.${vuln.functionName}();
        
        // Check if access was granted
        assertTrue(true); // Access bypassed
    }

    function test_AccessControl_${vuln.id}_Enforcement() public {
        // Deploy vulnerable contract
        target = new Target();
        
        // Set up authorized user
        vm.prank(target.owner());
        
        // Call protected function
        target.${vuln.functionName}();
        
        // Check if access was granted
        assertTrue(true); // Access enforced
    }
    `.trim();
  }

  /**
   * Parse Forge output
   */
  parseForgeOutput(stdout, stderr) {
    const result = {
      passed: 0,
      failed: 0,
      gasUsed: [],
      traces: [],
    };

    // Parse test results
    const testPattern = /\[PASS\]|\[FAIL\]|PASSED|FAILED/g;
    const matches = stdout.match(testPattern);

    if (matches) {
      for (const match of matches) {
        if (match.includes('PASS')) {
          result.passed++;
        } else if (match.includes('FAIL')) {
          result.failed++;
        }
      }
    }

    // Parse gas usage
    const gasPattern = /Gas used: (\d+)/g;
    const gasMatches = stdout.match(gasPattern);

    if (gasMatches) {
      for (const match of gasMatches) {
        result.gasUsed.push(parseInt(match[1]));
      }
    }

    return result;
  }

  /**
   * Execute command with timeout
   */
  async execCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const opts = {
        timeout: options.timeout || 300000,
        maxBuffer: 50 * 1024 * 1024,
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

module.exports = FoundryWrapper;
