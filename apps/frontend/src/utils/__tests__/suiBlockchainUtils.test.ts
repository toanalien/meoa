/**
 * @jest-environment node
 */

import {
  SUI_NETWORKS,
  getSuiExplorerUrl,
  createSuiClient,
  suiToMist,
  mistToSui,
  getSuiBalance,
  transferSui,
  bulkSendSui,
  bulkCheckSuiBalance,
  getSuiCoins,
  getSuiTransaction,
} from '../suiBlockchainUtils';
import { generateSuiWallet } from '../suiWalletUtils';

// Mock the SUI SDK
jest.mock('@mysten/sui.js/client', () => ({
  SuiClient: jest.fn().mockImplementation(() => ({
    getBalance: jest.fn().mockResolvedValue({ totalBalance: '1000000000' }),
    getAllCoins: jest.fn().mockResolvedValue({ data: [] }),
    getTransactionBlock: jest.fn().mockResolvedValue({}),
    signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({ 
      digest: '0x1234567890abcdef' 
    }),
  })),
  getFullnodeUrl: jest.fn((network) => `https://fullnode.${network}.sui.io`),
}));

jest.mock('@mysten/sui.js/transactions', () => ({
  TransactionBlock: jest.fn().mockImplementation(() => ({
    splitCoins: jest.fn(),
    transferObjects: jest.fn(),
    setGasBudget: jest.fn(),
    gas: {},
    pure: jest.fn((value) => value),
  })),
}));

