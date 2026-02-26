#!/usr/bin/env node
/**
 * Shannon Crypto Demo - Generate Sample Audit Report
 * Shows what a real audit report would look like
 */

const fs = require('fs');
const path = require('path');

console.log('\n=== Shannon Crypto Demo - Generating Audit Report ===\n');

// Simulated vulnerabilities from analysis of a real contract
const vulnerabilities = [
  {
    id: 'VULN-001',
    title: 'Reentrancy in withdraw()',
    severity: 'critical',
    cvss: 9.1,
    description: 'The withdraw() function performs a state update after an external call, allowing attackers to re-enter the function before the balance is updated.',
    location: {
      file: 'VulnerableBank.sol',
      lineStart: 17,
      lineEnd: 26,
    },
    tools: {
      slither: true,
      mythril: false,
      echidna: false,
      ai: true,
    },
    confidence: 'high',
    recommendation: 'Add non-reentrant modifier to withdraw() and use Checks-Effects-Interactions pattern.',
    exploit: {
      type: 'reentrancy',
      description: 'Attacker calls withdraw() recursively within a single transaction, draining the contract balance.',
    },
  },
  {
    id: 'VULN-002',
    title: 'Timestamp Dependence in lottery()',
    severity: 'medium',
    cvss: 5.3,
    description: 'The lottery() function uses block.timestamp as a random seed, making the result predictable and manipulatable by miners.',
    location: {
      file: 'VulnerableBank.sol',
      lineStart: 32,
      lineEnd: 38,
    },
    tools: {
      slither: true,
      ai: true,
    },
    confidence: 'high',
    recommendation: 'Use a verifiable random function (e.g., Chainlink VRF) instead of block.timestamp.',
    exploit: {
      type: 'timestamp-manipulation',
      description: 'Miner manipulates block timestamp to force winning outcome.',
    },
  },
  {
    id: 'VULN-003',
    title: 'Missing Access Control on emergencyWithdraw()',
    severity: 'high',
    cvss: 7.5,
    description: 'The emergencyWithdraw() function can be called by anyone without any access control.',
    location: {
      file: 'VulnerableBank.sol',
      lineStart: 43,
      lineEnd: 47,
    },
    tools: {
      ai: true,
    },
    confidence: 'medium',
    recommendation: 'Add onlyAdmin modifier or implement proper role-based access control.',
    exploit: {
      type: 'access-control-bypass',
      description: 'Anyone can call emergencyWithdraw() and drain the contract.',
    },
  },
];

// Count by severity
const counts = {
  critical: vulnerabilities.filter((v) => v.severity === 'critical').length,
  high: vulnerabilities.filter((v) => v.severity === 'high').length,
  medium: vulnerabilities.filter((v) => v.severity === 'medium').length,
  low: vulnerabilities.filter((v) => v.severity === 'low').length,
};

// Calculate overall risk
let overallRisk = 'SAFE';
if (counts.critical > 0) overallRisk = 'CRITICAL';
else if (counts.high >= 2 || (counts.high >= 1 && counts.critical > 0)) overallRisk = 'HIGH';
else if (counts.medium >= 3) overallRisk = 'MEDIUM';

// Create workspace
const auditLogsPath = path.join(process.cwd(), 'audit-logs', 'demo-run');

try {
  fs.mkdirSync(auditLogsPath, { recursive: true });
} catch {}

// Generate Markdown Report
let markdown = `# Smart Contract Security Audit Report

**Contract Address:** \`0x742d35Cc6634C0532925a3b8Verif9ed4D90042833\`
**Network:** ETHEREUM
**Audit Date:** ${new Date().toISOString()}
**Overall Risk:** **${overallRisk}**

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 **Critical** | ${counts.critical} | IMMEDIATE ACTION REQUIRED |
| 🟠 **High** | ${counts.high} | ${counts.high > 0 ? 'ATTENTION REQUIRED' : 'None'} |
| 🟡 **Medium** | ${counts.medium} | ${counts.medium > 0 ? 'Recommended to fix' : 'None'} |
| 🟢 **Low** | ${counts.low} | ${counts.low > 0 ? 'Low priority' : 'None'} |
| **Total** | ${vulnerabilities.length} | |

**Audit Duration:** 45.2 seconds
**Tools Used:** Slither, AI Detection Agent
**AI Tokens:** 4,520

`;

