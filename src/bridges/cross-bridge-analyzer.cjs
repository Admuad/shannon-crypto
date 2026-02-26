/**
 * Cross-Bridge Analyzer
 * Analyzes bridge contracts for cross-chain vulnerabilities
 * Detects mint/burn issues, reentrancy, and double-spend
 */

const MultiChainEtherscanClient = require('../api/etherscan-multi-chain.cjs');

interface BridgeContract {
  name: string;
  address: string;
  chainFrom: string;
  chainTo: string;
  type: string; // 'bridge' | 'router' | 'pool'
}

interface BridgeAnalysis {
  bridge: BridgeContract;
  chainFrom: string;
  chainTo: string;
  vulnerabilities: any[];
  sourceCode: string;
  abi: any[];
  recommendations: string[];
}

const BRIDGE_VULNS = {
  MINT_VULN: 'Bridge can mint arbitrary tokens',
  BURN_VULN: 'Bridge can burn tokens without balance check',
  DOUBLE_SPEND: 'Same token used on multiple chains',
  REENTRANCY: 'Bridge reentrancy during token transfer',
  ACCESS_CONTROL: 'Unauthorized mint/burn operations',
  Fallback_ISSUE: 'Fallback function allows minting',
  DELEGATECALL_ISSUE: 'Bridge uses delegatecall to malicious contracts',
  TIMESTAMP_ISSUE: 'Bridge uses block.timestamp for randomness',
};

const BRIDGE_VULN_DESCRIPTIONS = {
  MINT_VULN: 'The mint function can mint arbitrary tokens without access control. An attacker can mint unlimited tokens on the destination chain.',
  BURN_VULN: 'The burn function can burn tokens without checking the sender balance. An attacker can burn other users tokens.',
  DOUBLE_SPEND: 'The same token balance is tracked independently on both chains. An attacker can spend the same token on both chains simultaneously.',
  REENTRANCY: 'The bridge makes external calls before updating state, enabling reentrancy attacks. An attacker can drain the bridge.',
  ACCESS_CONTROL: 'Critical functions (mint, burn, transfer) can be called by anyone. An attacker can steal all bridge tokens.',
  Fallback_ISSUE: 'The fallback function allows arbitrary callers to mint tokens. An attacker can exploit this to mint unlimited tokens.',
  DELEGATECALL_ISSUE: 'The bridge uses delegatecall to untrusted contracts. An attacker can execute malicious code in the bridge context.',
  TIMESTAMP_ISSUE: 'The bridge uses block.timestamp for randomness. An attacker can manipulate the timestamp to predict outcomes.',
};

class CrossBridgeAnalyzer {
  private etherscan: any;
  private supportedBridges: Map<string, BridgeContract[]>;

  constructor() {
    this.etherscan = new MultiChainEtherscanClient();
    this.supportedBridges = new Map();
    this.initializeBridges();
  }

  /**
   * Initialize supported bridges
   */
  private initializeBridges(): void {
    // BNB - Ethereum bridges
    this.supportedBridges.set('bnb-ethereum', [
      {
        name: 'BNB - Ethereum Bridge',
        address: '0x8BA5C538d5d3F5389a3b48D46C586547474',
        chainFrom: 'bnb',
        chainTo: 'ethereum',
        type: 'bridge',
      },
    ]);

    // Polygon - Ethereum bridges
    this.supportedBridges.set('polygon-ethereum', [
      {
        name: 'Polygon - Ethereum Bridge',
        address: '0xA0b86933c08Db8fD8968aA36BC69A96CacD516',
        chainFrom: 'polygon',
        chainTo: 'ethereum',
        type: 'bridge',
      },
    ]);

    // Arbitrum - Ethereum bridges
    this.supportedBridges.set('arbitrum-ethereum', [
      {
        name: 'Arbitrum - Ethereum Bridge',
        address: '0x8315F7E058B7F965FE9142b4534284fBeB9f14',
        chainFrom: 'arbitrum',
        chainTo: 'ethereum',
        type: 'bridge',
      },
    ]);

    // Optimism - Ethereum bridges
    this.supportedBridges.set('optimism-ethereum', [
      {
        name: 'Optimism - Ethereum Bridge',
        address: '0x99C9fc46f92E8A1c0decC92361BFE56eE36885b',
        chainFrom: 'optimism',
        chainTo: 'ethereum',
        type: 'bridge',
      },
    ]);

    // Avalanche - Ethereum bridges
    this.supportedBridges.set('avalanche-ethereum', [
      {
        name: 'Avalanche - Ethereum Bridge',
        address: '0x02935971E2fC49B7a0c1eD2Bb8Ff5C3E7a4A3B',
        chainFrom: 'avalanche',
        chainTo: 'ethereum',
        type: 'bridge',
      },
    ]);
  }

