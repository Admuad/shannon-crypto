/**
 * RPC Manager - Multi-provider fallback for blockchain access
 */

import axios from 'axios';
import { ethers } from 'ethers';

interface RPCProvider {
  name: string;
  url: string;
  priority: number;
  chainId?: number;
}

export class RPCManager {
  private providers: RPCProvider[];
  private currentIndex: number = 0;

  constructor(providers: RPCProvider[]) {
    this.providers = providers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Execute a read-only call with automatic fallback
   */
  async call<T>(
    method: string,
    params: any[] = [],
    retries: number = 3
  ): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      const provider = this.providers[this.currentIndex];

      try {
        const response = await axios.post(provider.url, {
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        }, {
          timeout: 10000,
        });

        return response.data.result as T;
      } catch (error: any) {
        const isRetryable = this.isRetryableError(error);

        if (isRetryable && attempt < retries - 1) {
          console.warn(`${provider.name} failed (attempt ${attempt + 1}), trying next provider...`);
          this.rotateProvider();
          continue;
        }

        throw error;
      }
    }

    throw new Error(`All RPC providers failed for ${method}`);
  }

  /**
   * Send a transaction with provider selection
   */
  async sendTransaction(tx: any): Promise<any> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const provider = this.providers[this.currentIndex];

      try {
        const response = await axios.post(provider.url, {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_sendTransaction',
          params: [tx],
        }, {
          timeout: 60000,
        });

        return response.data.result;
      } catch (error: any) {
        if (!this.isRetryableError(error) || attempt >= 2) {
          throw error;
        }

        console.warn(`${provider.name} failed (attempt ${attempt + 1}), trying next provider...`);
        this.rotateProvider();
      }
    }

    throw new Error('All RPC providers failed to send transaction');
  }

  /**
   * Get transaction receipt with polling
   */
  async getTransactionReceipt(txHash: string): Promise<any> {
    let retries = 0;
    const maxRetries = 120; // 2 minutes with 1-second polls
    const pollInterval = 1000;

    while (retries < maxRetries) {
      for (let providerIdx = 0; providerIdx < this.providers.length; providerIdx++) {
        try {
          const receipt = await this.call('eth_getTransactionReceipt', [txHash]);

          if (receipt) {
            return receipt;
          }
        } catch (error: any) {
          if (!this.isRetryableError(error)) {
            throw error;
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      retries++;
    }

    throw new Error(`Transaction receipt not found after ${maxRetries} seconds`);
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(tx: any): Promise<bigint> {
    try {
      const gasEstimate = await this.call('eth_estimateGas', [tx]);
      return BigInt(gasEstimate || '0x0');
    } catch (error: any) {
      console.error('Gas estimation failed:', error.message);
      return BigInt(0);
    }
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      return await this.call('eth_blockNumber');
    } catch (error: any) {
      console.error('Failed to get block number:', error.message);
      return 0;
    }
  }

  /**
   * Get code at an address (for verification)
   */
  async getCode(address: string): Promise<string> {
    try {
      const code = await this.call('eth_getCode', [address, 'latest']);
      return code || '0x';
    } catch (error: any) {
      console.error(`Failed to get code for ${address}:`, error.message);
      return '0x';
    }
  }

  /**
   * Rotate to next provider
   */
  private rotateProvider(): void {
    this.currentIndex = (this.currentIndex + 1) % this.providers.length;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableCodes = ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];
    const retryableMessages = ['network timeout', 'timeout', 'rate limit exceeded'];

    const errorCode = error.code || '';
    const errorMessage = (error.message || '').toLowerCase();

    return (
      retryableCodes.includes(errorCode) ||
      retryableMessages.some((msg) => errorMessage.includes(msg))
    );
  }

  /**
   * Get current provider info
   */
  getCurrentProvider(): RPCProvider {
    return this.providers[this.currentIndex];
  }

  /**
   * Test all providers
   */
  async testAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const provider of this.providers) {
      try {
        await axios.post(provider.url, {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_blockNumber',
          params: [],
        }, {
          timeout: 5000,
        });
        results[provider.name] = true;
        console.log(`✅ ${provider.name} is reachable`);
      } catch (error: any) {
        results[provider.name] = false;
        console.log(`❌ ${provider.name} failed: ${error.message}`);
      }
    }

    return results;
  }
}

export default RPCManager;
