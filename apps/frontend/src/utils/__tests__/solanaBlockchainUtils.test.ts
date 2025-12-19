/**
 * @jest-environment node
 */

import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import {
  SOLANA_NETWORKS,
  createSolanaConnection,
  getSolanaExplorerUrl,
  getSolanaBalance,
  transferSolana,
  bulkSendSolana,
  bulkCheckSolanaBalance,
  solToLamports,
  lamportsToSol,
  getSolanaTransaction,
  getSolanaTransactionHistory,
  requestSolanaAirdrop,
  SolanaTransactionParams,
} from '../solanaBlockchainUtils';

// Mock the Solana web3.js library
jest.mock('@solana/web3.js', () => {
  const originalModule = jest.requireActual('@solana/web3.js');
  return {
    ...originalModule,
    Connection: jest.fn().mockImplementation(() => ({
      getBalance: jest.fn().mockResolvedValue(1000000000), // 1 SOL
      getTransaction: jest.fn().mockResolvedValue({
        slot: 123456,
        transaction: {},
        meta: { fee: 5000 },
      }),
      getSignaturesForAddress: jest.fn().mockResolvedValue([
        { signature: 'sig1', slot: 123456, blockTime: 1234567890 },
        { signature: 'sig2', slot: 123457, blockTime: 1234567891 },
      ]),
      requestAirdrop: jest.fn().mockResolvedValue('airdrop-signature'),
      confirmTransaction: jest.fn().mockResolvedValue({ value: { err: null } }),
    })),
    sendAndConfirmTransaction: jest.fn().mockResolvedValue('mock-tx-hash-' + Date.now()),
  };
});

describe('Solana Blockchain Utils - Network Configuration', () => {
  describe('SOLANA_NETWORKS', () => {
    it('should define all network types', () => {
      expect(SOLANA_NETWORKS.MAINNET).toBe('mainnet-beta');
      expect(SOLANA_NETWORKS.TESTNET).toBe('testnet');
      expect(SOLANA_NETWORKS.DEVNET).toBe('devnet');
      expect(SOLANA_NETWORKS.LOCALNET).toBe('localnet');
    });
  });

  describe('createSolanaConnection', () => {
    it('should create connection with default mainnet', () => {
      const connection = createSolanaConnection();
      expect(Connection).toHaveBeenCalled();
      expect(connection).toBeDefined();
    });

    it('should create connection with specific network', () => {
      const connection = createSolanaConnection('devnet');
      expect(Connection).toHaveBeenCalled();
      expect(connection).toBeDefined();
    });

    it('should create connection with custom RPC URL', () => {
      const customUrl = 'https://custom-rpc.solana.com';
      const connection = createSolanaConnection('mainnet-beta', customUrl);
      expect(Connection).toHaveBeenCalledWith(customUrl, 'confirmed');
    });
  });

  describe('getSolanaExplorerUrl', () => {
    it('should generate mainnet explorer URL for address', () => {
      const address = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      const url = getSolanaExplorerUrl('mainnet-beta', address, 'address');
      expect(url).toBe(`https://explorer.solana.com/address/${address}`);
    });

    it('should generate devnet explorer URL for address', () => {
      const address = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      const url = getSolanaExplorerUrl('devnet', address, 'address');
      expect(url).toBe(`https://explorer.solana.com/address/${address}?cluster=devnet`);
    });

    it('should generate testnet explorer URL for transaction', () => {
      const signature = '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7';
      const url = getSolanaExplorerUrl('testnet', signature, 'tx');
      expect(url).toBe(`https://explorer.solana.com/tx/${signature}?cluster=testnet`);
    });
  });
});

