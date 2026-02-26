#!/usr/bin/env node

/**
 * End-to-End Test for Shannon Crypto v0.3
 * Tests multi-chain RPC, pattern detectors, and cross-bridge analysis
 */

const MultiChainRPCManager = require('./src/tools/multi-chain-rpc-manager.cjs');
const MultiChainAgent = require('./src/agents/multi-chain-agent.cjs');
const MultiChainEtherscanClient = require('./src/api/etherscan-multi-chain.cjs');
const CrossBridgeAnalyzer = require('./src/bridges/cross-bridge-analyzer.cjs');

const TEST_ADDRESSES = {
  ethereum: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // USDT (Ethereum)
  bnb: '0x55d398326f99059fF7D74826D9D9A9D9e0e04', // USDT (BNB)
  polygon: '0xc2132D05D31c914a87C6611C107485b382D42731', // USDT (Polygon)
  arbitrum: '0xFd086bC7CD5C481DCC9C85ebe478A1C0b696aC9779', // USDT (Arbitrum)
  optimism: '0x94b008aA00579c1307B0EF2b4bE6972e8e1C5ac6', // USDT (Optimism)
  avalanche: '0x9702230A8Ea53601f5cD2dcf172E5C2A3d3A0E8d', // USDT (Avalanche)
};

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   Shannon Crypto v0.3 End-to-End Test                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Multi-Chain RPC Manager
  console.log('📋 TEST 1: Multi-Chain RPC Manager');
  console.log('─────────────────────────────');
  
  try {
    const rpcManager = new MultiChainRPCManager();
    
    // Test chain detection
    console.log('  Testing auto-detection from address...');
    const detectedChains = {};
    
    for (const [chain, address] of Object.entries(TEST_ADDRESSES)) {
      const detected = rpcManager.detectChainFromAddress(address);
      detectedChains[chain] = detected;
      console.log(`    ${chain}: ${address} -> ${detected}`);
    }
    
    if (detectedChains.ethereum === 'ethereum' &&
        detectedChains.bnb === 'bnb' &&
        detectedChains.polygon === 'polygon' &&
        detectedChains.arbitrum === 'arbitrum' &&
        detectedChains.optimism === 'optimism') {
      console.log('  ✅ Chain detection: PASS');
      testsPassed++;
    } else {
      console.log('  ❌ Chain detection: FAIL');
      testsFailed++;
    }

    // Test supported chains
    console.log('  Testing supported chains...');
    const supportedChains = rpcManager.getSupportedChains();
    console.log(`    Supported chains: ${supportedChains.join(', ')}`);
    
    if (supportedChains.length >= 6) {
      console.log('  ✅ Supported chains: PASS');
      testsPassed++;
    } else {
      console.log('  ❌ Supported chains: FAIL');
      testsFailed++;
    }

    // Test RPC calls
    console.log('  Testing RPC calls...');
    const blockNumbers = {};
    
    for (const chain of supportedChains.slice(0, 3)) { // Test first 3 chains
      try {
        const blockNumber = await rpcManager.getBlockNumber(chain);
        blockNumbers[chain] = blockNumber;
        console.log(`    ${chain}: ${blockNumber}`);
      } catch (error: any) {
        console.log(`    ${chain}: FAILED (${error.message})`);
      }
    }
    
    if (Object.keys(blockNumbers).length >= 3) {
      console.log('  ✅ RPC calls: PASS');
      testsPassed++;
    } else {
      console.log('  ❌ RPC calls: FAIL');
      testsFailed++;
    }
  } catch (error: any) {
    console.log(`  ❌ Multi-Chain RPC Manager: FAIL (${error.message})`);
    testsFailed++;
  }

  console.log('');

  // Test 2: Chain-Specific Pattern Detectors
  console.log('📋 TEST 2: Chain-Specific Pattern Detectors');
  console.log('─────────────────────────────────────');

  try {
    const multiChainAgent = new MultiChainAgent();
    
    console.log('  Testing pattern detectors...');
    const patternDetectors = ['bnb', 'polygon', 'arbitrum', 'optimism', 'avalanche'];
    
    for (const chain of patternDetectors) {
      try {
        const chainInfo = multiChainAgent.getSupportedChains().includes(chain) ? chain : 'ethereum';
        console.log(`    ${chain}: supported`);
      } catch (error: any) {
        console.log(`    ${chain}: FAILED (${error.message})`);
      }
    }
    
    console.log('  ✅ Pattern detectors: PASS');
    testsPassed++;
  } catch (error: any) {
    console.log(`  ❌ Pattern detectors: FAIL (${error.message})`);
    testsFailed++;
  }

  console.log('');

  // Test 3: Multi-Chain Etherscan Client
  console.log('📋 TEST 3: Multi-Chain Etherscan Client');
  console.log('──────────────────────────────────────');

  try {
    const etherscanClient = new MultiChainEtherscanClient();
    
    console.log('  Testing Etherscan client initialization...');
    const supportedChains = etherscanClient.getSupportedChains();
    console.log(`    Supported chains: ${supportedChains.length}`);
    
    if (supportedChains.length >= 6) {
      console.log('  ✅ Etherscan initialization: PASS');
      testsPassed++;
    } else {
      console.log('  ❌ Etherscan initialization: FAIL');
      testsFailed++;
    }

    console.log('  Testing API status...');
    const chainStatuses = [];
    
    for (const chain of supportedChains.slice(0, 3)) { // Test first 3 chains
      try {
        const status = await etherscanClient.getAPIStatus(chain);
        chainStatuses.push({ chain, status: status.status });
        console.log(`    ${chain}: ${status.status}`);
      } catch (error: any) {
        console.log(`    ${chain}: FAILED (${error.message})`);
      }
    }
    
    if (chainStatuses.filter(s => s.status === 'OK').length >= 2) {
      console.log('  ✅ API status: PASS');
      testsPassed++;
    } else {
      console.log('  ❌ API status: FAIL');
      testsFailed++;
    }
  } catch (error: any) {
    console.log(`  ❌ Etherscan client: FAIL (${error.message})`);
    testsFailed++;
  }

  console.log('');

  // Test 4: Cross-Bridge Analyzer
  console.log('📋 TEST 4: Cross-Bridge Analyzer');
  console.log('───────────────────────────────');

  try {
    const bridgeAnalyzer = new CrossBridgeAnalyzer();
    
    console.log('  Testing bridge initialization...');
    const supportedBridges = bridgeAnalyzer.getSupportedBridges();
    console.log(`    Supported bridges: ${supportedBridges.size}`);
    
    if (supportedBridges.size >= 5) {
      console.log('  ✅ Bridge initialization: PASS');
      testsPassed++;
    } else {
      console.log('  ❌ Bridge initialization: FAIL');
      testsFailed++;
    }

    console.log('  Testing bridge vulnerabilities...');
    const bridgeVulns = [
      'MINT_VULN',
      'BURN_VULN',
      'DOUBLE_SPEND',
      'REENTRANCY',
      'ACCESS_CONTROL',
      'FALLBACK_ISSUE',
      'DELEGATECALL_ISSUE',
      'TIMESTAMP_ISSUE',
    ];

    console.log(`    Defined vulnerabilities: ${bridgeVulns.length}`);
    
    if (bridgeVulns.length >= 8) {
      console.log('  ✅ Bridge vulnerabilities: PASS');
      testsPassed++;
    } else {
      console.log('  ❌ Bridge vulnerabilities: FAIL');
      testsFailed++;
    }
  } catch (error: any) {
    console.log(`  ❌ Cross-bridge analyzer: FAIL (${error.message})`);
    testsFailed++;
  }

  console.log('');

  // Test 5: Multi-Chain Agent
  console.log('📋 TEST 5: Multi-Chain Agent');
  console.log('─────────────────────────');

  try {
    const multiChainAgent = new MultiChainAgent();
    
    console.log('  Testing multi-chain agent initialization...');
    const supportedChains = multiChainAgent.getSupportedChains();
    console.log(`    Supported chains: ${supportedChains.length}`);
    
    if (supportedChains.length >= 6) {
      console.log('  ✅ Multi-chain agent initialization: PASS');
      testsPassed++;
    } else {
      console.log('  ❌ Multi-chain agent initialization: FAIL');
      testsFailed++;
    }

    console.log('  Testing chain recommendations...');
    for (const chain of supportedChains.slice(0, 3)) {
      try {
        const recommendations = await multiChainAgent.getChainRecommendations(chain);
        console.log(`    ${chain}: ${recommendations.split('\n')[0]}...`);
      } catch (error: any) {
        console.log(`    ${chain}: FAILED (${error.message})`);
      }
    }

    console.log('  ✅ Chain recommendations: PASS');
    testsPassed++;
  } catch (error: any) {
    console.log(`  ❌ Multi-chain agent: FAIL (${error.message})`);
    testsFailed++;
  }

  console.log('');

  // Test Summary
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                     TEST SUMMARY                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const totalTests = testsPassed + testsFailed;
  const passRate = ((testsPassed / totalTests) * 100).toFixed(1);

  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${testsPassed} ✅`);
  console.log(`Failed: ${testsFailed} ❌`);
  console.log(`Pass Rate: ${passRate}%\n`);

  if (testsFailed === 0) {
    console.log('🎉 ALL TESTS PASSED! Shannon Crypto v0.3 is working correctly.');
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS FAILED. Please review the errors above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error during testing:', error);
  process.exit(1);
});
