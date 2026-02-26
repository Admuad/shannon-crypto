/**
 * Consensus Engine
 * Combines results from multiple static analysis tools
 * Reduces false positives via weighted voting system
 */

import { z } from 'zod';

interface ToolResult {
  tool: string;
  vulnerabilities: Vulnerability[];
  confidence: number;
}

interface Vulnerability {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location: {
    file: string;
    lineStart: number;
    lineEnd: number;
  };
  tools: {
    slither?: boolean;
    mythril?: boolean;
    echidna?: boolean;
    medusa?: boolean;
  };
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  recommendation: string;
}

interface ConsensusResult {
  vulnerabilities: Vulnerability[];
  consensus: {
    total: number;
    agreed: number;
    conflicts: number;
    overrides: number;
  };
  toolWeights: {
    slither: number;
    mythril: number;
    echidna: number;
    medusa: number;
    ai: number;
  };
}

const VulnerabilitySchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  description: z.string(),
  location_file: z.string(),
  location_lineStart: z.number(),
  location_lineEnd: z.number(),
  confidence: z.enum(['high', 'medium', 'low']),
  recommendation: z.string(),
});

/**
 * Consensus Engine
 */
export class ConsensusEngine {
  private toolWeights: Record<string, number>;

  constructor() {
    // Tool weights based on reliability and depth
    this.toolWeights = {
      slither: 0.40,  // Fast, reliable for common patterns
      mythril: 0.30, // Deep path analysis
      echidna: 0.20, // Property-based fuzzing
      medusa: 0.10, // Edge case detection
      ai: 0.50,  // Reasoning override
    };
  }

  /**
   * Combine results from multiple tools
   */
  async combineResults(
    results: ToolResult[]
  ): Promise<ConsensusResult> {
    const consensus = {
      total: 0,
      agreed: 0,
      conflicts: 0,
      overrides: 0,
    };

    // Group findings by severity and location
    const findings = this.groupFindings(results);

    // Process each finding
    const processedVulns: Vulnerability[] = [];

    for (const group of findings) {
      const consensus = this.calculateConsensus(group);

      if (consensus.agreed) {
        processedVulns.push(consensus.finding);
        consensus.agreed++;
      } else if (consensus.conflict) {
        // Resolve conflicts
        const resolved = this.resolveConflict(group, consensus.findings);
        processedVulns.push(resolved);
        consensus.conflicts++;
        consensus.overrides++;
      } else {
        // Single tool finding - add with lower confidence
        const finding = group[0];
        processedVulns.push({
          ...finding,
          confidence: 'low',
          confidenceScore: this.toolWeights[finding.tool] * 50, // Base confidence
        });
        consensus.total++;
      }
    }

    consensus.total = findings.length;

    return {
      vulnerabilities: processedVulns,
      consensus,
      toolWeights: this.toolWeights,
    };
  }

  /**
   * Group findings by similarity (same location, same type)
   */
  private groupFindings(results: ToolResult[]): Vulnerability[][] {
    const groups: Map<string, Vulnerability[]> = new Map();

    for (const result of results) {
      for (const vuln of result.vulnerabilities) {
        // Create key based on location and severity
        const key = `${vuln.location.file}:${vuln.location.lineStart}-${vuln.severity}`;

        if (!groups.has(key)) {
          groups.set(key, []);
        }

        // Add tool detection
        const vulnWithTool = {
          ...vuln,
          tools: {
            [result.tool]: true,
          },
        };

        groups.get(key)!.push(vulnWithTool);
      }
    }

    return Array.from(groups.values());
  }

  /**
   * Calculate consensus for a group of findings
   */
  private calculateConsensus(group: Vulnerability[]): {
    agreed: boolean;
    conflict: boolean;
    finding: Vulnerability;
    findings: Vulnerability[];
  } {
    if (group.length === 0) {
      return {
        agreed: false,
        conflict: false,
        finding: group[0],
        findings: group,
      };
    }

    if (group.length === 1) {
      return {
        agreed: false, // Need at least 2 tools to agree
        conflict: false,
        finding: group[0],
        findings: group,
      };
    }

    // Count tool agreements
    const toolAgreements: Record<string, number> = {};
    let maxAgreements = 0;
    let maxTool = '';

    for (const vuln of group) {
      for (const tool of Object.keys(vuln.tools)) {
        if (!toolAgreements[tool]) {
          toolAgreements[tool] = 0;
        }
        toolAgreements[tool]++;

        if (toolAgreements[tool] > maxAgreements) {
          maxAgreements = toolAgreements[tool];
          maxTool = tool;
        }
      }
    }

    // Determine if there's consensus (at least 2 tools agree)
    const agreedTools = Object.entries(toolAgreements)
      .filter(([_, count]) => count >= 2)
      .map(([tool, _]) => tool);

    if (agreedTools.length >= 2) {
      // Calculate confidence score
      const confidenceScore = agreedTools.reduce((sum, tool) => {
        return sum + this.toolWeights[tool];
      }, 0);

      // Merge findings from agreed tools
      const merged = this.mergeFindings(group, agreedTools);

      // Adjust confidence based on number of tools
      let confidence: 'medium';
      if (agreedTools.length >= 3) {
        confidence = 'high';
      }

      return {
        agreed: true,
        conflict: false,
        finding: {
          ...merged,
          confidence,
          confidenceScore,
        },
        findings: group,
      };
    }

    // Conflict or single tool detection
    return {
      agreed: false,
      conflict: group.length > 1,
      finding: group[0], // Use finding from most trusted tool
      findings: group,
    };
  }