describe('Solana Blockchain Utils - Conversions', () => {
  describe('solToLamports', () => {
    it('should convert 1 SOL to lamports', () => {
      expect(solToLamports('1')).toBe(LAMPORTS_PER_SOL);
    });

    it('should convert 0.5 SOL to lamports', () => {
      expect(solToLamports('0.5')).toBe(LAMPORTS_PER_SOL / 2);
    });

    it('should convert decimal SOL to lamports', () => {
      expect(solToLamports('0.123456789')).toBe(123456789);
    });

    it('should handle very small amounts', () => {
      expect(solToLamports('0.000000001')).toBe(1);
    });

    it('should floor fractional lamports', () => {
      expect(solToLamports('0.0000000015')).toBe(1);
    });
  });

  describe('lamportsToSol', () => {
    it('should convert lamports to SOL', () => {
      expect(lamportsToSol(LAMPORTS_PER_SOL)).toBe('1.000000000');
    });

    it('should convert half SOL', () => {
      expect(lamportsToSol(LAMPORTS_PER_SOL / 2)).toBe('0.500000000');
    });

    it('should handle bigint input', () => {
      expect(lamportsToSol(BigInt(LAMPORTS_PER_SOL))).toBe('1.000000000');
    });

    it('should format with 9 decimal places', () => {
      expect(lamportsToSol(123456789)).toBe('0.123456789');
    });

    it('should handle zero', () => {
      expect(lamportsToSol(0)).toBe('0.000000000');
    });
  });
});

describe('Solana Blockchain Utils - Balance Operations', () => {
  describe('getSolanaBalance', () => {
    it('should get balance for valid address', async () => {
      const address = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      const balance = await getSolanaBalance(address);
      expect(balance).toBe('1.000000000'); // Mocked 1 SOL
    });

    it('should get balance on devnet', async () => {
      const address = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      const balance = await getSolanaBalance(address, 'devnet');
      expect(balance).toBe('1.000000000');
    });

    it('should handle custom RPC URL', async () => {
      const address = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      const balance = await getSolanaBalance(address, 'mainnet-beta', 'https://custom.rpc.com');
      expect(balance).toBe('1.000000000');
    });
  });

  describe('bulkCheckSolanaBalance', () => {
    it('should check balances for multiple wallets', async () => {
      const keypair1 = Keypair.generate();
      const keypair2 = Keypair.generate();
      const privateKeys = [
        bs58.encode(keypair1.secretKey),
        bs58.encode(keypair2.secretKey),
      ];

      const results = await bulkCheckSolanaBalance(privateKeys);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].balance).toBe('1.000000000');
      expect(results[0].walletAddress).toBe(keypair1.publicKey.toBase58());
      expect(results[1].success).toBe(true);
      expect(results[1].balance).toBe('1.000000000');
      expect(results[1].walletAddress).toBe(keypair2.publicKey.toBase58());
    });

    it('should call progress callback', async () => {
      const keypair = Keypair.generate();
      const privateKeys = [bs58.encode(keypair.secretKey)];
      const progressCallback = jest.fn();

      await bulkCheckSolanaBalance(privateKeys, 'devnet', progressCallback);
      
      expect(progressCallback).toHaveBeenCalledWith(1, 1);
    });

    it('should handle invalid private keys', async () => {
      const validKeypair = Keypair.generate();
      const privateKeys = [
        bs58.encode(validKeypair.secretKey),
        'invalid-private-key',
      ];

      const results = await bulkCheckSolanaBalance(privateKeys);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
    });
  });
});

