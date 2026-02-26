/**
 * Multi-Chain Etherscan API Client
 * Fetches contract source code and ABIs from multiple block explorers
 * Supports rate limiting and caching
 */

const axios = 'axios';

interface EtherscanConfig {
  apiKey: string;
  baseUrl: string;
  rateLimit: number; // requests per second
  chainName: string;
  chainId: number;
  currency: string;
}

interface ContractInfo {
  address: string;
  chain: string;
  sourceCode: string;
  abi: any[];
  contractName: string;
  compilerVersion: string;
  optimization: boolean;
  verified: boolean;
}

const CHAIN_CONFIGS: Record<string, EtherscanConfig> = {
  ethereum: {
    apiKey: process.env.ETHERSCAN_API_KEY || '',
    baseUrl: 'https://api.etherscan.io/api',
    rateLimit: 5, // 5 requests per second
    chainName: 'Ethereum',
    chainId: 1,
    currency: 'ETH',
  },
  bnb: {
    apiKey: process.env.BSCSCAN_API_KEY || '',
    baseUrl: 'https://api.bscscan.com/api',
    rateLimit: 5,
    chainName: 'BNB Chain',
    chainId: 56,
    currency: 'BNB',
  },
  bnb_testnet: {
    apiKey: process.env.BSCSCAN_API_KEY || '',
    baseUrl: 'https://api-testnet.bscscan.com/api',
    rateLimit: 5,
    chainName: 'BNB Chain Testnet',
    chainId: 97,
    currency: 'tBNB',
  },
  polygon: {
    apiKey: process.env.POLYGONSCAN_API_KEY || '',
    baseUrl: 'https://api.polygonscan.com/api',
    rateLimit: 5,
    chainName: 'Polygon',
    chainId: 137,
    currency: 'MATIC',
  },
  polygon_mumbai: {
    apiKey: process.env.POLYGONSCAN_API_KEY || '',
    baseUrl: 'https://api-testnet.polygonscan.com/api',
    rateLimit: 5,
    chainName: 'Polygon Mumbai',
    chainId: 80001,
    currency: 'tMATIC',
  },
  arbitrum: {
    apiKey: process.env.ARBISCAN_API_KEY || '',
    baseUrl: 'https://api.arbiscan.io/api',
    rateLimit: 5,
    chainName: 'Arbitrum One',
    chainId: 42161,
    currency: 'ETH',
  },
  arbitrum_goerli: {
    apiKey: process.env.ARBISCAN_API_KEY || '',
    baseUrl: 'https://api-goerli.arbiscan.io/api',
    rateLimit: 5,
    chainName: 'Arbitrum Goerli',
    chainId: 421613,
    currency: 'ETH',
  },
  optimism: {
    apiKey: process.env.OPSCAN_API_KEY || '',
    baseUrl: 'https://api-optimistic.etherscan.io/api',
    rateLimit: 5,
    chainName: 'Optimism',
    chainId: 10,
    currency: 'ETH',
  },
  optimism_goerli: {
    apiKey: process.env.OPSCAN_API_KEY || '',
    baseUrl: 'https://api-goerli-optimistic.etherscan.io/api',
    rateLimit: 5,
    chainName: 'Optimism Goerli',
    chainId: 420,
    currency: 'ETH',
  },
  avalanche: {
    apiKey: process.env.SNOWTRACE_API_KEY || '',
    baseUrl: 'https://api.snowtrace.io/api',
    rateLimit: 5,
    chainName: 'Avalanche',
    chainId: 43114,
    currency: 'AVAX',
  },
  avalanche_fuji: {
    apiKey: process.env.SNOWTRACE_API_KEY || '',
    baseUrl: 'https://api-testnet.snowtrace.io/api',
    rateLimit: 5,
    chainName: 'Avalanche Fuji',
    chainId: 43113,
    currency: 'AVAX',
  },
};

class MultiChainEtherscanClient {
  private cache: Map<string, ContractInfo> = new Map();
  private rateLimiters: Map<string, { lastCall: number; pending: number }> = new Map();

  constructor() {
    this.initializeRateLimiters();
  }

  /**
   * Initialize rate limiters for each chain
   */
  private initializeRateLimiters(): void {
    for (const [chain, config] of Object.entries(CHAIN_CONFIGS)) {
      this.rateLimiters.set(chain, {
        lastCall: 0,
        pending: 0,
      });
    }
  }

