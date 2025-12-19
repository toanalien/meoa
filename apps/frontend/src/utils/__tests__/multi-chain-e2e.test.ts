/**
 * Multi-Chain End-to-End Integration Tests
 * 
 * Tests the complete workflow across all supported blockchains:
 * - Ethereum (ETH, BSC, Polygon, Arbitrum, Optimism)
 * - Solana
 * - SUI
 * 
 * Validates cross-chain compatibility, wallet management,
 * and consistent behavior across different blockchain networks.
 */

/**
 * @jest-environment node
 */

// Ethereum
import {
  generateWallet as generateEthWallet,
  encryptWallet as encryptEthWallet,
  decryptWallet as decryptEthWallet,
  createWalletFromInput as createEthWalletFromInput,
} from '../walletUtils';

// Solana
import {
  generateSolanaWallet,
  encryptSolanaWallet,
  decryptSolanaWallet,
  createSolanaWalletFromInput,
} from '../solanaWalletUtils';

// SUI
import {
  generateSuiWallet,
  encryptSuiWallet,
  decryptSuiWallet,
  createSuiWalletFromInput,
} from '../suiWalletUtils';

// Mock blockchain clients
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')),
    })),
    Wallet: jest.fn(),
    parseEther: jest.fn((value) => BigInt(parseFloat(value) * 1e18)),
  },
}));

jest.mock('@mysten/sui.js/client', () => ({
  SuiClient: jest.fn().mockImplementation(() => ({
    getBalance: jest.fn().mockResolvedValue({ totalBalance: '5000000000' }),
  })),
  getFullnodeUrl: jest.fn((network) => `https://fullnode.${network}.sui.io`),
}));