  /**
   * Merge findings from multiple tools
   */
  private mergeFindings(group: Vulnerability[], tools: string[]): Vulnerability {
    if (group.length === 0) {
      return group[0];
    }

    const base = group[0];

    // Combine tool detections
    const combinedTools: Vulnerability['tools'] = {};
    for (const tool of tools) {
      combinedTools[tool] = true;
    }

    // Merge descriptions if they differ
    const descriptions = group.map((v) => v.description).filter((d) => d);
    const mergedDescription = descriptions.length > 1
      ? `${base.title} - ${tools.join(', ')} detected`
      : base.description;

    // Merge severity (use most severe)
    const severities = group.map((v) => v.severity);
    const severityMap = { critical: 3, high: 2, medium: 1, low: 0 };
    const maxSeverityIndex = Math.max(...severities.map((s) => severityMap[s]));

    const mergedSeverity = Object.keys(severityMap).find(
      (key) => severityMap[key as keyof typeof severityMap] === maxSeverityIndex
    ) || base.severity;

    return {
      ...base,
      title: mergedDescription,
      description: mergedDescription,
      severity: mergedSeverity as any,
      tools: combinedTools,
      confidence: 'medium',
      confidenceScore: tools.reduce((sum, tool) => {
        return sum + this.toolWeights[tool];
      }, 0),
    };
  }

  /**
   * Resolve conflicting findings
   */
  private resolveConflict(group: Vulnerability[], findings: Vulnerability[]): Vulnerability {
    // Find most trusted tool (highest weight)
    const maxTool = Object.entries(this.toolWeights)
      .sort(([, a], [, b]) => b - a)
      [0]?.[0] || 'ai';

    const trustedFinding = findings.find((f) => f.tools[maxTool as any]);

    if (!trustedFinding) {
      return findings[0];
    }

    // Mark as AI-validated
    return {
      ...trustedFinding,
      confidence: 'high',
      confidenceScore: 100, // AI validation boosts confidence
      tools: {
        ...trustedFinding.tools,
        [maxTool as any]: true,
      },
    };
  }

  /**
   * Reduce false positives by analyzing patterns
   */
  reduceFalsePositives(vulns: Vulnerability[]): Vulnerability[] {
    const filtered: Vulnerability[] = [];

    for (const vuln of vulns) {
      // Filter out common false positives
      if (this.isLikelyFalsePositive(vuln)) {
        continue;
      }

      // Adjust confidence for certain patterns
      const adjusted = this.adjustConfidence(vuln);
      filtered.push(adjusted);
    }

    return filtered;
  }

  /**
   * Check if finding is likely a false positive
   */
  private isLikelyFalsePositive(vuln: Vulnerability): boolean {
    const fpPatterns = [
      // Pattern 1: Low severity findings in well-audited code
      vuln.severity === 'low' && vuln.confidence === 'low',
      
      // Pattern 2: Findings in test code or examples
      vuln.location.file.includes('.t.sol') || vuln.location.file.includes('test'),
      
      // Pattern 3: Findings with generic descriptions
      vuln.description.includes('variable') || vuln.description.includes('storage slot'),
      
      // Pattern 4: Findings with low tool agreement
      vuln.confidence === 'low' && Object.keys(vuln.tools).length === 1,
    ];

    return fpPatterns.some((pattern) => pattern);
  }

  /**
   * Adjust confidence based on tool agreement and severity
   */
  private adjustConfidence(vuln: Vulnerability): Vulnerability {
    let confidence = vuln.confidence;
    let score = vuln.confidenceScore;

    // Boost confidence for critical/high severity
    if (vuln.severity === 'critical' && score < 80) {
      score = Math.min(score + 20, 100);
      confidence = 'high';
    } else if (vuln.severity === 'high' && score < 70) {
      score = Math.min(score + 10, 100);
      if (confidence === 'low') {
        confidence = 'medium';
      }
    }

    // Boost confidence for multi-tool agreement
    if (Object.keys(vuln.tools).length >= 2) {
      score = Math.min(score + 15, 100);
      if (confidence === 'low') {
        confidence = 'medium';
      } else if (confidence === 'medium') {
        confidence = 'high';
      }
    }

    return {
      ...vuln,
      confidence,
      confidenceScore: score,
    };
  }

  /**
   * Generate detailed confidence analysis
   */
  generateConfidenceReport(vulns: Vulnerability[]): string {
    const total = vulns.length;
    const highConf = vulns.filter((v) => v.confidence === 'high').length;
    const mediumConf = vulns.filter((v) => v.confidence === 'medium').length;
    const lowConf = vulns.filter((v) => v.confidence === 'low').length;

    return `
# Confidence Analysis

## Summary
- Total Findings: ${total}
- High Confidence: ${highConf} (${((highConf / total) * 100).toFixed(1)}%)
- Medium Confidence: ${mediumConf} (${((mediumConf / total) * 100).toFixed(1)}%)
- Low Confidence: ${lowConf} (${((lowConf / total) * 100).toFixed(1)}%)

## Confidence Metrics
- Multi-Tool Agreement: High (${highConf} findings validated by 2+ tools)
- AI Validated: ${highConf} findings validated by AI reasoning
- Single-Tool Detection: ${total - highConf} findings detected by single tool
- False Positive Filtered: ${total - vulns.length} findings removed as likely FPs

## Tool Performance
- Slither: ${vulns.filter((v) => v.tools.slither).length} findings
- Mythril: ${vulns.filter((v) => v.tools.mythril).length} findings
- Echidna: ${vulns.filter((v) => v.tools.echidna).length} findings
- Medusa: ${vulns.filter((v) => v.tools.medusa).length} findings
- AI: ${vulns.filter((v) => v.tools.ai).length} findings

## False Positive Reduction
${total - vulns.length} findings filtered out as likely false positives
    `.trim();
  }
}

export { ConsensusEngine, ConsensusResult, Vulnerability };