  /**
   * Wait for rate limit
   */
  private async waitForRateLimit(chain: string): Promise<void> {
    const config = CHAIN_CONFIGS[chain];
    if (!config) return;

    const limiter = this.rateLimiters.get(chain);
    if (!limiter) return;

    const now = Date.now();
    const minInterval = 1000 / config.rateLimit;

    if (now - limiter.lastCall < minInterval) {
      const waitTime = minInterval - (now - limiter.lastCall);
      console.log(`Rate limiting ${chain} API, waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    limiter.lastCall = Date.now();
  }

  /**
   * Get contract source code
   */
  async getSourceCode(address: string, chain: string): Promise<string> {
    const config = CHAIN_CONFIGS[chain];
    if (!config) {
      throw new Error(`Unknown chain: ${chain}`);
    }

    await this.waitForRateLimit(chain);

    try {
      console.log(`Fetching source code for ${address} on ${chain}...`);

      const url = `${config.baseUrl}?module=contract&action=getsourcecode&address=${address}&apikey=${config.apiKey}`;

      const response = await axios.get(url, {
        timeout: 30000,
      });

      if (response.data.status !== '1') {
        console.warn(`Failed to fetch source code: ${response.data.message || 'Unknown error'}`);
        return '';
      }

      const result = response.data.result;

      if (!result || result.length === 0) {
        console.warn(`No source code found for ${address}`);
        return '';
      }

      const sourceCode = result[0].SourceCode;

      if (typeof sourceCode === 'string') {
        return sourceCode;
      } else if (typeof sourceCode === 'object' && sourceCode) {
        // Handle multi-part source code
        return sourceCode['{0}'] || '';
      }

      console.warn(`No source code found for ${address}`);
      return '';
    } catch (error: any) {
      console.error(`Failed to fetch source code for ${address}:`, error.message);
      return '';
    }
  }

  /**
   * Get contract ABI
   */
  async getABI(address: string, chain: string): Promise<any[]> {
    const config = CHAIN_CONFIGS[chain];
    if (!config) {
      throw new Error(`Unknown chain: ${chain}`);
    }

    await this.waitForRateLimit(chain);

    try {
      console.log(`Fetching ABI for ${address} on ${chain}...`);

      const url = `${config.baseUrl}?module=contract&action=getabi&address=${address}&apikey=${config.apiKey}`;

      const response = await axios.get(url, {
        timeout: 30000,
      });

      if (response.data.status !== '1') {
        console.warn(`Failed to fetch ABI: ${response.data.message || 'Unknown error'}`);
        return [];
      }

      const abi = response.data.result;

      if (!abi) {
        console.warn(`No ABI found for ${address}`);
        return [];
      }

      if (typeof abi === 'string') {
        try {
          return JSON.parse(abi);
        } catch (error: any) {
          console.warn(`Failed to parse ABI for ${address}:`, error.message);
          return [];
        }
      }

      return abi || [];
    } catch (error: any) {
      console.error(`Failed to fetch ABI for ${address}:`, error.message);
      return [];
    }
  }

  /**
   * Get contract info (source code + ABI)
   */
  async getContractInfo(address: string, chain: string): Promise<ContractInfo> {
    const config = CHAIN_CONFIGS[chain];
    if (!config) {
      throw new Error(`Unknown chain: ${chain}`);
    }

    // Check cache
    const cacheKey = `${chain}:${address}`;
    if (this.cache.has(cacheKey)) {
      console.log(`Using cached contract info for ${address} on ${chain}`);
      return this.cache.get(cacheKey)!;
    }

    await this.waitForRateLimit(chain);

    try {
      console.log(`Fetching contract info for ${address} on ${chain}...`);

      const [sourceCode, abi] = await Promise.all([
        this.getSourceCode(address, chain),
        this.getABI(address, chain),
      ]);

      const sourceCodeResponse = await axios.get(
        `${config.baseUrl}?module=contract&action=getsourcecode&address=${address}&apikey=${config.apiKey}`,
        { timeout: 30000 }
      );

      const contractInfo: ContractInfo = {
        address,
        chain,
        sourceCode,
        abi,
        contractName: '',
        compilerVersion: '',
        optimization: false,
        verified: false,
      };

      if (sourceCodeResponse.data.status === '1' && sourceCodeResponse.data.result) {
        const result = sourceCodeResponse.data.result[0] || {};

        contractInfo.contractName = result.ContractName || '';
        contractInfo.compilerVersion = result.CompilerVersion || '';
        contractInfo.optimization = result.OptimizationUsed === '1';
        contractInfo.verified = sourceCode.length > 0;
      }

      // Cache the result
      this.cache.set(cacheKey, contractInfo);

      return contractInfo;
    } catch (error: any) {
      console.error(`Failed to fetch contract info for ${address} on ${chain}:`, error.message);
      return {
        address,
        chain,
        sourceCode: '',
        abi: [],
        contractName: '',
        compilerVersion: '',
        optimization: false,
        verified: false,
      };
    }
  }

  /**
   * Get contract transactions
   */
  async getTransactions(address: string, chain: string, startBlock?: number, endBlock?: number): Promise<any[]> {
    const config = CHAIN_CONFIGS[chain];
    if (!config) {
      throw new Error(`Unknown chain: ${chain}`);
    }

    await this.waitForRateLimit(chain);

    try {
      console.log(`Fetching transactions for ${address} on ${chain}...`);

      let url = `${config.baseUrl}?module=account&action=txlist&address=${address}&apikey=${config.apiKey}&sort=asc&offset=0&page=1`;

      if (startBlock !== undefined) {
        url += `&startBlock=${startBlock}`;
      }

      if (endBlock !== undefined) {
        url += `&endBlock=${endBlock}`;
      }

      const response = await axios.get(url, {
        timeout: 30000,
      });

      if (response.data.status !== '1') {
        console.warn(`Failed to fetch transactions: ${response.data.message || 'Unknown error'}`);
        return [];
      }

      const transactions = response.data.result || [];

      console.log(`Found ${transactions.length} transactions`);

      return transactions;
    } catch (error: any) {
      console.error(`Failed to fetch transactions for ${address} on ${chain}:`, error.message);
      return [];
    }
  }

  /**
   * Get multiple contracts info in parallel
   */
  async getMultipleContractsInfo(addresses: string[], chain: string): Promise<ContractInfo[]> {
    console.log(`Fetching info for ${addresses.length} contracts on ${chain} in parallel...`);

    const infos = await Promise.all(
      addresses.map(address => this.getContractInfo(address, chain))
    );

    return infos;
  }

  /**
   * Get contract info across multiple chains
   */
  async getContractInfoMultiChain(address: string, chains: string[]): Promise<Map<string, ContractInfo>> {
    console.log(`Fetching info for ${address} across ${chains.length} chains...`);

    const results = new Map<string, ContractInfo>();

    const chainPromises = chains.map(async (chain) => {
      try {
        const info = await this.getContractInfo(address, chain);
        results.set(chain, info);
      } catch (error: any) {
        console.error(`Failed to fetch info for ${address} on ${chain}:`, error.message);
      }
    });

    await Promise.all(chainPromises);

    return results;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('Etherscan cache cleared');
  }

  /**
   * Get API status for a chain
   */
  async getAPIStatus(chain: string): Promise<any> {
    const config = CHAIN_CONFIGS[chain];
    if (!config) {
      throw new Error(`Unknown chain: ${chain}`);
    }

    try {
      const url = `${config.baseUrl}?module=stats&action=getchainstats&apikey=${config.apiKey}`;

      const response = await axios.get(url, {
        timeout: 30000,
      });

      return {
        chain,
        status: response.data.status === '1' ? 'OK' : 'ERROR',
        data: response.data.result || {},
      };
    } catch (error: any) {
      return {
        chain,
        status: 'ERROR',
        error: error.message,
      };
    }
  }

  /**
   * Get all supported chains
   */
  getSupportedChains(): string[] {
    return Object.keys(CHAIN_CONFIGS);
  }

  /**
   * Get chain config
   */
  getChainConfig(chain: string): EtherscanConfig | undefined {
    return CHAIN_CONFIGS[chain];
  }

  /**
   * Get chain block explorer URL
   */
  getBlockExplorer(chain: string): string {
    const config = CHAIN_CONFIGS[chain];
    return config ? config.baseUrl.replace('/api', '') : '';
  }
}

module.exports = MultiChainEtherscanClient;