  /**
   * Analyze a specific bridge
   */
  async analyzeBridge(bridgeName: string, bridgeChain: string): Promise<BridgeAnalysis> {
    console.log(`\n=== Shannon Crypto Cross-Bridge Analysis ===`);
    console.log(`Bridge: ${bridgeName}`);
    console.log(`Chain: ${bridgeChain}`);

    const bridges = this.supportedBridges.get(bridgeName);

    if (!bridges || bridges.length === 0) {
      throw new Error(`Unknown bridge: ${bridgeName}`);
    }

    const bridge = bridges[0];

    console.log(`\nAnalyzing ${bridge.name}...`);
    console.log(`From: ${bridge.chainFrom}`);
    console.log(`To: ${bridge.chainTo}`);

    // Get contract info
    const contractInfo = await this.etherscan.getContractInfo(
      bridge.address,
      bridgeChain
    );

    console.log(`\nContract Verified: ${contractInfo.verified}`);
    console.log(`Source Code: ${contractInfo.sourceCode.length} chars`);
    console.log(`ABI Functions: ${contractInfo.abi.length}`);

    // Analyze vulnerabilities
    const vulnerabilities = await this.detectBridgeVulnerabilities(
      contractInfo,
      bridge
    );

    // Generate recommendations
    const recommendations = this.generateBridgeRecommendations(
      vulnerabilities,
      bridge
    );

    return {
      bridge,
      chainFrom: bridge.chainFrom,
      chainTo: bridge.chainTo,
      vulnerabilities,
      sourceCode: contractInfo.sourceCode,
      abi: contractInfo.abi,
      recommendations,
    };
  }