describe('Solana Blockchain Utils - Transfer Operations', () => {
  describe('transferSolana', () => {
    it('should transfer SOL between wallets', async () => {
      const fromKeypair = Keypair.generate();
      const toKeypair = Keypair.generate();
      
      const privateKey = bs58.encode(fromKeypair.secretKey);
      const params: SolanaTransactionParams = {
        to: toKeypair.publicKey.toBase58(),
        amount: '0.5',
      };

      const txHash = await transferSolana(privateKey, params);
      
      expect(txHash).toContain('mock-tx-hash');
      expect(txHash).toBeTruthy();
    });

    it('should transfer on testnet', async () => {
      const fromKeypair = Keypair.generate();
      const toKeypair = Keypair.generate();
      
      const privateKey = bs58.encode(fromKeypair.secretKey);
      const params: SolanaTransactionParams = {
        to: toKeypair.publicKey.toBase58(),
        amount: '0.1',
      };

      const txHash = await transferSolana(privateKey, params, 'testnet');
      
      expect(txHash).toBeTruthy();
    });

    it('should handle custom RPC URL', async () => {
      const fromKeypair = Keypair.generate();
      const toKeypair = Keypair.generate();
      
      const privateKey = bs58.encode(fromKeypair.secretKey);
      const params: SolanaTransactionParams = {
        to: toKeypair.publicKey.toBase58(),
        amount: '0.1',
      };

      const txHash = await transferSolana(
        privateKey,
        params,
        'mainnet-beta',
        'https://custom.rpc.com'
      );
      
      expect(txHash).toBeTruthy();
    });
  });

  describe('bulkSendSolana', () => {
    it('should send SOL from multiple wallets', async () => {
      const keypair1 = Keypair.generate();
      const keypair2 = Keypair.generate();
      const recipientKeypair = Keypair.generate();
      
      const privateKeys = [
        bs58.encode(keypair1.secretKey),
        bs58.encode(keypair2.secretKey),
      ];
      
      const params: SolanaTransactionParams = {
        to: recipientKeypair.publicKey.toBase58(),
        amount: '0.1',
      };

      const results = await bulkSendSolana(privateKeys, params);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].txHash).toBeTruthy();
      expect(results[0].walletAddress).toBe(keypair1.publicKey.toBase58());
      expect(results[1].success).toBe(true);
      expect(results[1].txHash).toBeTruthy();
      expect(results[1].walletAddress).toBe(keypair2.publicKey.toBase58());
    });

    it('should call progress callback during bulk send', async () => {
      const keypair = Keypair.generate();
      const recipientKeypair = Keypair.generate();
      
      const privateKeys = [bs58.encode(keypair.secretKey)];
      const params: SolanaTransactionParams = {
        to: recipientKeypair.publicKey.toBase58(),
        amount: '0.1',
      };
      
      const progressCallback = jest.fn();

      await bulkSendSolana(privateKeys, params, 'devnet', progressCallback);
      
      expect(progressCallback).toHaveBeenCalledWith(1, 1);
    });

    it('should handle failures gracefully', async () => {
      const validKeypair = Keypair.generate();
      const recipientKeypair = Keypair.generate();
      
      const privateKeys = [
        bs58.encode(validKeypair.secretKey),
        'invalid-key',
      ];
      
      const params: SolanaTransactionParams = {
        to: recipientKeypair.publicKey.toBase58(),
        amount: '0.1',
      };

      const results = await bulkSendSolana(privateKeys, params);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
    });
  });
});

describe('Solana Blockchain Utils - Transaction History', () => {
  describe('getSolanaTransaction', () => {
    it('should get transaction details', async () => {
      const signature = '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7';
      const tx = await getSolanaTransaction(signature);
      
      expect(tx).toBeDefined();
      expect(tx?.slot).toBe(123456);
      expect(tx?.meta?.fee).toBe(5000);
    });

    it('should get transaction on devnet', async () => {
      const signature = 'test-signature';
      const tx = await getSolanaTransaction(signature, 'devnet');
      
      expect(tx).toBeDefined();
    });
  });

  describe('getSolanaTransactionHistory', () => {
    it('should get transaction history for address', async () => {
      const address = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      const history = await getSolanaTransactionHistory(address);
      
      expect(history).toHaveLength(2);
      expect(history[0].signature).toBe('sig1');
      expect(history[1].signature).toBe('sig2');
    });

    it('should limit number of transactions', async () => {
      const address = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      const history = await getSolanaTransactionHistory(address, 5);
      
      expect(history).toBeDefined();
    });

    it('should get history on testnet', async () => {
      const address = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      const history = await getSolanaTransactionHistory(address, 10, 'testnet');
      
      expect(history).toBeDefined();
    });
  });
});

describe('Solana Blockchain Utils - Airdrop', () => {
  describe('requestSolanaAirdrop', () => {
    it('should request airdrop on devnet', async () => {
      const address = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      const signature = await requestSolanaAirdrop(address, 1, 'devnet');
      
      expect(signature).toBe('airdrop-signature');
    });

    it('should request airdrop on testnet', async () => {
      const address = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      const signature = await requestSolanaAirdrop(address, 2, 'testnet');
      
      expect(signature).toBeDefined();
    });

    it('should throw error on mainnet', async () => {
      const address = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      
      await expect(requestSolanaAirdrop(address, 1, 'mainnet-beta')).rejects.toThrow(
        'Airdrop not available on mainnet'
      );
    });

    it('should use default 1 SOL amount', async () => {
      const address = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      const signature = await requestSolanaAirdrop(address);
      
      expect(signature).toBeDefined();
    });
  });
});
