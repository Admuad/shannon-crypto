/**
 * Main Audit Orchestrator
 * Coordinates static analysis, AI detection, and reporting
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';

import { SlitherWrapper } from '../tools/slither-wrapper.js';
import { detectVulnerabilities, ContractContext, StaticAnalysisResult } from '../agents/vuln-detection-agent.js';
import RPCManager from '../tools/rpc-manager.js';
import { writeReport } from './report-generator.js';

interface AuditOptions {
  contract?: string;
  sourcePath?: string;
  network: string;
  simulateExploits: boolean;
  useTestnet: boolean;
  outputPath?: string;
  workspaceName?: string;
}

interface AuditResult {
  contract: ContractContext;
  vulnerabilities: any[];
  metrics: {
    duration: number;
    toolExecutionTime: Record<string, number>;
    aiTokens: number;
  };
  reportPath: string;
}

/**
 * Main audit entry point
 */
export async function startAudit(options: AuditOptions): Promise<AuditResult> {
  const startTime = Date.now();

  // 1. Validate input
  if (!options.contract && !options.sourcePath) {
    throw new Error('Either --contract address or --source path is required');
  }

  console.log(chalk.cyan.bold('\n=== Shannon Crypto Audit ===\n'));
  console.log(chalk.white(`Target: ${options.contract || options.sourcePath}`));
  console.log(chalk.white(`Network: ${options.network}`));
  console.log('');

  // 2. Create workspace
  const workspacePath = await createWorkspace(options.workspaceName);
  console.log(chalk.gray(`Workspace: ${workspacePath}`));
  console.log('');

  // 3. Fetch contract info
  const contractContext = await fetchContractInfo(options, workspacePath);
  console.log(chalk.gray(`Contract: ${contractContext.address}`));

  // 4. Run static analysis
  console.log(chalk.cyan.bold('\n[1/4] Running Static Analysis...\n'));
  const staticResults = await runStaticAnalysis(contractContext, workspacePath);

  // 5. AI vulnerability detection
  console.log(chalk.cyan.bold('\n[2/4] Running AI Detection...\n'));
  const detectedVulns = await detectVulnerabilities(contractContext, staticResults);

  // 6. Simulate exploits (if requested)
  let exploitResults: any[] = [];
  if (options.simulateExploits) {
    console.log(chalk.cyan.bold('\n[3/4] Simulating Exploits...\n'));
    exploitResults = await simulateExploits(detectedVulns, contractContext, options.useTestnet);
  }

  // 7. Generate report
  console.log(chalk.cyan.bold('\n[4/4] Generating Report...\n'));
  const allFindings = [...detectedVulns, ...exploitResults];
  const reportPath = await writeReport(
    contractContext,
    allFindings,
    staticResults,
    {
      duration: Date.now() - startTime,
      toolExecutionTime: {
        slither: staticResults.find((r) => r.tool === 'Slither')?.executionTime || 0,
      },
      aiTokens: 0, // TODO: Track from agent
    },
    workspacePath
  );

  console.log(chalk.green.bold('\n✅ Audit Complete!'));
  console.log(chalk.white(`Report: ${reportPath}`));
  console.log('');
  console.log(chalk.gray(`Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`));
  console.log('');

  return {
    contract: contractContext,
    vulnerabilities: allFindings,
    metrics: {
      duration: Date.now() - startTime,
      toolExecutionTime: {
        slither: staticResults.find((r) => r.tool === 'Slither')?.executionTime || 0,
      },
      aiTokens: 0,
    },
    reportPath,
  };
}

/**
 * Create workspace directory
 */
async function createWorkspace(name?: string): Promise<string> {
  const timestamp = Date.now();
  const workspaceName = name || `audit-${timestamp}`;

  const workspacePath = path.join(process.cwd(), 'audit-logs', workspaceName);

  await fs.mkdir(workspacePath, { recursive: true });

  return workspacePath;
}

/**
 * Fetch contract information
 */
async function fetchContractInfo(options: AuditOptions, workspacePath: string): Promise<ContractContext> {
  const rpc = new RPCManager([
    { name: 'alchemy', url: process.env.ETHEREUM_RPC_URL || '', priority: 1 },
    { name: 'infura', url: process.env.ETHEREUM_RPC_URL || '', priority: 2 },
  ]);

  let address: string;
  let sourceCode: string | undefined;
  let abi: any[] | undefined;

  if (options.contract) {
    address = options.contract;
  } else {
    // TODO: Find contract addresses in source
    throw new Error('Source path analysis not yet implemented');
  }

  // Get bytecode
  const code = await rpc.getCode(address);

  if (code === '0x') {
    throw new Error(`No contract found at address ${address}`);
  }

  // Try to fetch source from Etherscan
  // TODO: Implement Etherscan API fetching

  return {
    address,
    network: options.network,
    sourceCode,
    abi,
  };
}

/**
 * Run static analysis tools
 */
async function runStaticAnalysis(
  contract: ContractContext,
  workspacePath: string
): Promise<StaticAnalysisResult[]> {
  const results: StaticAnalysisResult[] = [];

  // Run Slither
  const slither = new SlitherWrapper();

  const slitherInstalled = await slither.checkInstallation();

  if (!slitherInstalled) {
    console.warn(chalk.yellow('Slither not found. Installing...'));

    try {
      await exec('pip install -U slither-analyzer', {
        timeout: 60000,
      });
      console.log(chalk.green('✅ Slither installed'));
    } catch (error: any) {
      throw new Error('Failed to install Slither');
    }
  }

  const target = contract.sourceCode || contract.address;

  const slitherSpinner = ora('Running Slither...').start();

  const slitherStart = Date.now();

  try {
    const slitherOutput = await slither.analyze({
      target,
      outputJson: path.join(workspacePath, 'slither-results.json'),
      detectors: [
        'reentrancy-eth',
        'arbitrary-send-eth',
        'delegatecall',
        'tx-origin',
        'integer-overflow',
        'unprotected-send-eth',
        'access-control',
      ],
    });

    results.push({
      tool: 'Slither',
      vulnerabilities: slitherOutput.vulnerabilities || [],
      executionTime: Date.now() - slitherStart,
    });

    slitherSpinner.succeed(`Slither complete (${((Date.now() - slitherStart) / 1000).toFixed(1)}s)`);
  } catch (error: any) {
    slitherSpinner.fail(`Slither failed: ${error.message}`);
    results.push({
      tool: 'Slither',
      vulnerabilities: [],
      executionTime: Date.now() - slitherStart,
      error: error.message,
    });
  }

  // TODO: Add Mythril, Echidna

  return results;
}

/**
 * Simulate exploits (basic implementation)
 */
async function simulateExploits(
  vulnerabilities: any[],
  contract: ContractContext,
  useTestnet: boolean
): Promise<any[]> {
  const results: any[] = [];

  if (!useTestnet) {
    console.log(chalk.yellow('⚠️  Skipping exploit simulation (use --testnet to enable)'));
    return results;
  }

  // TODO: Implement actual exploit simulation
  // For MVP, we'll just mark vulnerabilities as "not tested"

  for (const vuln of vulnerabilities) {
    results.push({
      ...vuln,
      exploitStatus: 'not_tested',
      reason: 'Exploit simulation not yet implemented',
    });
  }

  return results;
}

export { startAudit, AuditOptions, AuditResult };
