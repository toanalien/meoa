/**
 * @jest-environment node
 */

import {
  generateSuiWallet,
  createSuiWalletFromPrivateKey,
  createSuiWalletFromMnemonic,
  encryptSuiWallet,
  decryptSuiWallet,
  isValidSuiPrivateKey,
  isValidSuiMnemonic,
  detectSuiWalletInputType,
  createSuiWalletFromInput,
  DEFAULT_SUI_DERIVATION_PATH,
} from '../suiWalletUtils';

describe('SUI Wallet Utils', () => {
  describe('generateSuiWallet', () => {
    it('should generate a valid SUI wallet', () => {
      const wallet = generateSuiWallet();
      
      expect(wallet).toHaveProperty('address');
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(wallet.privateKey).toBeTruthy();
    });

    it('should generate unique wallets', () => {
      const wallet1 = generateSuiWallet();
      const wallet2 = generateSuiWallet();
      
      expect(wallet1.address).not.toBe(wallet2.address);
      expect(wallet1.privateKey).not.toBe(wallet2.privateKey);
    });
  });

  describe('createSuiWalletFromPrivateKey', () => {
    it('should create wallet from valid base64 private key', () => {
      const originalWallet = generateSuiWallet();
      const recreatedWallet = createSuiWalletFromPrivateKey(originalWallet.privateKey);
      
      expect(recreatedWallet.address).toBe(originalWallet.address);
      expect(recreatedWallet.privateKey).toBe(originalWallet.privateKey);
    });

    it('should throw error for invalid private key', () => {
      expect(() => {
        createSuiWalletFromPrivateKey('invalid_key');
      }).toThrow();
    });
  });

  describe('createSuiWalletFromMnemonic', () => {
    const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

    it('should create wallet from valid mnemonic', () => {
      const wallet = createSuiWalletFromMnemonic(testMnemonic);
      
      expect(wallet).toHaveProperty('address');
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should create same wallet from same mnemonic', () => {
      const wallet1 = createSuiWalletFromMnemonic(testMnemonic);
      const wallet2 = createSuiWalletFromMnemonic(testMnemonic);
      
      expect(wallet1.address).toBe(wallet2.address);
      expect(wallet1.privateKey).toBe(wallet2.privateKey);
    });

    it('should create different wallets for different account indices', () => {
      const wallet0 = createSuiWalletFromMnemonic(testMnemonic, 0);
      const wallet1 = createSuiWalletFromMnemonic(testMnemonic, 1);
      
      expect(wallet0.address).not.toBe(wallet1.address);
      expect(wallet0.privateKey).not.toBe(wallet1.privateKey);
    });

    it('should throw error for invalid mnemonic', () => {
      expect(() => {
        createSuiWalletFromMnemonic('invalid mnemonic phrase');
      }).toThrow();
    });
  });

  describe('encryptSuiWallet and decryptSuiWallet', () => {
    const testPassword = 'SecurePassword123!';

    it('should encrypt and decrypt wallet correctly', async () => {
      const originalWallet = generateSuiWallet();
      
      const encrypted = await encryptSuiWallet(originalWallet.privateKey, testPassword);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(originalWallet.privateKey);
      
      const decrypted = await decryptSuiWallet(encrypted, testPassword);
      expect(decrypted.address).toBe(originalWallet.address);
      expect(decrypted.privateKey).toBe(originalWallet.privateKey);
    });

    it('should fail to decrypt with wrong password', async () => {
      const wallet = generateSuiWallet();
      const encrypted = await encryptSuiWallet(wallet.privateKey, testPassword);
      
      await expect(
        decryptSuiWallet(encrypted, 'WrongPassword')
      ).rejects.toThrow();
    });

    it('should produce different encrypted values for same key', async () => {
      const wallet = generateSuiWallet();
      
      const encrypted1 = await encryptSuiWallet(wallet.privateKey, testPassword);
      const encrypted2 = await encryptSuiWallet(wallet.privateKey, testPassword);
      
      // Due to random salt, encrypted values should differ
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to same wallet
      const decrypted1 = await decryptSuiWallet(encrypted1, testPassword);
      const decrypted2 = await decryptSuiWallet(encrypted2, testPassword);
      
      expect(decrypted1.address).toBe(wallet.address);
      expect(decrypted2.address).toBe(wallet.address);
    });
  });

  describe('isValidSuiPrivateKey', () => {
    it('should validate correct private key', () => {
      const wallet = generateSuiWallet();
      expect(isValidSuiPrivateKey(wallet.privateKey)).toBe(true);
    });

    it('should reject invalid private keys', () => {
      expect(isValidSuiPrivateKey('invalid_key')).toBe(false);
      expect(isValidSuiPrivateKey('')).toBe(false);
      expect(isValidSuiPrivateKey('0x123')).toBe(false);
    });
  });

  describe('isValidSuiMnemonic', () => {
    it('should validate correct 12-word mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      expect(isValidSuiMnemonic(mnemonic)).toBe(true);
    });

    it('should validate correct 24-word mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
      expect(isValidSuiMnemonic(mnemonic)).toBe(true);
    });

    it('should reject invalid mnemonics', () => {
      expect(isValidSuiMnemonic('invalid mnemonic')).toBe(false);
      expect(isValidSuiMnemonic('')).toBe(false);
      expect(isValidSuiMnemonic('word')).toBe(false);
    });
  });

  describe('detectSuiWalletInputType', () => {
    it('should detect private key', () => {
      const wallet = generateSuiWallet();
      expect(detectSuiWalletInputType(wallet.privateKey)).toBe('privateKey');
    });

    it('should detect mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      expect(detectSuiWalletInputType(mnemonic)).toBe('mnemonic');
    });

    it('should return null for invalid input', () => {
      expect(detectSuiWalletInputType('invalid input')).toBeNull();
      expect(detectSuiWalletInputType('')).toBeNull();
    });
  });

  describe('createSuiWalletFromInput', () => {
    it('should create wallet from private key input', () => {
      const originalWallet = generateSuiWallet();
      const recreatedWallet = createSuiWalletFromInput(originalWallet.privateKey);
      
      expect(recreatedWallet.address).toBe(originalWallet.address);
    });

    it('should create wallet from mnemonic input', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const wallet = createSuiWalletFromInput(mnemonic);
      
      expect(wallet).toHaveProperty('address');
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should throw error for invalid input', () => {
      expect(() => {
        createSuiWalletFromInput('invalid input');
      }).toThrow('Invalid input: not a valid SUI private key or mnemonic phrase');
    });

    it('should use custom account index for mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const wallet0 = createSuiWalletFromInput(mnemonic, 0);
      const wallet1 = createSuiWalletFromInput(mnemonic, 1);
      
      expect(wallet0.address).not.toBe(wallet1.address);
    });
  });
});
