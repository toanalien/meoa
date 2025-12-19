/**
 * @jest-environment node
 */

import {
  USDT_ADDRESSES,
  getExplorerUrl,
  createProvider,
  bulkSend,
  bulkTransferToken,
  bulkCheckBalance,
} from '../blockchainUtils';
import { generateWallet } from '../walletUtils';

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 ETH
      getTransactionCount: jest.fn().mockResolvedValue(5),
    })),
    Wallet: jest.fn().mockImplementation((privateKey, provider) => ({
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      sendTransaction: jest.fn().mockResolvedValue({
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      }),
    })),
    Contract: jest.fn().mockImplementation(() => ({
      balanceOf: jest.fn().mockResolvedValue(BigInt('1000000000')), // 1 USDT
      decimals: jest.fn().mockResolvedValue(6),
      symbol: jest.fn().mockResolvedValue('USDT'),
      transfer: jest.fn().mockResolvedValue({
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      }),
    })),
    parseEther: jest.fn((value) => BigInt(parseFloat(value) * 1e18)),
    parseUnits: jest.fn((value, decimals) => {
      if (decimals === 'wei') return BigInt(value);
      if (decimals === 'gwei') return BigInt(parseFloat(value) * 1e9);
      return BigInt(parseFloat(value) * Math.pow(10, decimals));
    }),
    formatEther: jest.fn((value) => (Number(value) / 1e18).toString()),
    formatUnits: jest.fn((value, decimals) => {
      return (Number(value) / Math.pow(10, decimals)).toString();
    }),
  },
  Wallet: jest.fn(),
  Contract: jest.fn(),
}));

