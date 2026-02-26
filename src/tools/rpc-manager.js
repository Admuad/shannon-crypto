/**
 * RPC Manager - Multi-provider fallback for blockchain access
 */

import axios from 'axios';

export class RPCManager {
  constructor(providers) {
    this.providers = providers.sort((a, b) => a.priority - b.priority);
    this.currentIndex = 0;
  }

  async call(method, params = [], retries = 3) {
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

        return response.data.result;
      } catch (error) {
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

  async sendTransaction(tx) {
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
      } catch (error) {
        if (!this.isRetryableError(error) || attempt >= 2) {
          throw error;
        }

        console.warn(`${provider.name} failed (attempt ${attempt + 1}), trying next provider...`);
        this.rotateProvider();
      }
    }

    throw new Error('All RPC providers failed to send transaction');
  }

  async getCode(address) {
    try {
      const code = await this.call('eth_getCode', [address, 'latest']);
      return code || '0x';
    } catch (error) {
      console.error(`Failed to get code for ${address}:`, error.message);
      return '0x';
    }
  }

  rotateProvider() {
    this.currentIndex = (this.currentIndex + 1) % this.providers.length;
  }

  isRetryableError(error) {
    const retryableCodes = ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];
    const retryableMessages = ['network timeout', 'timeout', 'rate limit exceeded'];

    const errorCode = error.code || '';
    const errorMessage = (error.message || '').toLowerCase();

    return (
      retryableCodes.includes(errorCode) ||
      retryableMessages.some((msg) => errorMessage.includes(msg))
    );
  }
}

export default RPCManager;