describe('SUI Blockchain Utils', () => {
  describe('Network Constants', () => {
    it('should have correct network types', () => {
      expect(SUI_NETWORKS.MAINNET).toBe('mainnet');
      expect(SUI_NETWORKS.TESTNET).toBe('testnet');
      expect(SUI_NETWORKS.DEVNET).toBe('devnet');
      expect(SUI_NETWORKS.LOCALNET).toBe('localnet');
    });
  });

  describe('getSuiExplorerUrl', () => {
    const testAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    it('should generate correct explorer URL for mainnet address', () => {
      const url = getSuiExplorerUrl('mainnet', testAddress, 'address');
      expect(url).toBe(`https://suiexplorer.com/address/${testAddress}`);
    });

    it('should generate correct explorer URL for testnet address', () => {
      const url = getSuiExplorerUrl('testnet', testAddress, 'address');
      expect(url).toBe(`https://suiexplorer.com/address/${testAddress}?network=testnet`);
    });

    it('should generate correct explorer URL for transaction', () => {
      const txHash = '0xabcdef';
      const url = getSuiExplorerUrl('mainnet', txHash, 'tx');
      expect(url).toBe(`https://suiexplorer.com/tx/${txHash}`);
    });

    it('should generate correct explorer URL for object', () => {
      const objectId = '0x123456';
      const url = getSuiExplorerUrl('devnet', objectId, 'object');
      expect(url).toBe(`https://suiexplorer.com/object/${objectId}?network=devnet`);
    });
  });

  describe('createSuiClient', () => {
    it('should create client for mainnet by default', () => {
      const client = createSuiClient();
      expect(client).toBeDefined();
    });

    it('should create client for specified network', () => {
      const client = createSuiClient('testnet');
      expect(client).toBeDefined();
    });
  });

  describe('suiToMist and mistToSui conversion', () => {
    it('should convert SUI to MIST correctly', () => {
      expect(suiToMist('1')).toBe(1000000000n);
      expect(suiToMist('0.5')).toBe(500000000n);
      expect(suiToMist('10')).toBe(10000000000n);
      expect(suiToMist('0.000000001')).toBe(1n);
    });

    it('should convert MIST to SUI correctly', () => {
      expect(mistToSui('1000000000')).toBe('1.000000000');
      expect(mistToSui(1000000000n)).toBe('1.000000000');
      expect(mistToSui('500000000')).toBe('0.500000000');
      expect(mistToSui('1')).toBe('0.000000001');
    });

    it('should be reversible', () => {
      const originalSui = '5.123456789';
      const mist = suiToMist(originalSui);
      const convertedBack = mistToSui(mist);
      expect(parseFloat(convertedBack)).toBeCloseTo(parseFloat(originalSui), 9);
    });
  });

  describe('getSuiBalance', () => {
    it('should get balance for an address', async () => {
      const testAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const balance = await getSuiBalance(testAddress, 'testnet');
      
      expect(balance).toBe('1.000000000'); // Mocked to return 1 SUI
    });

    it('should use mainnet by default', async () => {
      const testAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const balance = await getSuiBalance(testAddress);
      
      expect(balance).toBeDefined();
    });
  });

  describe('transferSui', () => {
    it('should transfer SUI successfully', async () => {
      const wallet = generateSuiWallet();
      const recipient = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      const txHash = await transferSui(
        wallet.privateKey,
        { to: recipient, amount: '0.1' },
        'testnet'
      );
      
      expect(txHash).toBe('0x1234567890abcdef');
    });

    it('should include gas budget when provided', async () => {
      const wallet = generateSuiWallet();
      const recipient = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      const txHash = await transferSui(
        wallet.privateKey,
        { to: recipient, amount: '0.1', gasbudget: '10000000' },
        'testnet'
      );
      
      expect(txHash).toBeDefined();
    });
  });

  describe('bulkSendSui', () => {
    it('should send SUI from multiple wallets', async () => {
      const wallet1 = generateSuiWallet();
      const wallet2 = generateSuiWallet();
      const recipient = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      const results = await bulkSendSui(
        [wallet1.privateKey, wallet2.privateKey],
        { to: recipient, amount: '0.1' },
        'testnet'
      );
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].txHash).toBeDefined();
      expect(results[0].walletAddress).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should report progress', async () => {
      const wallet1 = generateSuiWallet();
      const wallet2 = generateSuiWallet();
      const wallet3 = generateSuiWallet();
      const recipient = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      const progressUpdates: Array<{ current: number; total: number }> = [];
      
      await bulkSendSui(
        [wallet1.privateKey, wallet2.privateKey, wallet3.privateKey],
        { to: recipient, amount: '0.1' },
        'testnet',
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
      const recipient = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      const results = await bulkSendSui(
        [invalidKey],
        { to: recipient, amount: '0.1' },
        'testnet'
      );
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });
  });

  describe('bulkCheckSuiBalance', () => {
    it('should check balance for multiple wallets', async () => {
      const wallet1 = generateSuiWallet();
      const wallet2 = generateSuiWallet();
      
      const results = await bulkCheckSuiBalance(
        [wallet1.privateKey, wallet2.privateKey],
        'testnet'
      );
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].balance).toBe('1.000000000');
      expect(results[0].walletAddress).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should report progress', async () => {
      const wallet1 = generateSuiWallet();
      const wallet2 = generateSuiWallet();
      
      const progressUpdates: Array<{ current: number; total: number }> = [];
      
      await bulkCheckSuiBalance(
        [wallet1.privateKey, wallet2.privateKey],
        'testnet',
        (current, total) => {
          progressUpdates.push({ current, total });
        }
      );
      
      expect(progressUpdates).toHaveLength(2);
      expect(progressUpdates[0]).toEqual({ current: 1, total: 2 });
      expect(progressUpdates[1]).toEqual({ current: 2, total: 2 });
    });

    it('should handle invalid keys gracefully', async () => {
      const invalidKey = 'invalid_key';
      
      const results = await bulkCheckSuiBalance([invalidKey], 'testnet');
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });
  });

  describe('getSuiCoins', () => {
    it('should get all coins for an address', async () => {
      const testAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const coins = await getSuiCoins(testAddress, 'testnet');
      
      expect(coins).toBeDefined();
    });
  });

  describe('getSuiTransaction', () => {
    it('should get transaction details', async () => {
      const txDigest = '0xabcdef1234567890';
      const txDetails = await getSuiTransaction(txDigest, 'testnet');
      
      expect(txDetails).toBeDefined();
    });
  });
});