if (counts.critical > 0 || counts.high > 0) {
  markdown += '---\n\n';
  markdown += '## ⚠️ IMMEDIATE ACTION REQUIRED\n\n';
  markdown += `This contract has **${counts.critical + counts.high} critical/high-severity vulnerabilities** that should be addressed before deployment to mainnet.\n\n`;
  markdown += '### Impact\n';
  markdown += '- Potential loss of all funds\n';
  markdown += '- Contract takeover by attackers\n';
  markdown += '- Reputation damage to protocol\n\n';
  markdown += '### Recommended Actions\n';
  markdown += '1. **DO NOT DEPLOY** to mainnet with current vulnerabilities\n';
  markdown += '2. **Fix all Critical vulnerabilities** before next audit\n';
  markdown += '3. **Implement proper access control** on all sensitive functions\n';
  markdown += '4. **Add reentrancy guards** to external calls\n';
  markdown += '5. **Test on testnet** before mainnet deployment\n\n';
}

markdown += '---\n\n';

// Critical Findings
if (counts.critical > 0) {
  const critical = vulnerabilities.filter((v) => v.severity === 'critical');
  markdown += `## 🔴 Critical Findings (${counts.critical})\n\n`;
  
  critical.forEach((vuln) => {
    markdown += `### [${vuln.id}] ${vuln.title}\n\n`;
    markdown += `**Severity:** 🔴 **CRITICAL**\n\n`;
    markdown += `**CVSS Score:** ${vuln.cvss}/10.0\n\n`;
    markdown += `**Description:** ${vuln.description}\n\n`;
    markdown += `**Location:** \`${vuln.location.file}:${vuln.location.lineStart}-${vuln.location.lineEnd}\`\n\n`;
    markdown += `**Confidence:** ${vuln.confidence.toUpperCase()} (AI + Static Analysis)\n\n`;
    markdown += `**Exploit Type:** ${vuln.exploit.type}\n\n`;
    markdown += `**Exploit Description:** ${vuln.exploit.description}\n\n`;
    markdown += `**Recommendation:** ${vuln.recommendation}\n\n`;
    markdown += `**Tools:** Slither ${vuln.tools.slither ? '✅' : '❌'}, AI Detection ${vuln.tools.ai ? '✅' : '❌'}\n\n`;
    markdown += '---\n\n';
  });
}

// High Findings
if (counts.high > 0) {
  const high = vulnerabilities.filter((v) => v.severity === 'high');
  markdown += `## 🟠 High Severity Findings (${counts.high})\n\n`;
  
  high.forEach((vuln) => {
    markdown += `### [${vuln.id}] ${vuln.title}\n\n`;
    markdown += `**Severity:** 🟠 **HIGH**\n\n`;
    markdown += `**CVSS Score:** ${vuln.cvss}/10.0\n\n`;
    markdown += `**Description:** ${vuln.description}\n\n`;
    markdown += `**Location:** \`${vuln.location.file}:${vuln.location.lineStart}-${vuln.location.lineEnd}\`\n\n`;
    markdown += `**Confidence:** ${vuln.confidence.toUpperCase()}\n\n`;
    markdown += `**Exploit Type:** ${vuln.exploit.type}\n\n`;
    markdown += `**Recommendation:** ${vuln.recommendation}\n\n`;
    markdown += '---\n\n';
  });
}

// Medium Findings
if (counts.medium > 0) {
  const medium = vulnerabilities.filter((v) => v.severity === 'medium');
  markdown += `## 🟡 Medium Severity Findings (${counts.medium})\n\n`;
  
  medium.forEach((vuln) => {
    markdown += `### [${vuln.id}] ${vuln.title}\n\n`;
    markdown += `**Severity:** 🟡 **MEDIUM**\n\n`;
    markdown += `**CVSS Score:** ${vuln.cvss}/10.0\n\n`;
    markdown += `**Description:** ${vuln.description}\n\n`;
    markdown += `**Location:** \`${vuln.location.file}:${vuln.location.lineStart}-${vuln.location.lineEnd}\`\n\n`;
    markdown += `**Recommendation:** ${vuln.recommendation}\n\n`;
    markdown += '---\n\n';
  });
}

// Tools Used
markdown += '## Tools Used\n\n';
markdown += '| Tool | Execution Time | Status |\n';
markdown += '|-------|---------------|--------|\n';
markdown += '| **Slither** | 12.3s | ✅ Complete |\n';
markdown += '| **AI Detection Agent** | 28.5s | ✅ Complete |\n\n';
markdown += '**Total Execution Time:** 45.2s\n\n';

// Recommendations
markdown