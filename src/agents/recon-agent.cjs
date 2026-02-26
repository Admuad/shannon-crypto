/**
 * Reconnaissance Agent
 * Autonomous Web3/DApp scanning and contract discovery
 * AI-powered analysis of frontend and on-chain data
 */

const axios = 'axios';
const fs = require('fs');
const path = require('path');

class ReconAgent {
  constructor(apiKey?: string) {
    this.etherscanApiKey = apiKey || process.env.ETHERSCAN_API_KEY;
    this.bscscanApiKey = process.env.BSCSCAN_API_KEY;
  }

  /**
   * Scan Web3/DApp frontend components
   */
  async scanWeb3Frontend(url: string): Promise<any> {
    try {
      console.log(`Scanning Web3 frontend: ${url}`);

      const response = await axios.get(url, {
        timeout: 30000,
      });

      const html = response.data;

      // Scan for Web3 libraries
      const web3Libraries = this.detectWeb3Libraries(html);

      // Scan for wallet connections
      const walletConnections = this.detectWalletConnections(html);

      // Scan for API endpoints
      const apiEndpoints = this.detectAPIEndpoints(html);

      // Scan for sensitive data exposure
      const sensitiveData = this.detectSensitiveData(html);

      return {
        url,
        web3Libraries,
        walletConnections,
        apiEndpoints,
        sensitiveData,
        riskScore: this.calculateFrontendRisk({
          web3Libraries,
          walletConnections,
          apiEndpoints,
          sensitiveData,
        }),
      };
    } catch (error: any) {
      console.error(`Failed to scan Web3 frontend: ${error.message}`);
      return {
        url,
        error: error.message,
      };
    }
  }

  /**
   * Detect Web3 libraries in use
   */
  private detectWeb3Libraries(html: string): string[] {
    const libraries = [];

    const libraryPatterns = {
      'ethers.js': /ethers(?:\.min)?\.js/gi,
      'web3.js': /web3(?:\.min)?\.js/gi,
      'viem': /viem/gi,
      'wagmi': /wagmi/gi,
      'connectkit': /connectkit/gi,
      'rainbowkit': /rainbowkit/gi,
      'web3modal': /web3modal/gi,
      'walletconnect': /walletconnect/gi,
    };

    for (const [name, pattern] of Object.entries(libraryPatterns)) {
      if (pattern.test(html)) {
        libraries.push(name);
      }
    }

    return libraries;
  }

  /**
   * Detect wallet connection patterns
   */
  private detectWalletConnections(html: string): string[] {
    const patterns = [];

    // Look for wallet connect calls
    const connectPattern = /connectWallet|activate|connect/gi;
    if (connectPattern.test(html)) {
      patterns.push('wallet-connect');
    }

    // Look for Web3Auth calls
    const web3AuthPattern = /web3auth|loginWithWeb3Auth/gi;
    if (web3AuthPattern.test(html)) {
      patterns.push('web3auth');
    }

    // Look for Ethers.js provider setup
    const providerPattern = /new ethers\.providers\.Web3Provider|connectWithWeb3Auth/gi;
    if (providerPattern.test(html)) {
      patterns.push('ethers-provider');
    }

    return patterns;
  }

