// Core type definitions for Shannon Crypto

export interface ContractInfo {
  address: string;
  network: string;
  sourceCode?: string;
  abi?: any[];
  deploymentTxHash?: string;
}

export interface AuditConfig {
  contract?: ContractInfo;
  sourcePath?: string;
  network: string;
  simulateExploits: boolean;
  useTestnet: boolean;
  outputPath?: string;
  workspaceName?: string;
}

export interface Vulnerability {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
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
    medusa?: boolean;
    ai?: boolean;
  };
  confidence: 'high' | 'medium' | 'low';
  exploit?: {
    contractAddress: string;
    calldata: string;
    value: string;
    expected: string;
    gasUsed?: number;
  };
  recommendation: string;
}

export interface AuditReport {
  contract: ContractInfo;
  auditDate: string;
  overallRisk: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  vulnerabilities: Vulnerability[];
  positiveFindings: string[];
  toolVersions: Record<string, string>;
  metrics: {
    duration: number; // seconds
    toolExecutionTime: Record<string, number>;
    aiTokens: number;
    aiCost: number;
    totalCost: number;
  };
}

export interface ToolResult {
  tool: string;
  version: string;
  success: boolean;
  output: any;
  executionTime: number;
  error?: string;
}

export interface RPCProvider {
  name: string;
  url: string;
  priority: number;
  chainId?: number;
}

export interface AgentConfig {
  model: string;
  maxTurns: number;
  temperature: number;
  maxTokens: number;
}

export interface AIProvider {
  name: 'anthropic' | 'zai' | 'openai';
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface WorkflowStatus {
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStage: string;
  progress: number; // 0-100
  stagesCompleted: string[];
  error?: string;
}
