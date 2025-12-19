/**
 * @jest-environment node
 */

import {
  generateSolanaWallet,
  createSolanaWalletFromPrivateKey,
  createSolanaWalletFromMnemonic,
  encryptSolanaWallet,
  decryptSolanaWallet,
  isValidSolanaPrivateKey,
  isValidSolanaMnemonic,
  detectSolanaWalletInputType,
  createSolanaWalletFromInput,
  isValidSolanaAddress,
  DEFAULT_SOLANA_DERIVATION_PATH,
} from '../solanaWalletUtils';

describe('Solana Wallet Utils', () => {
  describe('generateSolanaWallet', () => {
    it('should generate a valid Solana wallet', () => {
      const wallet = generateSolanaWallet();
      
      expect(wallet).toHaveProperty('address');
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet.address).toBeTruthy();
      // Solana addresses are base58 encoded, typically 32-44 characters
      expect(wallet.address.length).toBeGreaterThan(20);
      expect(wallet.privateKey).toBeTruthy();
    });

    it('should generate unique wallets', () => {
      const wallet1 = generateSolanaWallet();
      const wallet2 = generateSolanaWallet();
      
      expect(wallet1.address).not.toBe(wallet2.address);
      expect(wallet1.privateKey).not.toBe(wallet2.privateKey);
    });

    it('should generate valid Solana public keys', () => {
      const wallet = generateSolanaWallet();
      // Solana public keys are base58 and don't start with 0x
      expect(wallet.address).not.toMatch(/^0x/);
    });
  });

  describe('createSolanaWalletFromPrivateKey', () => {
    it('should create wallet from valid private key', () => {
      const originalWallet = generateSolanaWallet();
      const recreatedWallet = createSolanaWalletFromPrivateKey(originalWallet.privateKey);
      
      expect(recreatedWallet.address).toBe(originalWallet.address);
      expect(recreatedWallet.privateKey).toBe(originalWallet.privateKey);
    });

    it('should throw error for invalid private key', () => {
      expect(() => {
        createSolanaWalletFromPrivateKey('invalid_key');
      }).toThrow();
    });

    it('should handle base58 encoded private keys', () => {
      const wallet = generateSolanaWallet();
      const recreated = createSolanaWalletFromPrivateKey(wallet.privateKey);
      
      expect(recreated.address).toBe(wallet.address);
    });
  });

  describe('createSolanaWalletFromMnemonic', () => {
    const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

    it('should create wallet from valid mnemonic', () => {
      const wallet = createSolanaWalletFromMnemonic(testMnemonic);
      
      expect(wallet).toHaveProperty('address');
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet.address).toBeTruthy();
    });

    it('should create same wallet from same mnemonic', () => {
      const wallet1 = createSolanaWalletFromMnemonic(testMnemonic);
      const wallet2 = createSolanaWalletFromMnemonic(testMnemonic);
      
      expect(wallet1.address).toBe(wallet2.address);
      expect(wallet1.privateKey).toBe(wallet2.privateKey);
    });

    it('should create different wallets for different account indices', () => {
      const wallet0 = createSolanaWalletFromMnemonic(testMnemonic, 0);
      const wallet1 = createSolanaWalletFromMnemonic(testMnemonic, 1);
      
      expect(wallet0.address).not.toBe(wallet1.address);
      expect(wallet0.privateKey).not.toBe(wallet1.privateKey);
    });

    it('should throw error for invalid mnemonic', () => {
      expect(() => {
        createSolanaWalletFromMnemonic('invalid mnemonic phrase');
      }).toThrow();
    });

    it('should support 24-word mnemonic', () => {
      const mnemonic24 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
      const wallet = createSolanaWalletFromMnemonic(mnemonic24);
      
      expect(wallet.address).toBeTruthy();
    });
  });

  describe('encryptSolanaWallet and decryptSolanaWallet', () => {
    const testPassword = 'SecurePassword123!';

    it('should encrypt and decrypt wallet correctly', async () => {
      const originalWallet = generateSolanaWallet();
      
      const encrypted = await encryptSolanaWallet(originalWallet.privateKey, testPassword);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(originalWallet.privateKey);
      
      const decrypted = await decryptSolanaWallet(encrypted, testPassword);
      expect(decrypted.address).toBe(originalWallet.address);
      expect(decrypted.privateKey).toBe(originalWallet.privateKey);
    });

    it('should fail to decrypt with wrong password', async () => {
      const wallet = generateSolanaWallet();
      const encrypted = await encryptSolanaWallet(wallet.privateKey, testPassword);
      
      await expect(
        decryptSolanaWallet(encrypted, 'WrongPassword')
      ).rejects.toThrow();
    });

    it('should produce different encrypted values for same key', async () => {
      const wallet = generateSolanaWallet();
      
      const encrypted1 = await encryptSolanaWallet(wallet.privateKey, testPassword);
      const encrypted2 = await encryptSolanaWallet(wallet.privateKey, testPassword);
      
      // Due to random salt, encrypted values should differ
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to same wallet
      const decrypted1 = await decryptSolanaWallet(encrypted1, testPassword);
      const decrypted2 = await decryptSolanaWallet(encrypted2, testPassword);
      
      expect(decrypted1.address).toBe(wallet.address);
      expect(decrypted2.address).toBe(wallet.address);
    });
  });

  describe('isValidSolanaPrivateKey', () => {
    it('should validate correct private key', () => {
      const wallet = generateSolanaWallet();
      expect(isValidSolanaPrivateKey(wallet.privateKey)).toBe(true);
    });

    it('should reject invalid private keys', () => {
      expect(isValidSolanaPrivateKey('invalid_key')).toBe(false);
      expect(isValidSolanaPrivateKey('')).toBe(false);
      expect(isValidSolanaPrivateKey('0x123')).toBe(false);
    });

    it('should reject Ethereum private keys', () => {
      const ethKey = '0x1234567890123456789012345678901234567890123456789012345678901234';
      expect(isValidSolanaPrivateKey(ethKey)).toBe(false);
    });
  });

  describe('isValidSolanaMnemonic', () => {
    it('should validate correct 12-word mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      expect(isValidSolanaMnemonic(mnemonic)).toBe(true);
    });

    it('should validate correct 24-word mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
      expect(isValidSolanaMnemonic(mnemonic)).toBe(true);
    });

    it('should reject invalid mnemonics', () => {
      expect(isValidSolanaMnemonic('invalid mnemonic')).toBe(false);
      expect(isValidSolanaMnemonic('')).toBe(false);
      expect(isValidSolanaMnemonic('word')).toBe(false);
    });
  });

  describe('isValidSolanaAddress', () => {
    it('should validate correct Solana address', () => {
      const wallet = generateSolanaWallet();
      expect(isValidSolanaAddress(wallet.address)).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidSolanaAddress('invalid_address')).toBe(false);
      expect(isValidSolanaAddress('')).toBe(false);
      expect(isValidSolanaAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb')).toBe(false);
    });

    it('should reject Ethereum addresses', () => {
      const ethAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      expect(isValidSolanaAddress(ethAddress)).toBe(false);
    });
  });

  describe('detectSolanaWalletInputType', () => {
    it('should detect private key', () => {
      const wallet = generateSolanaWallet();
      expect(detectSolanaWalletInputType(wallet.privateKey)).toBe('privateKey');
    });

    it('should detect mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      expect(detectSolanaWalletInputType(mnemonic)).toBe('mnemonic');
    });

    it('should return null for invalid input', () => {
      expect(detectSolanaWalletInputType('invalid input')).toBeNull();
      expect(detectSolanaWalletInputType('')).toBeNull();
    });

    it('should not confuse with Ethereum inputs', () => {
      const ethKey = '0x1234567890123456789012345678901234567890123456789012345678901234';
      expect(detectSolanaWalletInputType(ethKey)).toBeNull();
    });
  });

  describe('createSolanaWalletFromInput', () => {
    it('should create wallet from private key input', () => {
      const originalWallet = generateSolanaWallet();
      const recreatedWallet = createSolanaWalletFromInput(originalWallet.privateKey);
      
      expect(recreatedWallet.address).toBe(originalWallet.address);
    });

    it('should create wallet from mnemonic input', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const wallet = createSolanaWalletFromInput(mnemonic);
      
      expect(wallet).toHaveProperty('address');
      expect(wallet.address).toBeTruthy();
    });

    it('should throw error for invalid input', () => {
      expect(() => {
        createSolanaWalletFromInput('invalid input');
      }).toThrow('Invalid input: not a valid Solana private key or mnemonic phrase');
    });

    it('should use custom account index for mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const wallet0 = createSolanaWalletFromInput(mnemonic, 0);
      const wallet1 = createSolanaWalletFromInput(mnemonic, 1);
      
      expect(wallet0.address).not.toBe(wallet1.address);
    });
  });

  describe('DEFAULT_SOLANA_DERIVATION_PATH', () => {
    it('should use standard Solana derivation path', () => {
      expect(DEFAULT_SOLANA_DERIVATION_PATH).toBe("m/44'/501'/0'/0'");
    });
  });

  describe('Cross-wallet compatibility', () => {
    it('should generate wallet compatible with Phantom', () => {
      const wallet = generateSolanaWallet();
      
      // Solana addresses are base58 encoded
      expect(wallet.address).toBeTruthy();
      expect(wallet.address).not.toMatch(/^0x/);
    });

    it('should handle BIP39 mnemonic correctly', () => {
      const testMnemonic = 'test test test test test test test test test test test junk';
      const wallet = createSolanaWalletFromMnemonic(testMnemonic);
      
      expect(wallet.address).toBeTruthy();
      expect(wallet.privateKey).toBeTruthy();
    });

    it('should create deterministic wallet from seed', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      
      // Create wallet multiple times
      const wallet1 = createSolanaWalletFromMnemonic(mnemonic, 0);
      const wallet2 = createSolanaWalletFromMnemonic(mnemonic, 0);
      const wallet3 = createSolanaWalletFromMnemonic(mnemonic, 0);
      
      // All should produce the same address
      expect(wallet1.address).toBe(wallet2.address);
      expect(wallet2.address).toBe(wallet3.address);
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple account derivations', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const accounts: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        const wallet = createSolanaWalletFromMnemonic(mnemonic, i);
        accounts.push(wallet.address);
      }
      
      // All accounts should be unique
      const uniqueAccounts = new Set(accounts);
      expect(uniqueAccounts.size).toBe(10);
    });

    it('should handle whitespace in mnemonic', () => {
      const mnemonic = '  abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about  ';
      const wallet = createSolanaWalletFromMnemonic(mnemonic);
      
      expect(wallet.address).toBeTruthy();
    });
  });
});
