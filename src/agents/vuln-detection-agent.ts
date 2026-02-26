/**
 * Vulnerability Detection Agent
 * AI agent that combines static analysis results into actionable findings
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import fs from 'fs/promises';
import { join } from 'path';

interface StaticAnalysisResult {
  tool: string;
  vulnerabilities: any[];
  executionTime: number;
  error?: string;
}

interface ContractContext {
  address: string;
  sourceCode?: string;
  abi?: any[];
  network: string;
  contractName?: string;
}

interface DetectionResult {
  vulnerabilityId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvss?: number;
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
    ai?: boolean;
  };
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
  exploit?: {
    type: string;
    description: string;
  };
}

const VulnerabilitySchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  description: z.string(),
  location_file: z.string(),
  location_line_start: z.number(),
  location_line_end: z.number(),
  tools: z.object({
    slither: z.boolean().optional(),
    mythril: z.boolean().optional(),
    echidna: z.boolean().optional(),
  }),
  confidence: z.enum(['high', 'medium', 'low']),
  recommendation: z.string(),
});

/**
 * Analyze contract and static analysis results to detect vulnerabilities
 */
export async function detectVulnerabilities(
  context: ContractContext,
  staticAnalysis: StaticAnalysisResult[]
): Promise<DetectionResult[]> {
  const prompt = this.buildPrompt(context, staticAnalysis);

  const options = {
    model: 'claude-sonnet-4-5-20250929',
    maxTurns: 50,
    permissionMode: 'bypassPermissions' as const,
    allowDangerouslySkipPermissions: true,
  };

  try {
    const messages = [];

    for await (const message of query({ prompt, options })) {
      messages.push(message);

      if (message.type === 'assistant' && message.content) {
        // Parse structured output
        const result = this.parseDetectionResponse(message.content);
        return result;
      }
    }

    throw new Error('Agent failed to produce result');
  } catch (error: any) {
    console.error('Vulnerability detection failed:', error.message);
    throw error;
  }
}

/**
 * Build the analysis prompt for the AI agent
 */
function buildPrompt(
  context: ContractContext,
  staticAnalysis: StaticAnalysisResult[]
): string {
  let prompt = `You are a smart contract security expert. Analyze the contract and static analysis results to identify vulnerabilities.

Contract Details:
- Address: ${context.address}
- Network: ${context.network}
${context.contractName ? `- Name: ${context.contractName}` : ''}
${context.sourceCode ? `- Source Available: Yes (${context.sourceCode.length} bytes)` : '- Source Available: No'}
`;

  // Add source code snippet if available
  if (context.sourceCode && context.sourceCode.length < 10000) {
    prompt += `\n\nContract Source Code:\n\`\`\`solidity\n${context.sourceCode}\n\`\`\`\n`;
  }

  prompt += '\n\nStatic Analysis Results:\n\n';

  // Process each tool's output
  for (const analysis of staticAnalysis) {
    prompt += `## ${analysis.tool}\n`;
    prompt += `Execution Time: ${analysis.executionTime}ms\n`;

    if (analysis.error) {
      prompt += `Error: ${analysis.error}\n\n`;
      continue;
    }

    if (analysis.vulnerabilities && analysis.vulnerabilities.length > 0) {
      prompt += `Vulnerabilities Found: ${analysis.vulnerabilities.length}\n\n`;

      for (const vuln of analysis.vulnerabilities) {
        prompt += `- ${vuln.description}\n`;
      }
    } else {
      prompt += `No vulnerabilities found\n\n`;
    }

    prompt += '\n';
  }

  prompt += `
## Analysis Tasks:

1. **Synthesize Findings** - Combine results from all tools into a unified vulnerability list
2. **Assess Severity** - Classify as Critical, High, Medium, or Low
3. **Identify Patterns** - Look for common vulnerability patterns:
   - Reentrancy
   - Integer Overflow/Underflow
   - Access Control Bypass
   - Unchecked Low-Level Calls
   - Logic Errors
   - Front-Running
   - Timestamp Dependence
   - Flash Loan Vulnerabilities

4. **Estimate CVSS** - Provide CVSS score for each critical/high finding

5. **Cross-Check Tools** - If multiple tools report the same vulnerability, mark as high confidence

6. **Generate Recommendations** - Provide specific, actionable remediation steps

## Output Format:

For each vulnerability, provide a JSON object:
\`\`\`json
{
  "id": "unique-id",
  "title": "short descriptive title",
  "severity": "critical|high|medium|low",
  "cvss": 0.0-10.0,
  "description": "detailed explanation",
  "location": {
    "file": "contract.sol",
    "line_start": 10,
    "line_end": 20
  },
  "tools": {
    "slither": true,
    "mythril": false,
    "echidna": false
  },
  "confidence": "high|medium|low",
  "recommendation": "specific fix",
  "exploit": {
    "type": "reentrancy|overflow|access-control",
    "description": "how to exploit"
  }
}
\`\`\`

Analyze thoroughly and provide findings for ALL vulnerabilities, not just critical ones.
`;

  return prompt;
}

