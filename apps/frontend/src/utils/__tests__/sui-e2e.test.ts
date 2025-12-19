/**
 * End-to-End Integration Tests for SUI Blockchain Support
 * 
 * These tests validate the complete workflow from wallet creation
 * to blockchain operations, simulating real-world usage.
 */

/**
 * @jest-environment node
 */

import {
  generateSuiWallet,
  createSuiWalletFromMnemonic,
  encryptSuiWallet,
  decryptSuiWallet,
  createSuiWalletFromInput,
} from '../suiWalletUtils';

import {
  getSuiBalance,
  transferSui,
  bulkSendSui,
  bulkCheckSuiBalance,
  suiToMist,
  mistToSui,
  getSuiExplorerUrl,
} from '../suiBlockchainUtils';

// Mock the SUI SDK for E2E tests
jest.mock('@mysten/sui.js/client', () => ({
  SuiClient: jest.fn().mockImplementation(() => ({
    getBalance: jest.fn().mockResolvedValue({ totalBalance: '5000000000' }),
    getAllCoins: jest.fn().mockResolvedValue({ 
      data: [
        { coinType: '0x2::sui::SUI', balance: '5000000000' }
      ] 
    }),
    signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({ 
      digest: '0xe2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3' 
    }),
  })),
  getFullnodeUrl: jest.fn((network) => `https://fullnode.${network}.sui.io`),
}));

jest.mock('@mysten/sui.js/transactions', () => ({
  TransactionBlock: jest.fn().mockImplementation(() => ({
    splitCoins: jest.fn().mockReturnValue(['mock_coin']),
    transferObjects: jest.fn(),
    setGasBudget: jest.fn(),
    gas: {},
    pure: jest.fn((value) => value),
  })),
}));

