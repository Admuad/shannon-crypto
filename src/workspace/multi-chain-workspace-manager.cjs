/**
 * Multi-Chain Workspace Manager
 * Tracks chains, workspaces, and cross-chain state
 * Supports per-chain configurations and reports
 */

const fs = require('fs');
const path = require('path');

interface ChainWorkspace {
  workspaceId: string;
  chains: Record<string, any>;
  contracts: Record<string, { [chain: string]: any }>;
  vulnerabilities: Record<string, any[]>;
  reports: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

interface MultiChainWorkspaceConfig {
  defaultChain: string;
  supportedChains: string[];
  workspaceDir: string;
}

const DEFAULT_CONFIG: MultiChainWorkspaceConfig = {
  defaultChain: 'ethereum',
  supportedChains: ['ethereum', 'bnb', 'polygon', 'arbitrum', 'optimism', 'avalanche'],
  workspaceDir: './workspaces',
};

class MultiChainWorkspaceManager {
  private config: MultiChainWorkspaceConfig;
  private workspaces: Map<string, ChainWorkspace>;
  private currentWorkspace: string | null;

  constructor(config?: MultiChainWorkspaceConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.workspaces = new Map();
    this.currentWorkspace = null;

    this.loadWorkspaces();
  }

  /**
   * Load all workspaces from disk
   */
  private loadWorkspaces(): void {
    if (!fs.existsSync(this.config.workspaceDir)) {
      return;
    }

    const workspaceDirs = fs.readdirSync(this.config.workspaceDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    for (const workspaceId of workspaceDirs) {
      const workspacePath = path.join(this.config.workspaceDir, workspaceId);
      const configPath = path.join(workspacePath, 'workspace.json');

      if (fs.existsSync(configPath)) {
        try {
          const workspace = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          this.workspaces.set(workspaceId, workspace);
        } catch (error: any) {
          console.error(`Failed to load workspace ${workspaceId}:`, error.message);
        }
      }
    }

    console.log(`Loaded ${this.workspaces.size} workspaces from disk`);
  }

  /**
   * Create new multi-chain workspace
   */
  async createWorkspace(workspaceId: string, chains: string[] = []): Promise<ChainWorkspace> {
    console.log(`\nCreating multi-chain workspace: ${workspaceId}`);
    console.log(`Chains: ${chains.join(', ')}`);

    const workspacePath = path.join(this.config.workspaceDir, workspaceId);

    // Create workspace directory
    await fs.promises.mkdir(workspacePath, { recursive: true });

    // Create subdirectories for each chain
    for (const chain of chains.length > 0 ? chains : this.config.supportedChains) {
      const chainPath = path.join(workspacePath, chain);
      await fs.promises.mkdir(chainPath, { recursive: true });
    }

    // Create workspace configuration
    const workspace: ChainWorkspace = {
      workspaceId,
      chains: {},
      contracts: {},
      vulnerabilities: {},
      reports: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Initialize chains with empty data
    for (const chain of this.config.supportedChains) {
      workspace.chains[chain] = {
        contracts: [],
        vulnerabilities: [],
        reports: [],
        config: {},
      };
    }

    // Save workspace to disk
    await this.saveWorkspace(workspaceId, workspace);
    this.workspaces.set(workspaceId, workspace);

    console.log(`✅ Workspace created: ${workspaceId}`);
    return workspace;
  }

  /**
   * Save workspace to disk
   */
  async saveWorkspace(workspaceId: string, workspace: ChainWorkspace): Promise<void> {
    const workspacePath = path.join(this.config.workspaceDir, workspaceId);

    // Create workspace directory if it doesn't exist
    if (!fs.existsSync(workspacePath)) {
      await fs.promises.mkdir(workspacePath, { recursive: true });
    }

    const configPath = path.join(workspacePath, 'workspace.json');
    await fs.promises.writeFile(configPath, JSON.stringify(workspace, null, 2), 'utf8');

    workspace.updatedAt = new Date();
    this.workspaces.set(workspaceId, workspace);
  }

  /**
   * Load workspace from disk
   */
  async loadWorkspace(workspaceId: string): Promise<ChainWorkspace | null> {
    const workspace = this.workspaces.get(workspaceId);

    if (workspace) {
      console.log(`✅ Workspace loaded: ${workspaceId}`);
      return workspace;
    }

    // Try to load from disk
    const workspacePath = path.join(this.config.workspaceDir, workspaceId);
    const configPath = path.join(workspacePath, 'workspace.json');

    if (!fs.existsSync(configPath)) {
      console.log(`❌ Workspace not found: ${workspaceId}`);
      return null;
    }

    try {
      const workspaceData = JSON.parse(await fs.promises.readFile(configPath, 'utf8'));
      this.workspaces.set(workspaceId, workspaceData);
      this.currentWorkspace = workspaceId;

      console.log(`✅ Workspace loaded: ${workspaceId}`);
      return workspaceData;
    } catch (error: any) {
      console.error(`❌ Failed to load workspace ${workspaceId}:`, error.message);
      return null;
    }
  }

  /**
   * Switch to workspace
   */
  async switchWorkspace(workspaceId: string): Promise<boolean> {
    const workspace = await this.loadWorkspace(workspaceId);

    if (workspace) {
      this.currentWorkspace = workspaceId;
      console.log(`✅ Switched to workspace: ${workspaceId}`);
      return true;
    } else {
      console.log(`❌ Failed to switch to workspace: ${workspaceId}`);
      return false;
    }
  }

  /**
   * Add contract to workspace
   */
  async addContract(
    workspaceId: string,
    contractAddress: string,
    chain: string,
    contractData: any
  ): Promise<void> {
    const workspace = await this.loadWorkspace(workspaceId);

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Add contract to workspace
    if (!workspace.contracts[contractAddress]) {
      workspace.contracts[contractAddress] = {};
    }

    workspace.contracts[contractAddress][chain] = {
      address: contractAddress,
      chain,
      addedAt: new Date(),
      ...contractData,
    };

    // Add to chain's contracts list
    if (workspace.chains[chain]) {
      workspace.chains[chain].contracts.push(contractAddress);
    }

    await this.saveWorkspace(workspaceId, workspace);
    console.log(`✅ Contract added: ${contractAddress} on ${chain}`);
  }

  /**
   * Add contract to multiple chains
   */
  async addContractMultiChain(
    workspaceId: string,
    contractAddress: string,
    chains: string[],
    contractData: any
  ): Promise<void> {
    const workspace = await this.loadWorkspace(workspaceId);

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Add contract to all specified chains
    for (const chain of chains) {
      if (!workspace.contracts[contractAddress]) {
        workspace.contracts[contractAddress] = {};
      }

      workspace.contracts[contractAddress][chain] = {
        address: contractAddress,
        chain,
        addedAt: new Date(),
        ...contractData,
      };

      // Add to chain's contracts list
      if (workspace.chains[chain]) {
        workspace.chains[chain].contracts.push(contractAddress);
      }
    }

    await this.saveWorkspace(workspaceId, workspace);
    console.log(`✅ Contract added: ${contractAddress} on ${chains.length} chains`);
  }

  /**
   * Add vulnerabilities to workspace
   */
  async addVulnerabilities(
    workspaceId: string,
    contractAddress: string,
    chain: string,
    vulnerabilities: any[]
  ): Promise<void> {
    const workspace = await this.loadWorkspace(workspaceId);

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Add vulnerabilities to workspace
    const key = `${contractAddress}:${chain}`;
    if (!workspace.vulnerabilities[key]) {
      workspace.vulnerabilities[key] = [];
    }

    workspace.vulnerabilities[key] = vulnerabilities;

    // Add to chain's vulnerabilities list
    if (workspace.chains[chain]) {
      workspace.chains[chain].vulnerabilities.push(...vulnerabilities);
    }

    await this.saveWorkspace(workspaceId, workspace);
    console.log(`✅ Vulnerabilities added: ${vulnerabilities.length} for ${contractAddress} on ${chain}`);
  }

  /**
   * Add report to workspace
   */
  async addReport(
    workspaceId: string,
    contractAddress: string,
    chain: string,
    report: string
  ): Promise<void> {
    const workspace = await this.loadWorkspace(workspaceId);

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Add report to workspace
    const key = `${contractAddress}:${chain}`;
    workspace.reports[key] = report;

    // Add to chain's reports list
    if (workspace.chains[chain]) {
      workspace.chains[chain].reports.push(key);
    }

    await this.saveWorkspace(workspaceId, workspace);

    // Save report to file
    const chainDir = path.join(this.config.workspaceDir, workspaceId, chain);
    await fs.promises.mkdir(chainDir, { recursive: true });

    const reportPath = path.join(chainDir, `${contractAddress.replace('0x', '')}-report.md`);
    await fs.promises.writeFile(reportPath, report, 'utf8');

    console.log(`✅ Report saved: ${contractAddress} on ${chain}`);
  }

  /**
   * Get workspace info
   */
  getWorkspaceInfo(workspaceId: string): ChainWorkspace | null {
    return this.workspaces.get(workspaceId) || null;
  }

  /**
   * Get current workspace
   */
  getCurrentWorkspace(): string | null {
    return this.currentWorkspace;
  }

  /**
   * List all workspaces
   */
  listWorkspaces(): string[] {
    return Array.from(this.workspaces.keys());
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    const workspacePath = path.join(this.config.workspaceDir, workspaceId);

    if (!fs.existsSync(workspacePath)) {
      console.log(`❌ Workspace not found: ${workspaceId}`);
      return false;
    }

    // Delete workspace directory
    await fs.promises.rm(workspacePath, { recursive: true });
    this.workspaces.delete(workspaceId);
    this.currentWorkspace = null;

    console.log(`✅ Workspace deleted: ${workspaceId}`);
    return true;
  }

  /**
   * Get workspace statistics
   */
  getWorkspaceStats(workspaceId: string): any {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return null;
    }

    const stats = {
      workspaceId,
      chains: Object.keys(workspace.chains).length,
      contracts: Object.keys(workspace.contracts).length,
      vulnerabilities: Object.keys(workspace.vulnerabilities).reduce((sum, key) => {
        return sum + workspace.vulnerabilities[key].length;
      }, 0),
      reports: Object.keys(workspace.reports).length,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };

    return stats;
  }

  /**
   * Generate workspace summary
   */
  generateWorkspaceSummary(workspaceId: string): string {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return 'Workspace not found';
    }

    let summary = `# Multi-Chain Workspace Summary

**Workspace ID:** ${workspace.workspaceId}
**Created At:** ${workspace.createdAt.toISOString()}
**Updated At:** ${workspace.updatedAt.toISOString()}

---

## Chains (${Object.keys(workspace.chains).length})

`;

    // Add chain info
    for (const [chain, data] of Object.entries(workspace.chains)) {
      summary += `### ${chain.charAt(0).toUpperCase() + chain.slice(1)}

`;
      summary += `- Contracts: ${data.contracts.length}
`;
      summary += `- Vulnerabilities: ${data.vulnerabilities.length}
`;
      summary += `- Reports: ${data.reports.length}
`;
      summary += '\n';
    }

    // Add contracts
    summary += `## Contracts (${Object.keys(workspace.contracts).length})

`;

    for (const [address, data] of Object.entries(workspace.contracts)) {
      summary += `### ${address}

`;
      summary += `- Analyzed on chains: ${Object.keys(data).join(', ')}
`;
      summary += `- Added at: ${new Date(Object.values(data)[0]?.addedAt || Date.now()).toISOString()}
`;
      summary += '\n';
    }

    return summary;
  }
}

module.exports = MultiChainWorkspaceManager;
