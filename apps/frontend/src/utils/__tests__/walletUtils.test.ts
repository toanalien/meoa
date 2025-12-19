/**
 * @jest-environment node
 */

import {
  generateWallet,
  encryptWallet,
  decryptWallet,
  isValidPrivateKey,
  isValidMnemonic,
  detectWalletInputType,
  createWalletFromInput,
  DEFAULT_DERIVATION_PATH,
} from '../walletUtils';

describe('Ethereum Wallet Utils', () => {
  describe('generateWallet', () => {
    it('should generate a valid Ethereum wallet', () => {
      const wallet = generateWallet();
      
      expect(wallet).toHaveProperty('address');
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(wallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should generate unique wallets', () => {
      const wallet1 = generateWallet();
      const wallet2 = generateWallet();
      
      expect(wallet1.address).not.toBe(wallet2.address);
      expect(wallet1.privateKey).not.toBe(wallet2.privateKey);
    });
  });

  describe('encryptWallet and decryptWallet', () => {
    const testPassword = 'SecurePassword123!';

    it('should encrypt and decrypt wallet correctly', async () => {
      const originalWallet = generateWallet();
      
      const encrypted = await encryptWallet(originalWallet.privateKey, testPassword);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(originalWallet.privateKey);
      
      const decrypted = await decryptWallet(encrypted, testPassword);
      expect(decrypted.address).toBe(originalWallet.address);
      expect(decrypted.privateKey).toBe(originalWallet.privateKey);
    });

    it('should fail to decrypt with wrong password', async () => {
      const wallet = generateWallet();
      const encrypted = await encryptWallet(wallet.privateKey, testPassword);
      
      await expect(
        decryptWallet(encrypted, 'WrongPassword')
      ).rejects.toThrow();
    });

    it('should produce different encrypted values for same key', async () => {
      const wallet = generateWallet();
      
      const encrypted1 = await encryptWallet(wallet.privateKey, testPassword);
      const encrypted2 = await encryptWallet(wallet.privateKey, testPassword);
      
      // Due to random salt, encrypted values should differ
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to same wallet
      const decrypted1 = await decryptWallet(encrypted1, testPassword);
      const decrypted2 = await decryptWallet(encrypted2, testPassword);
      
      expect(decrypted1.address).toBe(wallet.address);
      expect(decrypted2.address).toBe(wallet.address);
    });
  });

  describe('isValidPrivateKey', () => {
    it('should validate correct private key with 0x prefix', () => {
      const wallet = generateWallet();
      expect(isValidPrivateKey(wallet.privateKey)).toBe(true);
    });

    it('should validate correct private key without 0x prefix', () => {
      const wallet = generateWallet();
      const keyWithoutPrefix = wallet.privateKey.slice(2);
      expect(isValidPrivateKey(keyWithoutPrefix)).toBe(true);
    });

    it('should reject invalid private keys', () => {
      expect(isValidPrivateKey('invalid_key')).toBe(false);
      expect(isValidPrivateKey('')).toBe(false);
      expect(isValidPrivateKey('0x123')).toBe(false);
      expect(isValidPrivateKey('0xgg' + '0'.repeat(62))).toBe(false);
    });

    it('should reject private keys with wrong length', () => {
      expect(isValidPrivateKey('0x' + 'a'.repeat(63))).toBe(false);
      expect(isValidPrivateKey('0x' + 'a'.repeat(65))).toBe(false);
    });
  });

  describe('isValidMnemonic', () => {
    it('should validate correct 12-word mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      expect(isValidMnemonic(mnemonic)).toBe(true);
    });

    it('should validate correct 24-word mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
      expect(isValidMnemonic(mnemonic)).toBe(true);
    });

    it('should reject invalid mnemonics', () => {
      expect(isValidMnemonic('invalid mnemonic')).toBe(false);
      expect(isValidMnemonic('')).toBe(false);
      expect(isValidMnemonic('word')).toBe(false);
    });

    it('should reject mnemonic with wrong word count', () => {
      expect(isValidMnemonic('abandon abandon abandon')).toBe(false);
    });
  });

  describe('detectWalletInputType', () => {
    it('should detect private key with 0x prefix', () => {
      const wallet = generateWallet();
      expect(detectWalletInputType(wallet.privateKey)).toBe('privateKey');
    });

    it('should detect private key without 0x prefix', () => {
      const wallet = generateWallet();
      const keyWithoutPrefix = wallet.privateKey.slice(2);
      expect(detectWalletInputType(keyWithoutPrefix)).toBe('privateKey');
    });

    it('should detect mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      expect(detectWalletInputType(mnemonic)).toBe('mnemonic');
    });

    it('should return null for invalid input', () => {
      expect(detectWalletInputType('invalid input')).toBeNull();
      expect(detectWalletInputType('')).toBeNull();
    });
  });

  describe('createWalletFromInput', () => {
    it('should create wallet from private key with 0x prefix', () => {
      const originalWallet = generateWallet();
      const recreatedWallet = createWalletFromInput(originalWallet.privateKey);
      
      expect(recreatedWallet.address).toBe(originalWallet.address);
      expect(recreatedWallet.privateKey).toBe(originalWallet.privateKey);
    });

    it('should create wallet from private key without 0x prefix', () => {
      const originalWallet = generateWallet();
      const keyWithoutPrefix = originalWallet.privateKey.slice(2);
      const recreatedWallet = createWalletFromInput(keyWithoutPrefix);
      
      expect(recreatedWallet.address).toBe(originalWallet.address);
    });

    it('should create wallet from mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const wallet = createWalletFromInput(mnemonic);
      
      expect(wallet).toHaveProperty('address');
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should create same wallet from same mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const wallet1 = createWalletFromInput(mnemonic);
      const wallet2 = createWalletFromInput(mnemonic);
      
      expect(wallet1.address).toBe(wallet2.address);
      expect(wallet1.privateKey).toBe(wallet2.privateKey);
    });

    it('should throw error for invalid input', () => {
      expect(() => {
        createWalletFromInput('invalid input');
      }).toThrow('Invalid input: not a valid private key or mnemonic phrase');
    });

    it('should support custom derivation path for mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const defaultPath = createWalletFromInput(mnemonic);
      const customPath = createWalletFromInput(mnemonic, "m/44'/60'/0'/0/1");
      
      // Different paths should give different addresses
      expect(defaultPath.address).not.toBe(customPath.address);
    });
  });

  describe('DEFAULT_DERIVATION_PATH', () => {
    it('should use standard Ethereum derivation path', () => {
      expect(DEFAULT_DERIVATION_PATH).toBe("m/44'/60'/0'/0/0");
    });
  });

  describe('Cross-wallet compatibility', () => {
    it('should generate wallet compatible with MetaMask', () => {
      const wallet = generateWallet();
      
      // Should have standard Ethereum address format
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(wallet.address.length).toBe(42);
    });

    it('should handle BIP39 mnemonic correctly', () => {
      // Test mnemonic used by many wallets
      const testMnemonic = 'test test test test test test test test test test test junk';
      const wallet = createWalletFromInput(testMnemonic);
      
      expect(wallet.address).toBeTruthy();
      expect(wallet.privateKey).toBeTruthy();
    });
  });
});