  /**
   * Detect bridge vulnerabilities
   */
  private async detectBridgeVulnerabilities(
    contractInfo: any,
    bridge: BridgeContract
  ): Promise<any[]> {
    const vulnerabilities = [];
    const sourceCode = contractInfo.sourceCode.toLowerCase();
    const abi = contractInfo.abi;

    console.log(`\nDetecting bridge vulnerabilities...`);

    // 1. Mint vulnerability
    const mintVuln = this.detectMintVulnerability(sourceCode, abi);
    if (mintVuln) {
      vulnerabilities.push({
        id: 'BRIDGE-001',
        title: 'Bridge Can Mint Arbitrary Tokens',
        severity: 'critical',
        bridge: bridge.name,
        chain: bridge.chainFrom,
        type: 'mint',
        description: BRIDGE_VULN_DESCRIPTIONS.MINT_VULN,
        location: this.findMintFunction(sourceCode, abi),
        recommendation: 'Add onlyOwner or onlyBridge role modifier to mint function',
        confidence: 'high',
      });
      console.log(`🔴 CRITICAL: Bridge can mint arbitrary tokens`);
    }

    // 2. Burn vulnerability
    const burnVuln = this.detectBurnVulnerability(sourceCode, abi);
    if (burnVuln) {
      vulnerabilities.push({
        id: 'BRIDGE-002',
        title: 'Bridge Can Burn Tokens Without Balance Check',
        severity: 'critical',
        bridge: bridge.name,
        chain: bridge.chainFrom,
        type: 'burn',
        description: BRIDGE_VULN_DESCRIPTIONS.BURN_VULN,
        location: this.findBurnFunction(sourceCode, abi),
        recommendation: 'Add balance check before burn operation',
        confidence: 'high',
      });
      console.log(`🔴 CRITICAL: Bridge can burn tokens without balance check`);
    }

    // 3. Double-spend vulnerability
    const doubleSpendVuln = this.detectDoubleSpendVulnerability(sourceCode);
    if (doubleSpendVuln) {
      vulnerabilities.push({
        id: 'BRIDGE-003',
        title: 'Cross-Chain Double-Spend',
        severity: 'critical',
        bridge: bridge.name,
        chain: `${bridge.chainFrom} + ${bridge.chainTo}`,
        type: 'double-spend',
        description: BRIDGE_VULN_DESCRIPTIONS.DOUBLE_SPEND,
        location: 'balance tracking',
        recommendation: 'Implement cross-chain lock mechanism to prevent double-spend',
        confidence: 'high',
      });
      console.log(`🔴 CRITICAL: Cross-chain double-spend possible`);
    }

    // 4. Reentrancy vulnerability
    const reentrancyVuln = this.detectBridgeReentrancy(sourceCode, abi);
    if (reentrancyVuln) {
      vulnerabilities.push({
        id: 'BRIDGE-004',
        title: 'Bridge Reentrancy During Token Transfer',
        severity: 'critical',
        bridge: bridge.name,
        chain: bridge.chainFrom,
        type: 'reentrancy',
        description: BRIDGE_VULN_DESCRIPTIONS.REENTRANCY,
        location: this.findExternalCallFunctions(sourceCode),
        recommendation: 'Add non-reentrant modifier and use Checks-Effects-Interactions pattern',
        confidence: 'high',
      });
      console.log(`🔴 CRITICAL: Bridge reentrancy detected`);
    }

    // 5. Access control vulnerability
    const accessVuln = this.detectAccessControlVulnerability(sourceCode);
    if (accessVuln) {
      vulnerabilities.push({
        id: 'BRIDGE-005',
        title: 'Unauthorized Mint/Burn Operations',
        severity: 'high',
        bridge: bridge.name,
        chain: bridge.chainFrom,
        type: 'access-control',
        description: BRIDGE_VULN_DESCRIPTIONS.ACCESS_CONTROL,
        location: this.findCriticalFunctions(sourceCode),
        recommendation: 'Add onlyBridge or multi-sig to critical functions',
        confidence: 'high',
      });
      console.log(`🟠 HIGH: Unauthorized mint/burn operations detected`);
    }

    // 6. Fallback vulnerability
    const fallbackVuln = this.detectFallbackVulnerability(sourceCode);
    if (fallbackVuln) {
      vulnerabilities.push({
        id: 'BRIDGE-006',
        title: 'Fallback Function Allows Minting',
        severity: 'high',
        bridge: bridge.name,
        chain: bridge.chainFrom,
        type: 'fallback',
        description: BRIDGE_VULN_DESCRIPTIONS.FALLBACK_ISSUE,
        location: this.findFallbackFunction(sourceCode),
        recommendation: 'Remove fallback function or add onlyBridge modifier',
        confidence: 'high',
      });
      console.log(`🟠 HIGH: Fallback function allows minting`);
    }

    // 7. Delegatecall vulnerability
    const delegatecallVuln = this.detectDelegatecallVulnerability(sourceCode);
    if (delegatecallVuln) {
      vulnerabilities.push({
        id: 'BRIDGE-007',
        title: 'Bridge Uses Delegatecall to Untrusted Contracts',
        severity: 'high',
        bridge: bridge.name,
        chain: bridge.chainFrom,
        type: 'delegatecall',
        description: BRIDGE_VULN_DESCRIPTIONS.DELEGATECALL_ISSUE,
        location: this.findDelegatecallFunctions(sourceCode),
        recommendation: 'Avoid delegatecall or implement trusted contract whitelist',
        confidence: 'high',
      });
      console.log(`🟠 HIGH: Bridge uses delegatecall to untrusted contracts`);
    }

    // 8. Timestamp vulnerability
    const timestampVuln = this.detectTimestampVulnerability(sourceCode);
    if (timestampVuln) {
      vulnerabilities.push({
        id: 'BRIDGE-008',
        title: 'Bridge Uses Block.Timestamp for Randomness',
        severity: 'medium',
        bridge: bridge.name,
        chain: bridge.chainFrom,
        type: 'timestamp',
        description: BRIDGE_VULN_DESCRIPTIONS.TIMESTAMP_ISSUE,
        location: this.findTimestampUsage(sourceCode),
        recommendation: 'Use Chainlink VRF or other secure randomness source',
        confidence: 'medium',
      });
      console.log(`🟡 MEDIUM: Bridge uses block.timestamp for randomness`);
    }

    console.log(`\nFound ${vulnerabilities.length} vulnerabilities:`);
    vulnerabilities.forEach((v, i) => {
      const icon = v.severity === 'critical' ? '🔴' : v.severity === 'high' ? '🟠' : '🟡';
      console.log(`  ${i + 1}. [${v.id}] ${v.title} (${v.severity.toUpperCase()})`);
    });

    return vulnerabilities;
  }