/**
 * Parse the AI agent's response into structured detection results
 */
function parseDetectionResponse(content: string): DetectionResult[] {
  const results: DetectionResult[] = [];

  // Extract JSON objects from the response
  const jsonPattern = /\{[\s\S]*?\}/g;
  const matches = content.match(jsonPattern);

  if (!matches || matches.length === 0) {
    console.warn('No structured output found in agent response');
    // Try to extract vulnerabilities from text
    return extractVulnerabilitiesFromText(content);
  }

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match);

      // Validate schema
      const validated = VulnerabilitySchema.parse(parsed);

      results.push({
        vulnerabilityId: validated.id,
        title: validated.title,
        severity: validated.severity,
        cvss: validated.cvss,
        description: validated.description,
        location: {
          file: validated.location_file,
          lineStart: validated.location_line_start,
          lineEnd: validated.location_line_end,
        },
        tools: {
          slither: validated.tools.slither,
          mythril: validated.tools.mythril,
          echidna: validated.tools.echidna,
          ai: true, // AI detected
        },
        confidence: validated.confidence,
        recommendation: validated.recommendation,
        exploit: validated.exploit,
      });
    } catch (error: any) {
      console.warn('Failed to parse detection result:', error.message);
    }
  }

  return results;
}

/**
 * Extract vulnerabilities from unstructured text
 */
function extractVulnerabilitiesFromText(content: string): DetectionResult[] {
  const results: DetectionResult[] = [];
  const patterns = [
    {
      name: 'reentrancy',
      regex: /reentrancy/gi,
      severity: 'critical' as const,
    },
    {
      name: 'overflow',
      regex: /overflow/gi,
      severity: 'critical' as const,
    },
    {
      name: 'access-control',
      regex: /access.?control/gi,
      severity: 'high' as const,
    },
    {
      name: 'low-level-call',
      regex: /low.?level.?call/gi,
      severity: 'high' as const,
    },
    {
      name: 'timestamp-dependence',
      regex: /timestamp.?dependence/gi,
      severity: 'medium' as const,
    },
  ];

  let idCounter = 1;

  for (const pattern of patterns) {
    const matches = content.match(pattern.regex);
    if (matches && matches.length > 0) {
      results.push({
        vulnerabilityId: `VULN-${String(idCounter++).padStart(3, '0')}`,
        title: `${pattern.name} detected`,
        severity: pattern.severity,
        cvss: pattern.severity === 'critical' ? 9.0 : pattern.severity === 'high' ? 7.5 : 5.0,
        description: `AI detected ${pattern.name} pattern in analysis output`,
        location: {
          file: 'unknown',
          lineStart: 0,
          lineEnd: 0,
        },
        tools: {
          ai: true, // Text extraction only
        },
        confidence: 'medium' as const,
        recommendation: `Review for ${pattern.name} and add appropriate checks`,
      });
    }
  }

  return results;
}

export { detectVulnerabilities, DetectionResult, ContractContext, StaticAnalysisResult };
