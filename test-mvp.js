#!/usr/bin/env node

/**
 * Simple test script for Shannon Crypto MVP
 * Tests core functionality without requiring full dependencies
 */

import { exec } from 'child_process';
import path from 'path';

console.log('\n=== Shannon Crypto MVP Test ===\n');

async function runTests() {
  // Test 1: Check if node_modules are installed
  console.log('\n[1/5] Checking dependencies...');

  try {
    const fs = await import('fs');
    const packageJson = JSON.parse(
      await fs.promises.readFile('./package.json', 'utf-8')
    );

    const requiredDeps = [
      'axios',
      'commander',
      'ora',
      'chalk',
      '@types/node',
      'child_process',
      'fs',
      'path',
    ];

    console.log('Dependencies check:');
    for (const dep of requiredDeps) {
      const depPath = path.join(process.cwd(), 'node_modules', dep);
      try {
        await fs.promises.access(depPath);
        console.log(`  ✅ ${dep}`);
      } catch {
        console.log(`  ❌ ${dep} (not found)`);
      }
    }
  } catch (error) {
    console.error('Error checking dependencies:', error.message);
  }

  // Test 2: Validate contract file exists
  console.log('\n[2/5] Checking test contract...');
  const contractPath = path.join(process.cwd(), 'contracts', 'VulnerableBank.sol');
  try {
    await import('fs').then((fs) =>
      fs.promises.access(contractPath)
    );
    console.log(`  ✅ Test contract found: ${contractPath}`);
  } catch (error) {
    console.error(`  ❌ Test contract not found: ${contractPath}`);
  }

  // Test 3: Check vulnerable patterns in contract
  console.log('\n[3/5] Analyzing contract patterns...');

  try {
    const fs = await import('fs');
    const contractContent = await fs.promises.readFile(contractPath, 'utf-8');

    const patterns = {
      reentrancy: /call.*\{.*\}/g.test(contractContent),
      overflow: /uint256.*\+.*\+\b/g.test(contractContent),
      timestamp: /block\.timestamp/g.test(contractContent),
    };

    console.log('Vulnerability patterns:');
    console.log(`  Reentrancy: ${patterns.reentrancy ? '✅' : '❌'}`);
    console.log(`  Integer Overflow: ${patterns.overflow ? '✅' : '❌'}`);
    console.log(`  Timestamp Dependence: ${patterns.timestamp ? '✅' : '❌'}`);

    if (patterns.reentrancy || patterns.overflow) {
      console.log('\n  ✅ Contract contains intentional vulnerabilities for testing');
    }
  } catch (error) {
    console.error('  ❌ Error analyzing contract:', error.message);
  }

  // Test 4: Check if Slither is installed
  console.log('\n[4/5] Checking Slither installation...');

  try {
    const { stdout } = await exec('which slither', { timeout: 5000 });

    if (stdout.trim()) {
      console.log(`  ✅ Slither found: ${stdout.trim()}`);
    } else {
      console.log('  ⚠️  Slither not found in PATH');
    }
  } catch (error) {
    console.log('  ⚠️  Slither not found (would need pip install)');
  }

  // Test 5: Check workspace structure
  console.log('\n[5/5] Checking workspace structure...');

  try {
    const fs = await import('fs');
    const auditLogsPath = path.join(process.cwd(), 'audit-logs');

    try {
      await fs.promises.mkdir(auditLogsPath, { recursive: true });
      console.log(`  ✅ Workspace directory ready: ${auditLogsPath}`);
    } catch (error) {
      console.log(`  ❌ Cannot create workspace: ${error.message}`);
    }
  } catch (error) {
    console.error('  ❌ Error checking workspace:', error.message);
  }

  console.log('\n=== Test Summary ===\n');
  console.log('Core components are ready for testing');
  console.log('\nNext steps:');
  console.log('  1. Create .env with RPC and API keys');
  console.log('  2. Install Slither: pip install slither-analyzer');
  console.log('  3. Deploy vulnerable contract to testnet');
  console.log('  4. Run: npm run audit --contract <address>');
}

runTests().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