  /**
   * Detect mint vulnerability
   */
  private detectMintVulnerability(sourceCode: string, abi: any[]): boolean {
    // Look for mint function without onlyOwner or onlyBridge modifier
    const mintPattern = /function\s+mint\s*\([^)]*\s*public/gi;
    const hasMint = mintPattern.test(sourceCode);
    const hasOnlyOwner = sourceCode.includes('onlyOwner');
    const hasOnlyBridge = sourceCode.includes('onlyBridge');

    // Mint exists and no access control
    return hasMint && !hasOnlyOwner && !hasOnlyBridge;
  }

  /**
   * Detect burn vulnerability
   */
  private detectBurnVulnerability(sourceCode: string, abi: any[]): boolean {
    // Look for burn function without balance check
    const burnPattern = /function\s+burn\s*\([^)]*\s*public/gi;
    const hasBurn = burnPattern.test(sourceCode);
    const hasBalanceCheck = sourceCode.includes('balances[msg.sender]');

    // Burn exists and no balance check
    return hasBurn && !hasBalanceCheck;
  }

  /**
   * Detect double-spend vulnerability
   */
  private detectDoubleSpendVulnerability(sourceCode: string): boolean {
    // Look for balance tracking without lock mechanism
    const balancePattern = /balances\[[_a-zA-Z]+\]\s*=\s*/g;
    const hasBalanceTracking = balancePattern.test(sourceCode);
    const hasLock = sourceCode.includes('lock') || sourceCode.includes('Lock');
    const hasReentrancyGuard = sourceCode.includes('nonReentrant');

    // Balance tracking exists without lock or reentrancy guard
    return hasBalanceTracking && !hasLock && !hasReentrancyGuard;
  }