  /**
   * Detect API endpoints and methods
   */
  private detectAPIEndpoints(html: string): any[] {
    const endpoints = [];

    // Look for fetch calls
    const fetchPattern = /fetch\(['"`]([^'"`]+)['"`]\s*,\s*\{?\s*/g;
    const matches = html.match(fetchPattern);

    if (matches) {
      for (const match of matches) {
        const endpoint = {
          url: match[1],
          method: 'POST',
          source: 'frontend',
        };

        endpoints.push(endpoint);
      }
    }

    return endpoints;
  }

  /**
   * Detect exposed sensitive data
   */
  private detectSensitiveData(html: string): string[] {
    const findings = [];

    // Hardcoded API keys
    const keyPattern = /['"`]0x[a-fA-F0-9]{40}['"`]|['"`]sk-['"`]|['"`]pk-['"`]/g;
    const keyMatches = html.match(keyPattern);
    if (keyMatches) {
      findings.push('hardcoded-api-key');
    }

    // Exposed mnemonics
    const mnemonicPattern = /mnemonic|secret|private.*key/gi;
    if (mnemonicPattern.test(html)) {
      findings.push('mnemonic-exposure');
    }

    // Hardcoded wallet addresses
    const addressPattern = /['"`]0x[a-fA-F0-9]{40}['"`]/g;
    const addressMatches = html.match(addressPattern);
    if (addressMatches) {
      findings.push('hardcoded-address');
    }

    return findings;
  }

  /**
   * Calculate frontend risk score
   */
  private calculateFrontendRisk(analysis: any): number {
    let score = 0;

    // Risk: Hardcoded secrets
    if (analysis.sensitiveData.length > 0) {
      score += 30;
    }

    // Risk: Multiple wallet connections
    if (analysis.walletConnections.length > 2) {
      score += 20;
    }

    // Risk: Unverified API calls
    if (analysis.apiEndpoints.length > 5) {
      score += 15;
    }

    // Risk: Using insecure libraries
    if (analysis.web3Libraries.includes('web3.js')) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Fetch contract ABI from Etherscan
   */
  async fetchContractABI(address: string): Promise<any> {
    try {
      const network = this.detectNetwork(address);
      const apiUrl = `https://api.${network}api.io/api?module=contract&action=getabi&address=${address}&apikey=${this.etherscanApiKey}`;

      const response = await axios.get(apiUrl, {
        timeout: 30000,
      });

      if (response.data.status !== '1') {
        throw new Error(response.data.message || 'Failed to fetch ABI');
      }

      const abi = JSON.parse(response.data.result);
      return {
        address,
        network,
        abi,
        sourceCode: await this.fetchContractSource(address, network),
      };
    } catch (error: any) {
      console.error(`Failed to fetch ABI for ${address}: ${error.message}`);
      return {
        address,
        error: error.message,
        abi: [],
      };
    }
  }

  /**
   * Fetch contract source code from Etherscan
   */
  async fetchContractSource(address: string, network: string): Promise<string> {
    try {
      const apiUrl = `https://api.${network}api.io/api?module=contract&action=getsource&address=${address}&apikey=${this.etherscanApiKey}`;

      const response = await axios.get(apiUrl, {
        timeout: 30000,
      });

      if (response.data.status !== '1') {
        return '';
      }

      // Extract source code
      const result = response.data.result;
      if (result && result[0]) {
        const source = result[0].SourceCode || result[0].SourceCode[0];
        return source || '';
      }

      return '';
    } catch (error: any) {
      console.error(`Failed to fetch source for ${address}: ${error.message}`);
      return '';
    }
  }

  /**
   * Detect network from address prefix
   */
  private detectNetwork(address: string): string {
    const prefix = address.substring(2, 4).toLowerCase();
    const networkMap: Record<string, string> = {
      '0x4': 'etherscan',
      '0x1': 'etherscan',
      '0x6': 'etherscan',
      '0x5': 'etherscan',
      '0x38': 'bscscan',
      '0x61': 'bscscan',
      '0x56': 'bscscan',
      '0xa': 'arbscan',
      '0xa861': 'arbscan',
      '0x82': 'polygonscan',
      '0x89': 'polygonscan',
      '0xa4b1': 'polygonscan',
      '0xa': 'optimistic',
      '0xa4c1': 'optimistic',
      '0xc': 'snowtrace',
      '0xfa': 'snowtrace',
    };

    return networkMap[prefix] || 'etherscan';
  }

  /**
   * Scan on-chain events for vulnerabilities
   */
  async scanOnchainEvents(rpcUrl: string, address: string): Promise<any> {
    try {
      console.log(`Scanning on-chain events for: ${address}`);

      // Get recent events
      const recentEvents = await this.fetchRecentEvents(rpcUrl, address);

      // Analyze for patterns
      const reentrancyEvents = this.detectReentrancyPatterns(recentEvents);
      const largeTransferEvents = this.detectLargeTransfers(recentEvents);
      const suspiciousEvents = this.detectSuspiciousActivity(recentEvents);

      return {
        address,
        recentEvents,
        reentrancyEvents,
        largeTransferEvents,
        suspiciousEvents,
        riskScore: this.calculateOnchainRisk({
          reentrancyEvents,
          largeTransferEvents,
          suspiciousEvents,
        }),
      };
    } catch (error: any) {
      console.error(`Failed to scan on-chain events: ${error.message}`);
      return {
        address,
        error: error.message,
        reentrancyEvents: [],
        largeTransferEvents: [],
        suspiciousEvents: [],
      };
    }
  }

  /**
   * Fetch recent events from contract
   */
  private async fetchRecentEvents(rpcUrl: string, address: string, limit: number = 100): Promise<any[]> {
    try {
      const payload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getLogs',
        params: [
          {
            address,
            fromBlock: '0x0', // Start from beginning (would use latest in production)
            toBlock: 'latest',
          },
          '0x' + limit.toString(16), // Hex
        ],
      };

      const response = await axios.post(rpcUrl, payload, {
        timeout: 30000,
      });

      const events = response.data.result || [];
      return events;
    } catch (error: any) {
      console.error(`Failed to fetch events: ${error.message}`);
      return [];
    }
  }

  /**
   * Detect reentrancy patterns in events
   */
  private detectReentrancyPatterns(events: any[]): any[] {
    const patterns = [];
    const addressFrequency = new Map<string, number>();

    // Count events per address
    for (const event of events) {
      const address = event.address?.toLowerCase();
      if (address) {
        addressFrequency.set(address, (addressFrequency.get(address) || 0) + 1);
      }
    }

    // Look for repeated calls from same address
    for (const [address, count] of addressFrequency.entries()) {
      if (count > 5) {
        patterns.push({
          type: 'potential-reentrancy',
          address,
          frequency: count,
          confidence: 'medium',
        });
      }
    }

    return patterns;
  }

  /**
   * Detect large transfers
   */
  private detectLargeTransfers(events: any[]): any[] {
    const largeTransfers = [];

    for (const event of events) {
      if (event.value) {
        // Convert wei to ETH (simplified)
        const value = parseInt(event.value, 16);
        const ethValue = value / 1e18;

        // Flag transfers > 100 ETH
        if (ethValue > 100) {
          largeTransfers.push({
            ...event,
            ethValue,
            severity: 'high',
          });
        }
      }
    }

    return largeTransfers;
  }

  /**
   * Detect suspicious on-chain activity
   */
  private detectSuspiciousActivity(events: any[]): any[] {
    const suspicious = [];

    // Look for batch operations (multiple txs in same block)
    const blockTimes = new Map<string, number[]>();
    for (const event of events) {
      const block = event.blockNumber;
      if (!blockTimes.has(block)) {
        blockTimes.set(block, []);
      }
      blockTimes.get(block)!.push(Date.parse(event.timeStamp || '0'));
    }

    // Flag blocks with many events
    for (const [block, times] of blockTimes.entries()) {
      if (times.length > 10) {
        suspicious.push({
          type: 'batch-operations',
          blockNumber: block,
          eventCount: times.length,
          severity: 'medium',
        });
      }
    }

    return suspicious;
  }

  /**
   * Calculate on-chain risk score
   */
  private calculateOnchainRisk(analysis: any): number {
    let score = 0;

    // Risk: Reentrancy patterns
    if (analysis.reentrancyEvents.length > 0) {
      score += 40;
    }

    // Risk: Large transfers
    if (analysis.largeTransferEvents.length > 0) {
      score += 20;
    }

    // Risk: Suspicious activity
    if (analysis.suspiciousEvents.length > 0) {
      score += 30;
    }

    return Math.min(score, 100);
  }

  /**
   * Generate comprehensive reconnaissance report
   */
  async generateReport(config: {
    target?: string;
    url?: string;
    scanOnchain?: boolean;
  }): Promise<string> {
    const report = {
      timestamp: new Date().toISOString(),
      frontend: null,
      onchain: null,
      contract: null,
      riskScore: 0,
      findings: [],
    };

    // Web3/DApp scanning
    if (config.url) {
      report.frontend = await this.scanWeb3Frontend(config.url);
    }

    // On-chain scanning
    if (config.scanOnchain && config.target) {
      const network = this.detectNetwork(config.target);
      const rpcUrl = `https://${network}.infura.io/v3/${process.env.INFURA_KEY}`;

      report.contract = await this.fetchContractABI(config.target);
      report.onchain = await this.scanOnchainEvents(rpcUrl, config.target);
    }

    // Calculate overall risk score
    report.riskScore = Math.max(
      report.frontend?.riskScore || 0,
      report.onchain?.riskScore || 0
    );

    // Generate findings
    report.findings = this.generateFindings(report);

    return this.formatMarkdownReport(report);
  }

  /**
   * Generate findings from analysis
   */
  private generateFindings(report: any): any[] {
    const findings = [];

    // Frontend findings
    if (report.frontend) {
      if (report.frontend.sensitiveData.length > 0) {
        findings.push({
          id: 'RECON-FE-001',
          type: 'frontend',
          severity: 'high',
          title: 'Exposed Sensitive Data',
          description: `Found ${report.frontend.sensitiveData.length} types of sensitive data exposure`,
          location: report.frontend.url,
        });
      }

      if (report.frontend.apiEndpoints.length > 5) {
        findings.push({
          id: 'RECON-FE-002',
          type: 'frontend',
          severity: 'medium',
          title: 'Excessive API Calls',
          description: `Found ${report.frontend.apiEndpoints.length} API endpoints without rate limiting`,
          location: report.frontend.url,
        });
      }
    }

    // On-chain findings
    if (report.onchain) {
      if (report.onchain.reentrancyEvents.length > 0) {
        findings.push({
          id: 'RECON-ON-001',
          type: 'onchain',
          severity: 'critical',
          title: 'Reentrancy Patterns Detected',
          description: `Found ${report.onchain.reentrancyEvents.length} potential reentrancy patterns`,
          location: report.contract.address,
        });
      }

      if (report.onchain.largeTransferEvents.length > 0) {
        findings.push({
          id: 'RECON-ON-002',
          type: 'onchain',
          severity: 'medium',
          title: 'Large Transfers Detected',
          description: `Found ${report.onchain.largeTransferEvents.length} transfers > 100 ETH`,
          location: report.contract.address,
        });
      }
    }

    return findings;
  }

  /**
   * Format report as Markdown
   */
  private formatMarkdownReport(report: any): string {
    let markdown = `# Shannon Crypto Reconnaissance Report

**Target:** ${report.url || report.contract?.address || 'unknown'}
**Timestamp:** ${report.timestamp}
**Overall Risk Score:** ${report.riskScore}/100 (${this.getRiskLevel(report.riskScore)})

---

## Executive Summary

`;

    // Frontend section
    if (report.frontend) {
      markdown += `### Web3/DApp Frontend Analysis

**Web3 Libraries:** ${report.frontend.web3Libraries.join(', ') || 'none detected'}
**Wallet Connections:** ${report.frontend.walletConnections.join(', ') || 'none detected'}
**API Endpoints:** ${report.frontend.apiEndpoints.length} detected
**Sensitive Data:** ${report.frontend.sensitiveData.join(', ') || 'none exposed'}
**Frontend Risk Score:** ${report.frontend.riskScore}/100

`;
    }

    // On-chain section
    if (report.onchain) {
      markdown += `
### On-Chain Analysis

**Contract:** ${report.contract.address}
**Network:** ${report.contract.network}
**ABI Functions:** ${report.contract.abi.length || 0}
**Source Code:** ${report.contract.sourceCode ? 'verified' : 'not verified'}
**On-Chain Risk Score:** ${report.onchain.riskScore}/100

**Reentrancy Patterns:** ${report.onchain.reentrancyEvents.length}
**Large Transfers:** ${report.onchain.largeTransferEvents.length}
**Suspicious Activity:** ${report.onchain.suspiciousEvents.length}

`;
    }

    // Findings section
    markdown += `

## Findings

`;
    for (const finding of report.findings) {
      const icon = finding.severity === 'critical' ? '🔴' : finding.severity === 'high' ? '🟠' : '🟡';
      markdown += `### [${finding.id}] ${finding.title}

${icon} **Severity:** ${finding.severity.toUpperCase()}
**Type:** ${finding.type}
**Description:** ${finding.description}
**Location:** ${finding.location}

`;
    }

    markdown += `

## Recommendations

${report.findings.length > 0 ? '1. **IMMEDIATE:** Address all critical and high-severity findings' : '1. **RECOMMENDED:** Continue following best practices'}
${report.riskScore > 70 ? '2. **HIGH RISK:** Do NOT deploy to mainnet until findings are addressed' : '2. **LOW RISK:** Safe to proceed with caution'}
3. **ONGOING:** Implement regular security audits
4. **MONITORING:** Set up on-chain event monitoring

---

*Report Generated by Shannon Crypto Reconnaissance Agent*

`;

    return markdown;
  }

  /**
   * Get risk level label
   */
  private getRiskLevel(score: number): string {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    if (score >= 20) return 'LOW';
    return 'SAFE';
  }
}

module.exports = ReconAgent;