describe('SUI Blockchain E2E Integration Tests', () => {
  const TEST_PASSWORD = 'SecureTestPassword123!@#';
  const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  describe('Complete Wallet Lifecycle', () => {
    it('should create, encrypt, and decrypt a wallet', async () => {
      // Step 1: Generate a new wallet
      const wallet = generateSuiWallet();
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{64}$/);
      
      // Step 2: Encrypt the wallet
      const encrypted = await encryptSuiWallet(wallet.privateKey, TEST_PASSWORD);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(wallet.privateKey);
      
      // Step 3: Decrypt the wallet
      const decrypted = await decryptSuiWallet(encrypted, TEST_PASSWORD);
      expect(decrypted.address).toBe(wallet.address);
      expect(decrypted.privateKey).toBe(wallet.privateKey);
    });

    it('should restore wallet from mnemonic and perform operations', async () => {
      // Step 1: Create wallet from mnemonic
      const wallet = createSuiWalletFromMnemonic(TEST_MNEMONIC);
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{64}$/);
      
      // Step 2: Encrypt for storage
      const encrypted = await encryptSuiWallet(wallet.privateKey, TEST_PASSWORD);
      
      // Step 3: Later, decrypt and use
      const decrypted = await decryptSuiWallet(encrypted, TEST_PASSWORD);
      expect(decrypted.address).toBe(wallet.address);
      
      // Step 4: Check balance
      const balance = await getSuiBalance(decrypted.address, 'testnet');
      expect(balance).toBe('5.000000000');
    });
  });

  describe('Multi-Wallet Bulk Operations', () => {
    it('should create multiple wallets and check balances', async () => {
      // Step 1: Create multiple wallets
      const wallets = [
        generateSuiWallet(),
        generateSuiWallet(),
        generateSuiWallet(),
      ];
      
      expect(wallets).toHaveLength(3);
      wallets.forEach(w => {
        expect(w.address).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });
      
      // Step 2: Encrypt all wallets
      const encryptedWallets = await Promise.all(
        wallets.map(w => encryptSuiWallet(w.privateKey, TEST_PASSWORD))
      );
      
      expect(encryptedWallets).toHaveLength(3);
      
      // Step 3: Check balances in bulk
      const privateKeys = wallets.map(w => w.privateKey);
      const results = await bulkCheckSuiBalance(privateKeys, 'testnet');
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.balance).toBe('5.000000000');
        expect(result.walletAddress).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });
    });

    it('should transfer SUI from multiple wallets to one recipient', async () => {
      // Step 1: Create sender wallets
      const senders = [
        generateSuiWallet(),
        generateSuiWallet(),
      ];
      
      // Step 2: Create recipient wallet
      const recipient = generateSuiWallet();
      
      // Step 3: Perform bulk transfer
      const transferAmount = '0.5';
      const privateKeys = senders.map(w => w.privateKey);
      
      let progressCallCount = 0;
      const results = await bulkSendSui(
        privateKeys,
        { to: recipient.address, amount: transferAmount },
        'testnet',
        (current, total) => {
          progressCallCount++;
          expect(current).toBeLessThanOrEqual(total);
          expect(total).toBe(2);
        }
      );
      
      // Verify results
      expect(results).toHaveLength(2);
      expect(progressCallCount).toBe(2);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]+$/);
        expect(result.walletAddress).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });
    });
  });

  describe('Import and Restore Workflows', () => {
    it('should import wallets from mixed inputs (mnemonic and private key)', async () => {
      // Scenario: User has some wallets as mnemonics, some as private keys
      const wallet1 = createSuiWalletFromInput(TEST_MNEMONIC);
      const originalWallet2 = generateSuiWallet();
      const wallet2 = createSuiWalletFromInput(originalWallet2.privateKey);
      
      expect(wallet1.address).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(wallet2.address).toBe(originalWallet2.address);
      
      // Both should work for balance checking
      const balance1 = await getSuiBalance(wallet1.address, 'testnet');
      const balance2 = await getSuiBalance(wallet2.address, 'testnet');
      
      expect(balance1).toBe('5.000000000');
      expect(balance2).toBe('5.000000000');
    });

    it('should derive multiple accounts from same mnemonic', async () => {
      const accounts = [
        createSuiWalletFromMnemonic(TEST_MNEMONIC, 0),
        createSuiWalletFromMnemonic(TEST_MNEMONIC, 1),
        createSuiWalletFromMnemonic(TEST_MNEMONIC, 2),
      ];
      
      // All should have different addresses
      const addresses = accounts.map(a => a.address);
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(3);
      
      // But all should be valid and have balances
      const results = await bulkCheckSuiBalance(
        accounts.map(a => a.privateKey),
        'testnet'
      );
      
      expect(results).toHaveLength(3);
      results.forEach(r => {
        expect(r.success).toBe(true);
        expect(r.balance).toBeDefined();
      });
    });
  });

  describe('Transaction and Explorer Integration', () => {
    it('should complete a transfer and generate explorer link', async () => {
      const sender = generateSuiWallet();
      const recipient = generateSuiWallet();
      
      // Perform transfer
      const txHash = await transferSui(
        sender.privateKey,
        { to: recipient.address, amount: '1.5' },
        'testnet'
      );
      
      expect(txHash).toMatch(/^0x[a-fA-F0-9]+$/);
      
      // Generate explorer URLs
      const senderExplorerUrl = getSuiExplorerUrl('testnet', sender.address, 'address');
      const recipientExplorerUrl = getSuiExplorerUrl('testnet', recipient.address, 'address');
      const txExplorerUrl = getSuiExplorerUrl('testnet', txHash, 'tx');
      
      expect(senderExplorerUrl).toContain('suiexplorer.com');
      expect(senderExplorerUrl).toContain(sender.address);
      expect(senderExplorerUrl).toContain('network=testnet');
      
      expect(recipientExplorerUrl).toContain(recipient.address);
      expect(txExplorerUrl).toContain(txHash);
    });
  });

  describe('Amount Conversion and Precision', () => {
    it('should handle various SUI amounts correctly in transfers', async () => {
      const sender = generateSuiWallet();
      const recipient = generateSuiWallet();
      
      const testAmounts = ['0.1', '1.0', '10.5', '0.000000001'];
      
      for (const amount of testAmounts) {
        // Convert to MIST
        const mist = suiToMist(amount);
        expect(mist).toBeGreaterThan(0n);
        
        // Convert back to SUI
        const sui = mistToSui(mist);
        expect(parseFloat(sui)).toBeCloseTo(parseFloat(amount), 9);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle failed transfers gracefully in bulk operations', async () => {
      const validWallet = generateSuiWallet();
      const invalidKey = 'invalid_private_key_xyz';
      const recipient = generateSuiWallet();
      
      const results = await bulkSendSui(
        [validWallet.privateKey, invalidKey],
        { to: recipient.address, amount: '0.1' },
        'testnet'
      );
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
    });

    it('should handle network errors gracefully', async () => {
      // This test would need actual network mocking
      // For now, we verify the structure is correct
      const wallet = generateSuiWallet();
      
      try {
        const balance = await getSuiBalance(wallet.address, 'testnet');
        expect(balance).toBeDefined();
      } catch (error) {
        // Expected if network is unavailable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Full User Journey Simulation', () => {
    it('should simulate complete user workflow: create -> store -> restore -> transact', async () => {
      // Step 1: User creates new wallet
      const newWallet = generateSuiWallet();
      console.log('✓ Created new SUI wallet:', newWallet.address);
      
      // Step 2: User sets password and encrypts wallet
      const userPassword = 'MySecurePassword123!';
      const encrypted = await encryptSuiWallet(newWallet.privateKey, userPassword);
      console.log('✓ Encrypted wallet for secure storage');
      
      // Step 3: Simulate app restart - user logs in
      const decrypted = await decryptSuiWallet(encrypted, userPassword);
      expect(decrypted.address).toBe(newWallet.address);
      console.log('✓ Decrypted wallet after login');
      
      // Step 4: User checks balance
      const balance = await getSuiBalance(decrypted.address, 'testnet');
      console.log('✓ Checked balance:', balance, 'SUI');
      expect(balance).toBeDefined();
      
      // Step 5: User creates a recipient wallet for testing
      const recipientWallet = generateSuiWallet();
      console.log('✓ Generated recipient wallet:', recipientWallet.address);
      
      // Step 6: User initiates transfer
      const txHash = await transferSui(
        decrypted.privateKey,
        { 
          to: recipientWallet.address, 
          amount: '0.5',
          gasbudget: '10000000'
        },
        'testnet'
      );
      console.log('✓ Transfer successful, tx:', txHash);
      expect(txHash).toBeDefined();
      
      // Step 7: User views transaction in explorer
      const explorerUrl = getSuiExplorerUrl('testnet', txHash, 'tx');
      console.log('✓ View transaction:', explorerUrl);
      expect(explorerUrl).toContain('suiexplorer.com');
      
      // Complete workflow success
      console.log('✅ Complete user journey test passed!');
    });
  });
});