describe('Ethereum/EVM Blockchain Utils', () => {
  describe('USDT_ADDRESSES', () => {
    it('should have correct USDT addresses for all networks', () => {
      expect(USDT_ADDRESSES.ETHEREUM).toBe('0xdac17f958d2ee523a2206206994597c13d831ec7');
      expect(USDT_ADDRESSES.BSC).toBe('0x55d398326f99059ff775485246999027b3197955');
      expect(USDT_ADDRESSES.POLYGON).toBe('0xc2132d05d31c914a87c6611c10748aeb04b58e8f');
      expect(USDT_ADDRESSES.ARBITRUM).toBe('0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9');
      expect(USDT_ADDRESSES.OPTIMISM).toBe('0x94b008aa00579c1307b0ef2c499ad98a8ce58e58');
    });

    it('should have valid Ethereum address format', () => {
      Object.values(USDT_ADDRESSES).forEach(address => {
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });
  });

  describe('getExplorerUrl', () => {
    const testAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

    it('should return correct explorer URL for Ethereum mainnet', () => {
      const url = getExplorerUrl('https://eth.llamarpc.com', testAddress);
      expect(url).toBe(`https://etherscan.io/address/${testAddress}`);
    });

    it('should return correct explorer URL for BSC', () => {
      const url = getExplorerUrl('https://bsc-dataseed.binance.org', testAddress);
      expect(url).toBe(`https://bscscan.com/address/${testAddress}`);
    });

    it('should return correct explorer URL for Polygon', () => {
      const url = getExplorerUrl('https://polygon-rpc.com', testAddress);
      expect(url).toBe(`https://polygonscan.com/address/${testAddress}`);
    });

    it('should return correct explorer URL for Arbitrum', () => {
      const url = getExplorerUrl('https://arb1.arbitrum.io/rpc', testAddress);
      expect(url).toBe(`https://arbiscan.io/address/${testAddress}`);
    });

    it('should return correct explorer URL for Optimism', () => {
      const url = getExplorerUrl('https://mainnet.optimism.io', testAddress);
      expect(url).toBe(`https://optimistic.etherscan.io/address/${testAddress}`);
    });

    it('should return correct explorer URL for Sepolia testnet', () => {
      const url = getExplorerUrl('https://rpc.sepolia.org', testAddress);
      expect(url).toBe(`https://sepolia.etherscan.io/address/${testAddress}`);
    });

    it('should default to Etherscan for unknown networks', () => {
      const url = getExplorerUrl('https://unknown-rpc.com', testAddress);
      expect(url).toBe(`https://etherscan.io/address/${testAddress}`);
    });
  });

  describe('createProvider', () => {
    it('should create provider for given RPC URL', () => {
      const rpcUrl = 'https://eth.llamarpc.com';
      const provider = createProvider(rpcUrl);
      
      expect(provider).toBeDefined();
    });

    it('should create different providers for different URLs', () => {
      const provider1 = createProvider('https://eth.llamarpc.com');
      const provider2 = createProvider('https://bsc-dataseed.binance.org');
      
      expect(provider1).toBeDefined();
      expect(provider2).toBeDefined();
    });
  });

  describe('bulkSend', () => {
    const mockRpcUrl = 'https://eth.llamarpc.com';

    it('should send ETH from multiple wallets', async () => {
      const wallet1 = generateWallet();
      const wallet2 = generateWallet();
      const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

      const results = await bulkSend(
        [wallet1.privateKey, wallet2.privateKey],
        { to: recipient, value: '0.1' },
        mockRpcUrl
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].txHash).toBeDefined();
      expect(results[0].walletAddress).toBeDefined();
    });

    it('should report progress during bulk send', async () => {
      const wallet1 = generateWallet();
      const wallet2 = generateWallet();
      const wallet3 = generateWallet();
      const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

      const progressUpdates: Array<{ current: number; total: number }> = [];

      await bulkSend(
        [wallet1.privateKey, wallet2.privateKey, wallet3.privateKey],
        { to: recipient, value: '0.1' },
        mockRpcUrl,
        (current, total) => {
          progressUpdates.push({ current, total });
        }
      );

      expect(progressUpdates).toHaveLength(3);
      expect(progressUpdates[0]).toEqual({ current: 1, total: 3 });
      expect(progressUpdates[2]).toEqual({ current: 3, total: 3 });
    });

    it('should handle errors gracefully', async () => {
      const invalidKey = 'invalid_private_key';
      const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

      const results = await bulkSend(
        [invalidKey],
        { to: recipient, value: '0.1' },
        mockRpcUrl
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });

    it('should support custom gas limit and gas price', async () => {
      const wallet = generateWallet();
      const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

      const results = await bulkSend(
        [wallet.privateKey],
        { 
          to: recipient, 
          value: '0.1',
          gasLimit: '21000',
          gasPrice: '20'
        },
        mockRpcUrl
      );

      expect(results[0].success).toBe(true);
    });
  });

  describe('bulkTransferToken', () => {
    const mockRpcUrl = 'https://eth.llamarpc.com';

    it('should transfer tokens from multiple wallets', async () => {
      const wallet1 = generateWallet();
      const wallet2 = generateWallet();
      const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

      const results = await bulkTransferToken(
        [wallet1.privateKey, wallet2.privateKey],
        { 
          to: recipient, 
          value: '100',
          tokenAddress: USDT_ADDRESSES.ETHEREUM
        },
        mockRpcUrl
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].txHash).toBeDefined();
    });

    it('should throw error if token address not provided', async () => {
      const wallet = generateWallet();
      const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

      await expect(
        bulkTransferToken(
          [wallet.privateKey],
          { to: recipient, value: '100' },
          mockRpcUrl
        )
      ).rejects.toThrow('Token address is required');
    });

    it('should report progress during token transfer', async () => {
      const wallet1 = generateWallet();
      const wallet2 = generateWallet();
      const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

      const progressUpdates: number[] = [];

      await bulkTransferToken(
        [wallet1.privateKey, wallet2.privateKey],
        { 
          to: recipient, 
          value: '100',
          tokenAddress: USDT_ADDRESSES.ETHEREUM
        },
        mockRpcUrl,
        (current, total) => {
          progressUpdates.push(current);
        }
      );

      expect(progressUpdates).toEqual([1, 2]);
    });
  });

  describe('bulkCheckBalance', () => {
    const mockRpcUrl = 'https://eth.llamarpc.com';

    it('should check balance for multiple wallets', async () => {
      const wallet1 = generateWallet();
      const wallet2 = generateWallet();

      const results = await bulkCheckBalance(
        [wallet1.privateKey, wallet2.privateKey],
        {},
        mockRpcUrl
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].balance).toBeDefined();
      expect(results[0].txCount).toBeDefined();
    });

    it('should check token balance when token address provided', async () => {
      const wallet = generateWallet();

      const results = await bulkCheckBalance(
        [wallet.privateKey],
        { tokenAddress: USDT_ADDRESSES.ETHEREUM },
        mockRpcUrl
      );

      expect(results[0].success).toBe(true);
      expect(results[0].balance).toBeDefined();
      expect(results[0].tokenSymbol).toBe('USDT');
      expect(results[0].tokenDecimals).toBe(6);
    });

    it('should report progress during balance check', async () => {
      const wallet1 = generateWallet();
      const wallet2 = generateWallet();
      const wallet3 = generateWallet();

      let progressCount = 0;

      await bulkCheckBalance(
        [wallet1.privateKey, wallet2.privateKey, wallet3.privateKey],
        {},
        mockRpcUrl,
        () => {
          progressCount++;
        }
      );

      expect(progressCount).toBe(3);
    });

    it('should handle errors gracefully', async () => {
      const invalidKey = 'invalid_key';

      const results = await bulkCheckBalance(
        [invalidKey],
        {},
        mockRpcUrl
      );

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });
  });

  describe('Multi-network support', () => {
    it('should work with Ethereum mainnet', async () => {
      const wallet = generateWallet();
      const provider = createProvider('https://eth.llamarpc.com');
      expect(provider).toBeDefined();
    });

    it('should work with BSC', async () => {
      const wallet = generateWallet();
      const provider = createProvider('https://bsc-dataseed.binance.org');
      expect(provider).toBeDefined();
    });

    it('should work with Polygon', async () => {
      const wallet = generateWallet();
      const provider = createProvider('https://polygon-rpc.com');
      expect(provider).toBeDefined();
    });

    it('should work with Arbitrum', async () => {
      const wallet = generateWallet();
      const provider = createProvider('https://arb1.arbitrum.io/rpc');
      expect(provider).toBeDefined();
    });
  });
});
