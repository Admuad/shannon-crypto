/**
 * Report Generator
 * Creates comprehensive audit reports with vulnerabilities
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';

interface Vulnerability {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location?: {
    file: string;
    lineStart: number;
    lineEnd: number;
  };
  recommendation: string;
  exploit?: any;
}

interface AuditMetrics {
  duration: number;
  toolExecutionTime: Record<string, number>;
  aiTokens: number;
}

interface ContractContext {
  address: string;
  network: string;
  sourceCode?: string;
}

/**
 * Generate comprehensive audit report
 */
export async function writeReport(
  contract: ContractContext,
  vulnerabilities: Vulnerability[],
  metrics: AuditMetrics,
  staticResults: any[],
  workspacePath: string
): Promise<string> {
  const reportPath = join(workspacePath, 'report.md');
  const jsonPath = join(workspacePath, 'report.json');

  // Count vulnerabilities by severity
  const counts = {
    critical: vulnerabilities.filter((v) => v.severity === 'critical').length,
    high: vulnerabilities.filter((v) => v.severity === 'high').length,
    medium: vulnerabilities.filter((v) => v.severity === 'medium').length,
    low: vulnerabilities.filter((v) => v.severity === 'low').length,
  };

  // Calculate overall risk
  const overallRisk = calculateOverallRisk(counts);

  // Generate markdown report
  const spinner = ora('Generating report...').start();

  const markdown = generateMarkdownReport(contract, vulnerabilities, metrics, counts, overallRisk);
  const json = JSON.stringify(
    {
      contract,
      vulnerabilities,
      metrics,
      counts,
      overallRisk,
      generatedAt: new Date().toISOString(),
    },
    null,
    2
  );

  await fs.writeFile(reportPath, markdown, 'utf-8');
  await fs.writeFile(jsonPath, json, 'utf-8');

  spinner.succeed('Report generated');

  return reportPath;
}

/**
 * Calculate overall risk assessment
 */
function calculateOverallRisk(counts: Record<string, number>): string {
  if (counts.critical > 0) {
    return 'CRITICAL';
  }

  if (counts.high >= 2 || counts.high >= 1 && counts.critical > 0) {
    return 'HIGH';
  }

  if (counts.medium >= 3) {
    return 'MEDIUM';
  }

  if (counts.low > 5) {
    return 'LOW';
  }

  return 'SAFE';
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(
  contract: ContractContext,
  vulnerabilities: Vulnerability[],
  metrics: AuditMetrics,
  counts: Record<string, number>,
  overallRisk: string
): string {
  const riskColors: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
    safe: '✅',
  };

  const riskColor = riskColors[overallRisk] || '⚪';

  let report = `# Smart Contract Security Audit Report

**Contract Address:** \`${contract.address}\`
**Network:** ${contract.network.toUpperCase()}
**Audit Date:** ${new Date().toISOString()}
**Overall Risk:** ${riskColor} **${overallRisk}**

---

## Executive Summary

| Severity | Count |
|----------|-------|
${riskColors.critical} **Critical** | ${counts.critical} |
${riskColors.high} **High** | ${counts.high} |
${riskColors.medium} **Medium** | ${counts.medium} |
${riskColors.low} **Low** | ${counts.low} |
| **Total** | ${vulnerabilities.length} |

**Audit Duration:** ${(metrics.duration / 1000).toFixed(1)}s
${contract.sourceCode ? '**Contract Size:** ' + contract.sourceCode.length + ' bytes' : ''}

`;

  if (counts.critical > 0 || counts.high > 0) {
    report += `
**⚠️ IMMEDIATE ACTION REQUIRED**

This contract has ${
      counts.critical + counts.high
    } critical/high-severity vulnerabilities that should be addressed before deployment to mainnet.
`;
  } else if (counts.medium > 0) {
    report += `
**⚡ RECOMMENDED**

This contract has ${counts.medium} medium-severity issues that should be reviewed.
`;
  } else {
    report += `
✅ This contract appears secure from common vulnerability patterns.
`;
  }

  report += '\n---\n\n';

  // Critical Findings
  if (counts.critical > 0) {
    report += `## Critical Findings (${counts.critical})\n\n`;

    const critical = vulnerabilities.filter((v) => v.severity === 'critical');

    for (const vuln of critical) {
      report += formatVulnerability(vuln, riskColors.critical);
    }
  }

  // High Findings
  if (counts.high > 0) {
    report += `## High Severity Findings (${counts.high})\n\n`;

    const high = vulnerabilities.filter((v) => v.severity === 'high');

    for (const vuln of high) {
      report += formatVulnerability(vuln, riskColors.high);
    }
  }

  // Medium Findings
  if (counts.medium > 0) {
    report += `## Medium Severity Findings (${counts.medium})\n\n`;

    const medium = vulnerabilities.filter((v) => v.severity === 'medium');

    for (const vuln of medium) {
      report += formatVulnerability(vuln, riskColors.medium);
    }
  }

  // Low Findings
  if (counts.low > 0) {
    report += `## Low Severity Findings (${counts.low})\n\n`;

    const low = vulnerabilities.filter((v) => v.severity === 'low');

    for (const vuln of low) {
      report += formatVulnerability(vuln, riskColors.low);
    }
  }

  // Tools Used
  report += '\n---\n\n';
  report += '## Tools Used\n\n';

  const toolTimes = Object.entries(metrics.toolExecutionTime).sort(([, a], [, b]) => a[1] - b[1]);

  for (const [tool, time] of toolTimes) {
    report += `- **${tool}**\n  `;
    report += `Execution Time: ${(time / 1000).toFixed(1)}s\n`;
  }

  report += '\n---\n\n';
  report += '## Recommendations\n\n';

  if (vulnerabilities.length > 0) {
    report += `1. **Address all critical and high-severity vulnerabilities**\n`;
    report += `2. **Implement proper access control**\n`;
    report += `3. **Add reentrancy guards to all external calls**\n`;
    report += `4. **Use OpenZeppelin or similar audited contracts**\n`;
    report += `5. **Test extensively on testnet before mainnet deployment**\n`;
  } else {
    report += `No critical vulnerabilities found. Continue following best practices.\n`;
  }

  report += '\n---\n\n';
  report += '*This report was generated by Shannon Crypto - AI-Powered Smart Contract Auditor*\n';
  report += '\n';
  report += '**Generated:** ' + new Date().toISOString() + '\n';

  return report;
}

/**
 * Format a single vulnerability
 */
function formatVulnerability(vuln: Vulnerability, icon: string): string {
  let section = `### [${vuln.id}] ${vuln.title}\n\n`;
  section += `**Severity:** ${icon} ${vuln.severity.toUpperCase()}\n\n`;
  section += `**Description:** ${vuln.description}\n\n`;

  if (vuln.location) {
    section += `**Location:** \`${vuln.location.file}:${vuln.location.lineStart}-${vuln.location.lineEnd}\`\n\n`;
  }

  section += `**Recommendation:** ${vuln.recommendation}\n\n`;

  return section;
}