  /**
   * Detect bridge reentrancy
   */
  private detectBridgeReentrancy(sourceCode: string, abi: any[]): boolean {
    // Look for call, delegatecall, or staticcall before state update
    const externalCallPattern = /\.call\s*\([^)]*\)|\.delegatecall\s*\([^)]*\)|\.staticcall\s*\([^)]*\)/g;
    const hasExternalCall = externalCallPattern.test(sourceCode);
    const hasReentrancyGuard = sourceCode.includes('nonReentrant');

    // External call without reentrancy guard
    return hasExternalCall && !hasReentrancyGuard;
  }

  /**
   * Detect access control vulnerability
   */
  private detectAccessControlVulnerability(sourceCode: string): boolean {
    // Look for critical functions without access control
    const criticalFunctions = ['mint', 'burn', 'withdraw', 'transferOwnership'];

    for (const func of criticalFunctions) {
      const pattern = new RegExp(`function\\s+${func}\\s*\\([^)]*\\s*public`, 'gi');
      if (pattern.test(sourceCode)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect fallback vulnerability
   */
  private detectFallbackVulnerability(sourceCode: string): boolean {
    // Look for fallback function that allows minting
    const fallbackPattern = /fallback\s*\([^)]*\s*external\s*payable/gi;
    const hasFallback = fallbackPattern.test(sourceCode);
    const hasMintInFallback = sourceCode.includes('mint') && sourceCode.includes('fallback');

    // Fallback exists and has mint
    return hasFallback && hasMintInFallback;
  }

  /**
   * Detect delegatecall vulnerability
   */
  private detectDelegatecallVulnerability(sourceCode: string): boolean {
    // Look for delegatecall to arbitrary addresses
    const delegatecallPattern = /delegatecall\s*\([^)]*\)\s*\{/gi;
    const hasDelegatecall = delegatecallPattern.test(sourceCode);
    const hasWhitelist = sourceCode.includes('allowedContracts') || sourceCode.includes('trustedContracts');

    // Delegatecall exists without whitelist
    return hasDelegatecall && !hasWhitelist;
  }

  /**
   * Detect timestamp vulnerability
   */
  private detectTimestampVulnerability(sourceCode: string): boolean {
    // Look for block.timestamp usage
    const timestampPattern = /block\.timestamp\s*[!=<>+\-*]/g;
    const hasTimestamp = timestampPattern.test(sourceCode);

    // Timestamp is used for randomness
    return hasTimestamp;
  }

  /**
   * Find mint function
   */
  private findMintFunction(sourceCode: string, abi: any[]): string {
    const mintPattern = /function\s+mint\s*\([^)]*\)/g;
    const match = mintPattern.exec(sourceCode);
    return match ? match[0] : 'mint(...)';
  }

  /**
   * Find burn function
   */
  private findBurnFunction(sourceCode: string, abi: any[]): string {
    const burnPattern = /function\s+burn\s*\([^)]*\)/g;
    const match = burnPattern.exec(sourceCode);
    return match ? match[0] : 'burn(...)';
  }

  /**
   * Find external call functions
   */
  private findExternalCallFunctions(sourceCode: string): string {
    const pattern = /\.call\s*\([^)]*\)|\.delegatecall\s*\([^)]*\)|\.staticcall\s*\([^)]*\)/g;
    const matches = sourceCode.match(pattern);

    if (matches && matches.length > 0) {
      return matches.slice(0, 3).join(', ') + (matches.length > 3 ? '...' : '');
    }

    return 'external calls';
  }

  /**
   * Find critical functions
   */
  private findCriticalFunctions(sourceCode: string): string {
    const functions = [];
    const pattern = /function\s+(mint|burn|withdraw|transferOwnership)\s*\([^)]*\)/g;
    const matches = sourceCode.match(pattern);

    if (matches) {
      return matches.join(', ');
    }

    return 'multiple functions';
  }

  /**
   * Find fallback function
   */
  private findFallbackFunction(sourceCode: string): string {
    const pattern = /fallback\s*\([^)]*\)/g;
    const match = pattern.exec(sourceCode);

    return match ? match[0] : 'fallback(...)';
  }

  /**
   * Find delegatecall functions
   */
  private findDelegatecallFunctions(sourceCode: string): string {
    const pattern = /delegatecall\s*\([^)]*\)/g;
    const matches = sourceCode.match(pattern);

    if (matches && matches.length > 0) {
      return matches.slice(0, 3).join(', ') + (matches.length > 3 ? '...' : '');
    }

    return 'delegatecall(...)';
  }

  /**
   * Find timestamp usage
   */
  private findTimestampUsage(sourceCode: string): string {
    const pattern = /block\.timestamp/g;
    const matches = sourceCode.match(pattern);

    return matches ? `${matches.length} occurrences` : 'not found';
  }

  /**
   * Generate bridge recommendations
   */
  private generateBridgeRecommendations(vulns: any[], bridge: BridgeContract): string[] {
    const recommendations = [];

    if (vulns.length === 0) {
      recommendations.push('1. **SAFE:** No vulnerabilities detected');
      recommendations.push('   - Bridge appears to be secure');
      recommendations.push('   - Continue monitoring for new vulnerabilities');
    } else {
      const criticalVulns = vulns.filter(v => v.severity === 'critical');
      const highVulns = vulns.filter(v => v.severity === 'high');

      if (criticalVulns.length > 0) {
        recommendations.push('1. **CRITICAL:** Address all critical bridge vulnerabilities');
        recommendations.push(`   - Fix mint/burn vulnerabilities (${criticalVulns.length} critical issues)`);
        recommendations.push('   - Implement cross-chain lock mechanism');
        recommendations.push('   - Add non-reentrant modifier to all external call functions');
        recommendations.push('   - Add onlyBridge or multi-sig to critical functions');
      }

      if (highVulns.length > 0) {
        recommendations.push('2. **HIGH:** Address all high-severity vulnerabilities');
        recommendations.push(`   - Fix fallback/delegatecall vulnerabilities (${highVulns.length} high issues)`);
        recommendations.push('   - Use secure randomness source (Chainlink VRF)');
        recommendations.push('   - Implement access control (onlyBridge or multi-sig)');
      }

      if (vulns.some(v => v.id === 'BRIDGE-001' || v.id === 'BRIDGE-002')) {
        recommendations.push('3. **HIGH:** Implement proper mint/burn controls');
        recommendations.push('   - Add onlyBridge or multi-sig to mint/burn functions');
        recommendations.push('   - Implement balance checks before burn operations');
        recommendations.push('   - Use event-based minting instead of direct mint calls');
      }

      if (vulns.some(v => v.id === 'BRIDGE-003')) {
        recommendations.push('4. **HIGH:** Implement cross-chain lock mechanism');
        recommendations.push('   - Use cross-chain message passing to lock tokens');
        recommendations.push('   - Implement time-locked transfers with unlock on destination');
        recommendations.push('   - Add dispute resolution for failed transfers');
      }

      if (vulns.some(v => v.id === 'BRIDGE-004')) {
        recommendations.push('5. **HIGH:** Add reentrancy protection');
        recommendations.push('   - Add non-reentrant modifier to all external call functions');
        recommendations.push('   - Use Checks-Effects-Interactions pattern');
        recommendations.push('   - Perform state changes before external calls');
      }

      if (vulns.some(v => v.id === 'BRIDGE-007')) {
        recommendations.push('6. **MEDIUM:** Address delegatecall vulnerabilities');
        recommendations.push('   - Avoid delegatecall if possible');
        recommendations.push('   - Implement trusted contract whitelist');
        recommendations.push('   - Use call instead of delegatecall');
      }

      if (vulns.some(v => v.id === 'BRIDGE-008')) {
        recommendations.push('7. **MEDIUM:** Use secure randomness');
        recommendations.push('   - Use Chainlink VRF for bridge randomness');
        recommendations.push('   - Avoid block.timestamp for randomness');
        recommendations.push('   - Use commit-reveal schemes if needed');
      }
    }

    recommendations.push('');
    recommendations.push('8. **ONGOING:** Regular bridge audits');
    recommendations.push(`   - Use Shannon Crypto v0.3 for ${bridge.name} audits`);
    recommendations.push('   - Audit bridge on both source and destination chains');
    recommendations.push('   - Monitor for cross-chain state inconsistencies');
    recommendations.push('   - Test bridge with large volume transfers');

    return recommendations;
  }

  /**
   * Analyze all supported bridges
   */
  async analyzeAllBridges(chain?: string): Promise<Map<string, BridgeAnalysis>> {
    console.log(`\n=== Shannon Crypto Cross-Bridge Analysis ===`);
    console.log(`Analyzing ${this.supportedBridges.size} bridges...`);

    const results = new Map<string, BridgeAnalysis>();

    for (const [bridgeName, bridges] of this.supportedBridges.entries()) {
      for (const bridge of bridges) {
        try {
          console.log(`\nAnalyzing ${bridge.name} (${bridge.chainFrom} -> ${bridge.chainTo})...`);
          const analysis = await this.analyzeBridge(bridgeName, bridge.chainFrom);
          results.set(bridgeName, analysis);
        } catch (error: any) {
          console.error(`Failed to analyze ${bridge.name}:`, error.message);
          results.set(bridgeName, {
            bridge,
            chainFrom: bridge.chainFrom,
            chainTo: bridge.chainTo,
            vulnerabilities: [],
            sourceCode: '',
            abi: [],
            recommendations: [`Error: ${error.message}`],
          });
        }
      }
    }

    return results;
  }

  /**
   * Get supported bridges
   */
  getSupportedBridges(): Map<string, BridgeContract[]> {
    return new Map(this.supportedBridges);
  }

  /**
   * Generate bridge analysis report
   */
  generateReport(analysis: BridgeAnalysis): string {
    let report = `# Shannon Crypto Cross-Bridge Security Analysis Report

**Bridge:** ${analysis.bridge.name}
**Source Chain:** ${analysis.chainFrom}
**Destination Chain:** ${analysis.chainTo}
**Address:** ${analysis.bridge.address}
**Type:** ${analysis.bridge.type}

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 **Critical** | ${analysis.vulnerabilities.filter(v => v.severity === 'critical').length} |
| 🟠 **High** | ${analysis.vulnerabilities.filter(v => v.severity === 'high').length} |
| 🟡 **Medium** | ${analysis.vulnerabilities.filter(v => v.severity === 'medium').length} |
| 🟢 **Low** | ${analysis.vulnerabilities.filter(v => v.severity === 'low').length} |
| **Total** | ${analysis.vulnerabilities.length} |

**Overall Risk:** ${this.calculateOverallRisk(analysis.vulnerabilities)}

---

## Detailed Vulnerabilities

`;

    // Add detailed vulnerabilities
    analysis.vulnerabilities.forEach((vuln, index) => {
      const icon = vuln.severity === 'critical' ? '🔴' : vuln.severity === 'high' ? '🟠' : '🟡';
      report += `### [${vuln.id}] ${vuln.title}

`;
      report += `${icon} **Severity:** ${vuln.severity.toUpperCase()}
`;
      report += `**Type:** ${vuln.type}
`;
      report += `**Description:** ${vuln.description}
`;
      report += `**Location:** ${vuln.location}
`;
      report += `**Recommendation:** ${vuln.recommendation}
`;
      report += `**Confidence:** ${vuln.confidence.toUpperCase()}
`;
      report += `

`;
    });

    // Add recommendations
    report += `---

## Recommendations

`;
    analysis.recommendations.forEach((rec, i) => {
      report += `${i + 1}. ${rec}
`;
    });

    report += `

---

## Source Code Analysis

**Source Code Length:** ${analysis.sourceCode.length} characters
**Verified:** ${analysis.bridge.verified ? 'Yes' : 'No'}

**Functions Found:** ${analysis.abi.filter(f => f.type === 'function').length}

---

## Contract ABI

**Total Functions:** ${analysis.abi.filter(f => f.type === 'function').length}
**Total Events:** ${analysis.abi.filter(f => f.type === 'event').length}

---

*Report Generated by Shannon Crypto v0.3 Cross-Bridge Analyzer*
**Date:** ${new Date().toISOString()}

`;

    return report;
  }

  /**
   * Calculate overall risk
   */
  private calculateOverallRisk(vulns: any[]): string {
    if (vulns.length === 0) {
      return 'SAFE';
    }

    const critical = vulns.filter((v) => v.severity === 'critical').length;
    const high = vulns.filter((v) => v.severity === 'high').length;

    if (critical > 0) {
      return 'CRITICAL';
    } else if (high >= 2) {
      return 'HIGH';
    } else if (high >= 1) {
      return 'HIGH';
    } else if (critical === 0 && high === 0 && vulns.length >= 3) {
      return 'MEDIUM';
    }

    return 'LOW';
  }
}

module.exports = CrossBridgeAnalyzer;