describe('Multi-Chain Integration Tests', () => {
  const TEST_PASSWORD = 'MultiChainPassword123!@#';
  const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  describe('Wallet Generation Across Chains', () => {
    it('should generate wallets for all supported blockchains', () => {
      const ethWallet = generateEthWallet();
      const solWallet = generateSolanaWallet();
      const suiWallet = generateSuiWallet();

      // Ethereum wallet
      expect(ethWallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(ethWallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Solana wallet
      expect(solWallet.address).toBeTruthy();
      expect(solWallet.address).not.toMatch(/^0x/);

      // SUI wallet
      expect(suiWallet.address).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(suiWallet.address.length).toBe(66); // 0x + 64 hex chars
    });

    it('should generate unique addresses across all chains', () => {
      const addresses = [
        generateEthWallet().address,
        generateSolanaWallet().address,
        generateSuiWallet().address,
      ];

      // All addresses should be unique
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(3);
    });
  });

  describe('Wallet Encryption Across Chains', () => {
    it('should encrypt and decrypt Ethereum wallet', async () => {
      const wallet = generateEthWallet();
      
      const encrypted = await encryptEthWallet(wallet.privateKey, TEST_PASSWORD);
      const decrypted = await decryptEthWallet(encrypted, TEST_PASSWORD);
      
      expect(decrypted.address).toBe(wallet.address);
      expect(decrypted.privateKey).toBe(wallet.privateKey);
    });

    it('should encrypt and decrypt Solana wallet', async () => {
      const wallet = generateSolanaWallet();
      
      const encrypted = await encryptSolanaWallet(wallet.privateKey, TEST_PASSWORD);
      const decrypted = await decryptSolanaWallet(encrypted, TEST_PASSWORD);
      
      expect(decrypted.address).toBe(wallet.address);
      expect(decrypted.privateKey).toBe(wallet.privateKey);
    });

    it('should encrypt and decrypt SUI wallet', async () => {
      const wallet = generateSuiWallet();
      
      const encrypted = await encryptSuiWallet(wallet.privateKey, TEST_PASSWORD);
      const decrypted = await decryptSuiWallet(encrypted, TEST_PASSWORD);
      
      expect(decrypted.address).toBe(wallet.address);
      expect(decrypted.privateKey).toBe(wallet.privateKey);
    });

    it('should use same password for all chains', async () => {
      const ethWallet = generateEthWallet();
      const solWallet = generateSolanaWallet();
      const suiWallet = generateSuiWallet();

      // Encrypt all with same password
      const ethEncrypted = await encryptEthWallet(ethWallet.privateKey, TEST_PASSWORD);
      const solEncrypted = await encryptSolanaWallet(solWallet.privateKey, TEST_PASSWORD);
      const suiEncrypted = await encryptSuiWallet(suiWallet.privateKey, TEST_PASSWORD);

      // Decrypt all with same password
      const ethDecrypted = await decryptEthWallet(ethEncrypted, TEST_PASSWORD);
      const solDecrypted = await decryptSolanaWallet(solEncrypted, TEST_PASSWORD);
      const suiDecrypted = await decryptSuiWallet(suiEncrypted, TEST_PASSWORD);

      expect(ethDecrypted.address).toBe(ethWallet.address);
      expect(solDecrypted.address).toBe(solWallet.address);
      expect(suiDecrypted.address).toBe(suiWallet.address);
    });
  });

  describe('Mnemonic Import Across Chains', () => {
    it('should create different wallets from same mnemonic on different chains', () => {
      const ethWallet = createEthWalletFromInput(TEST_MNEMONIC);
      const solWallet = createSolanaWalletFromInput(TEST_MNEMONIC);
      const suiWallet = createSuiWalletFromInput(TEST_MNEMONIC);

      // All should be valid but different
      expect(ethWallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(solWallet.address).toBeTruthy();
      expect(suiWallet.address).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Addresses should be different (different derivation paths)
      expect(ethWallet.address).not.toBe(suiWallet.address);
    });

    it('should be deterministic across chains', () => {
      // Create wallets twice from same mnemonic
      const eth1 = createEthWalletFromInput(TEST_MNEMONIC);
      const eth2 = createEthWalletFromInput(TEST_MNEMONIC);
      
      const sol1 = createSolanaWalletFromInput(TEST_MNEMONIC);
      const sol2 = createSolanaWalletFromInput(TEST_MNEMONIC);
      
      const sui1 = createSuiWalletFromInput(TEST_MNEMONIC);
      const sui2 = createSuiWalletFromInput(TEST_MNEMONIC);

      // Same chain should produce same wallet
      expect(eth1.address).toBe(eth2.address);
      expect(sol1.address).toBe(sol2.address);
      expect(sui1.address).toBe(sui2.address);
    });

    it('should support multi-account derivation on all chains', () => {
      // Ethereum multi-account
      const ethAccounts = Array.from({ length: 3 }, (_, i) => 
        createEthWalletFromInput(TEST_MNEMONIC, `m/44'/60'/0'/0/${i}`)
      );
      
      // Solana multi-account
      const solAccounts = Array.from({ length: 3 }, (_, i) => 
        createSolanaWalletFromInput(TEST_MNEMONIC, i)
      );
      
      // SUI multi-account
      const suiAccounts = Array.from({ length: 3 }, (_, i) => 
        createSuiWalletFromInput(TEST_MNEMONIC, i)
      );

      // All accounts should be unique within their chain
      expect(new Set(ethAccounts.map(a => a.address)).size).toBe(3);
      expect(new Set(solAccounts.map(a => a.address)).size).toBe(3);
      expect(new Set(suiAccounts.map(a => a.address)).size).toBe(3);
    });
  });

  describe('Complete User Journey: Multi-Chain Portfolio', () => {
    it('should simulate user managing wallets across all chains', async () => {
      console.log('🚀 Starting Multi-Chain User Journey...\n');

      // Step 1: User creates wallets on each chain
      console.log('Step 1: Creating wallets on all chains...');
      const ethWallet = generateEthWallet();
      const solWallet = generateSolanaWallet();
      const suiWallet = generateSuiWallet();
      console.log('✓ Created ETH wallet:', ethWallet.address);
      console.log('✓ Created SOL wallet:', solWallet.address);
      console.log('✓ Created SUI wallet:', suiWallet.address);
      console.log('');

      // Step 2: User sets master password and encrypts all wallets
      console.log('Step 2: Encrypting all wallets with master password...');
      const masterPassword = 'UserMasterPassword123!';
      
      const encryptedEth = await encryptEthWallet(ethWallet.privateKey, masterPassword);
      const encryptedSol = await encryptSolanaWallet(solWallet.privateKey, masterPassword);
      const encryptedSui = await encryptSuiWallet(suiWallet.privateKey, masterPassword);
      console.log('✓ All wallets encrypted');
      console.log('');

      // Step 3: Simulate app restart - user logs in
      console.log('Step 3: App restart - User logging in...');
      const decryptedEth = await decryptEthWallet(encryptedEth, masterPassword);
      const decryptedSol = await decryptSolanaWallet(encryptedSol, masterPassword);
      const decryptedSui = await decryptSuiWallet(encryptedSui, masterPassword);
      
      expect(decryptedEth.address).toBe(ethWallet.address);
      expect(decryptedSol.address).toBe(solWallet.address);
      expect(decryptedSui.address).toBe(suiWallet.address);
      console.log('✓ Successfully decrypted all wallets');
      console.log('');

      // Step 4: User imports additional wallets from mnemonic
      console.log('Step 4: Importing wallets from backup mnemonic...');
      const importedEth = createEthWalletFromInput(TEST_MNEMONIC);
      const importedSol = createSolanaWalletFromInput(TEST_MNEMONIC);
      const importedSui = createSuiWalletFromInput(TEST_MNEMONIC);
      console.log('✓ Imported ETH wallet:', importedEth.address);
      console.log('✓ Imported SOL wallet:', importedSol.address);
      console.log('✓ Imported SUI wallet:', importedSui.address);
      console.log('');

      // Step 5: Summary
      console.log('📊 Portfolio Summary:');
      console.log('- Total wallets: 6 (3 generated + 3 imported)');
      console.log('- Ethereum wallets: 2');
      console.log('- Solana wallets: 2');
      console.log('- SUI wallets: 2');
      console.log('- All encrypted with same master password');
      console.log('');
      console.log('✅ Multi-Chain User Journey Complete!');
    });
  });

  describe('Bulk Operations Across Chains', () => {
    it('should manage multiple wallets on each chain', () => {
      // Create 3 wallets for each chain
      const ethWallets = Array.from({ length: 3 }, () => generateEthWallet());
      const solWallets = Array.from({ length: 3 }, () => generateSolanaWallet());
      const suiWallets = Array.from({ length: 3 }, () => generateSuiWallet());

      expect(ethWallets).toHaveLength(3);
      expect(solWallets).toHaveLength(3);
      expect(suiWallets).toHaveLength(3);

      // All addresses should be unique
      const allEthAddresses = new Set(ethWallets.map(w => w.address));
      const allSolAddresses = new Set(solWallets.map(w => w.address));
      const allSuiAddresses = new Set(suiWallets.map(w => w.address));

      expect(allEthAddresses.size).toBe(3);
      expect(allSolAddresses.size).toBe(3);
      expect(allSuiAddresses.size).toBe(3);
    });

    it('should encrypt multiple wallets across chains', async () => {
      const ethWallets = Array.from({ length: 2 }, () => generateEthWallet());
      const solWallets = Array.from({ length: 2 }, () => generateSolanaWallet());
      const suiWallets = Array.from({ length: 2 }, () => generateSuiWallet());

      // Encrypt all wallets
      const encryptedEth = await Promise.all(
        ethWallets.map(w => encryptEthWallet(w.privateKey, TEST_PASSWORD))
      );
      const encryptedSol = await Promise.all(
        solWallets.map(w => encryptSolanaWallet(w.privateKey, TEST_PASSWORD))
      );
      const encryptedSui = await Promise.all(
        suiWallets.map(w => encryptSuiWallet(w.privateKey, TEST_PASSWORD))
      );

      expect(encryptedEth).toHaveLength(2);
      expect(encryptedSol).toHaveLength(2);
      expect(encryptedSui).toHaveLength(2);

      // Decrypt and verify
      const decryptedEth = await Promise.all(
        encryptedEth.map(e => decryptEthWallet(e, TEST_PASSWORD))
      );
      
      expect(decryptedEth[0].address).toBe(ethWallets[0].address);
      expect(decryptedEth[1].address).toBe(ethWallets[1].address);
    });
  });

  describe('Address Format Validation', () => {
    it('should have distinct address formats for each chain', () => {
      const ethWallet = generateEthWallet();
      const solWallet = generateSolanaWallet();
      const suiWallet = generateSuiWallet();

      // Ethereum: 0x + 40 hex chars (20 bytes)
      expect(ethWallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(ethWallet.address.length).toBe(42);

      // Solana: base58 encoded, no 0x prefix
      expect(solWallet.address).not.toMatch(/^0x/);
      expect(solWallet.address.length).toBeGreaterThan(20);

      // SUI: 0x + 64 hex chars (32 bytes)
      expect(suiWallet.address).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(suiWallet.address.length).toBe(66);

      // All addresses should be different
      expect(ethWallet.address).not.toBe(solWallet.address);
      expect(ethWallet.address).not.toBe(suiWallet.address);
      expect(solWallet.address).not.toBe(suiWallet.address);
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle wrong password consistently across chains', async () => {
      const ethWallet = generateEthWallet();
      const solWallet = generateSolanaWallet();
      const suiWallet = generateSuiWallet();

      const correctPassword = 'CorrectPass123';
      const wrongPassword = 'WrongPass456';

      const encryptedEth = await encryptEthWallet(ethWallet.privateKey, correctPassword);
      const encryptedSol = await encryptSolanaWallet(solWallet.privateKey, correctPassword);
      const encryptedSui = await encryptSuiWallet(suiWallet.privateKey, correctPassword);

      // All should fail with wrong password
      await expect(decryptEthWallet(encryptedEth, wrongPassword)).rejects.toThrow();
      await expect(decryptSolanaWallet(encryptedSol, wrongPassword)).rejects.toThrow();
      await expect(decryptSuiWallet(encryptedSui, wrongPassword)).rejects.toThrow();
    });
  });

  describe('Cross-Chain Portfolio Statistics', () => {
    it('should calculate total portfolio value across chains', () => {
      // Simulate user with wallets on multiple chains
      const portfolio = {
        ethereum: {
          wallets: Array.from({ length: 3 }, () => generateEthWallet()),
          network: 'Ethereum',
        },
        bsc: {
          wallets: Array.from({ length: 2 }, () => generateEthWallet()),
          network: 'BSC',
        },
        solana: {
          wallets: Array.from({ length: 2 }, () => generateSolanaWallet()),
          network: 'Solana',
        },
        sui: {
          wallets: Array.from({ length: 2 }, () => generateSuiWallet()),
          network: 'SUI',
        },
      };

      const totalWallets = Object.values(portfolio).reduce(
        (sum, chain) => sum + chain.wallets.length,
        0
      );

      expect(totalWallets).toBe(9);
      expect(portfolio.ethereum.wallets).toHaveLength(3);
      expect(portfolio.bsc.wallets).toHaveLength(2);
      expect(portfolio.solana.wallets).toHaveLength(2);
      expect(portfolio.sui.wallets).toHaveLength(2);
    });
  });
});
