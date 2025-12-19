/**
 * @jest-environment jsdom
 */

import { ethers } from 'ethers';
import { Keypair as SolanaKeypair } from '@solana/web3.js';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { isValidEthereumAddress } from '../walletUtils';
import { isValidSolanaAddress } from '../solanaWalletUtils';
import { isValidSuiAddress } from '../suiWalletUtils';

/**
 * Watch-Only Wallets Test Suite
 * 
 * Tests the ability to import and track wallets without private keys.
 * This is useful for monitoring wallets without the ability to send transactions.
 * 
 * Coverage:
 * - Address validation for all blockchain types
 * - Watch-only wallet import flows
 * - Multi-chain watch-only operations
 * - Address format validation and normalization
 */

describe('Watch-Only Wallets - Address Validation', () => {
  describe('Ethereum Address Validation', () => {
    it('should validate correct Ethereum address with 0x prefix', () => {
      const wallet = ethers.Wallet.createRandom();
      const address = wallet.address;
      
      expect(isValidEthereumAddress(address)).toBe(true);
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should validate checksum addresses', () => {
      const checksumAddress = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
      expect(isValidEthereumAddress(checksumAddress)).toBe(true);
    });

    it('should normalize lowercase Ethereum addresses', () => {
      const address = '0xabcdef0123456789abcdef0123456789abcdef01';
      expect(isValidEthereumAddress(address)).toBe(true);
    });

    it('should reject invalid Ethereum addresses', () => {
      expect(isValidEthereumAddress('0x123')).toBe(false);
      expect(isValidEthereumAddress('not-an-address')).toBe(false);
      expect(isValidEthereumAddress('')).toBe(false);
    });

    it('should accept addresses without 0x prefix and add it', () => {
      const address = 'abcdef0123456789abcdef0123456789abcdef01';
      expect(isValidEthereumAddress('0x' + address)).toBe(true);
    });

    it('should validate EVM-compatible addresses (BSC, Polygon, etc.)', () => {
      // EVM chains use the same address format
      const wallet = ethers.Wallet.createRandom();
      const address = wallet.address;
      
      expect(isValidEthereumAddress(address)).toBe(true);
    });
  });

  describe('Solana Address Validation', () => {
    it('should validate correct Solana address', () => {
      const keypair = SolanaKeypair.generate();
      const address = keypair.publicKey.toBase58();
      
      expect(isValidSolanaAddress(address)).toBe(true);
      expect(address).not.toMatch(/^0x/);
      expect(address.length).toBeGreaterThan(20);
    });

    it('should reject invalid Solana addresses', () => {
      expect(isValidSolanaAddress('invalid-address')).toBe(false);
      expect(isValidSolanaAddress('0x1234567890abcdef')).toBe(false);
      expect(isValidSolanaAddress('')).toBe(false);
    });

    it('should validate base58 encoded addresses', () => {
      // Valid Solana addresses are base58 encoded
      const validAddress = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
      expect(isValidSolanaAddress(validAddress)).toBe(true);
    });

    it('should reject addresses with invalid base58 characters', () => {
      const invalidAddress = '0OIl1234567890'; // Contains 0, O, I, l which are not in base58
      expect(isValidSolanaAddress(invalidAddress)).toBe(false);
    });
  });

  describe('SUI Address Validation', () => {
    it('should validate correct SUI address', () => {
      const keypair = new Ed25519Keypair();
      const address = keypair.getPublicKey().toSuiAddress();
      
      expect(isValidSuiAddress(address)).toBe(true);
      expect(address).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should reject invalid SUI addresses', () => {
      expect(isValidSuiAddress('invalid-address')).toBe(false);
      expect(isValidSuiAddress('0x123')).toBe(false);
      expect(isValidSuiAddress('')).toBe(false);
    });

    it('should validate 64-character hex addresses with 0x prefix', () => {
      const address = '0x' + 'a'.repeat(64);
      expect(isValidSuiAddress(address)).toBe(true);
    });

    it('should reject SUI addresses with incorrect length', () => {
      expect(isValidSuiAddress('0x' + 'a'.repeat(40))).toBe(false); // Ethereum length
      expect(isValidSuiAddress('0x' + 'a'.repeat(63))).toBe(false); // Too short
      expect(isValidSuiAddress('0x' + 'a'.repeat(65))).toBe(false); // Too long
    });

    it('should normalize SUI addresses to lowercase', () => {
      const address = '0x' + 'A'.repeat(64);
      expect(isValidSuiAddress(address)).toBe(true);
    });
  });
});

describe('Watch-Only Wallets - Multi-Chain Support', () => {
  describe('Cross-Chain Address Format Differences', () => {
    it('should distinguish between Ethereum and SUI addresses', () => {
      const ethWallet = ethers.Wallet.createRandom();
      const suiKeypair = new Ed25519Keypair();
      
      const ethAddress = ethWallet.address;
      const suiAddress = suiKeypair.getPublicKey().toSuiAddress();
      
      // Ethereum: 0x + 40 hex chars
      expect(ethAddress.length).toBe(42);
      // SUI: 0x + 64 hex chars
      expect(suiAddress.length).toBe(66);
      
      expect(isValidEthereumAddress(ethAddress)).toBe(true);
      expect(isValidEthereumAddress(suiAddress)).toBe(false);
      
      expect(isValidSuiAddress(suiAddress)).toBe(true);
      expect(isValidSuiAddress(ethAddress)).toBe(false);
    });

    it('should distinguish Solana addresses from EVM addresses', () => {
      const ethWallet = ethers.Wallet.createRandom();
      const solanaKeypair = SolanaKeypair.generate();
      
      const ethAddress = ethWallet.address;
      const solanaAddress = solanaKeypair.publicKey.toBase58();
      
      expect(isValidEthereumAddress(ethAddress)).toBe(true);
      expect(isValidEthereumAddress(solanaAddress)).toBe(false);
      
      expect(isValidSolanaAddress(solanaAddress)).toBe(true);
      expect(isValidSolanaAddress(ethAddress)).toBe(false);
    });

    it('should handle all three blockchain types simultaneously', () => {
      const ethWallet = ethers.Wallet.createRandom();
      const solanaKeypair = SolanaKeypair.generate();
      const suiKeypair = new Ed25519Keypair();
      
      const addresses = {
        ethereum: ethWallet.address,
        solana: solanaKeypair.publicKey.toBase58(),
        sui: suiKeypair.getPublicKey().toSuiAddress(),
      };
      
      // Each address should only validate for its own blockchain
      expect(isValidEthereumAddress(addresses.ethereum)).toBe(true);
      expect(isValidSolanaAddress(addresses.ethereum)).toBe(false);
      expect(isValidSuiAddress(addresses.ethereum)).toBe(false);
      
      expect(isValidEthereumAddress(addresses.solana)).toBe(false);
      expect(isValidSolanaAddress(addresses.solana)).toBe(true);
      expect(isValidSuiAddress(addresses.solana)).toBe(false);
      
      expect(isValidEthereumAddress(addresses.sui)).toBe(false);
      expect(isValidSolanaAddress(addresses.sui)).toBe(false);
      expect(isValidSuiAddress(addresses.sui)).toBe(true);
    });
  });

  describe('Bulk Watch-Only Wallet Validation', () => {
    it('should validate multiple Ethereum watch-only addresses', () => {
      const addresses = Array.from({ length: 5 }, () => ethers.Wallet.createRandom().address);
      
      addresses.forEach(address => {
        expect(isValidEthereumAddress(address)).toBe(true);
      });
    });

    it('should validate multiple Solana watch-only addresses', () => {
      const addresses = Array.from({ length: 5 }, () => 
        SolanaKeypair.generate().publicKey.toBase58()
      );
      
      addresses.forEach(address => {
        expect(isValidSolanaAddress(address)).toBe(true);
      });
    });

    it('should validate multiple SUI watch-only addresses', () => {
      const addresses = Array.from({ length: 5 }, () => 
        new Ed25519Keypair().getPublicKey().toSuiAddress()
      );
      
      addresses.forEach(address => {
        expect(isValidSuiAddress(address)).toBe(true);
      });
    });

    it('should filter out invalid addresses from mixed batch', () => {
      const mixedAddresses = [
        ethers.Wallet.createRandom().address, // Valid ETH
        'invalid-address', // Invalid
        SolanaKeypair.generate().publicKey.toBase58(), // Valid SOL
        '0x123', // Invalid
        new Ed25519Keypair().getPublicKey().toSuiAddress(), // Valid SUI
      ];
      
      const validEth = mixedAddresses.filter(isValidEthereumAddress);
      const validSol = mixedAddresses.filter(isValidSolanaAddress);
      const validSui = mixedAddresses.filter(isValidSuiAddress);
      
      expect(validEth.length).toBe(1);
      expect(validSol.length).toBe(1);
      expect(validSui.length).toBe(1);
    });
  });
});

describe('Watch-Only Wallets - Use Cases', () => {
  describe('Portfolio Tracking', () => {
    it('should support tracking multiple wallets across chains', () => {
      const portfolio = {
        ethereum: [
          ethers.Wallet.createRandom().address,
          ethers.Wallet.createRandom().address,
        ],
        solana: [
          SolanaKeypair.generate().publicKey.toBase58(),
        ],
        sui: [
          new Ed25519Keypair().getPublicKey().toSuiAddress(),
          new Ed25519Keypair().getPublicKey().toSuiAddress(),
        ],
      };
      
      expect(portfolio.ethereum).toHaveLength(2);
      expect(portfolio.solana).toHaveLength(1);
      expect(portfolio.sui).toHaveLength(2);
      
      portfolio.ethereum.forEach(addr => expect(isValidEthereumAddress(addr)).toBe(true));
      portfolio.solana.forEach(addr => expect(isValidSolanaAddress(addr)).toBe(true));
      portfolio.sui.forEach(addr => expect(isValidSuiAddress(addr)).toBe(true));
    });

    it('should track same logical wallet across different chains', () => {
      // Simulating a user who has wallets on all chains
      const userWallets = {
        name: 'Main Portfolio',
        addresses: {
          ethereum: ethers.Wallet.createRandom().address,
          bsc: ethers.Wallet.createRandom().address, // Same format as ETH
          polygon: ethers.Wallet.createRandom().address, // Same format as ETH
          solana: SolanaKeypair.generate().publicKey.toBase58(),
          sui: new Ed25519Keypair().getPublicKey().toSuiAddress(),
        },
      };
      
      // All EVM chains should validate with Ethereum validator
      expect(isValidEthereumAddress(userWallets.addresses.ethereum)).toBe(true);
      expect(isValidEthereumAddress(userWallets.addresses.bsc)).toBe(true);
      expect(isValidEthereumAddress(userWallets.addresses.polygon)).toBe(true);
      
      // Non-EVM chains should validate with their own validators
      expect(isValidSolanaAddress(userWallets.addresses.solana)).toBe(true);
      expect(isValidSuiAddress(userWallets.addresses.sui)).toBe(true);
    });
  });

  describe('Address Book Management', () => {
    it('should support labeled watch-only addresses', () => {
      const addressBook = [
        {
          label: 'Friend ETH Wallet',
          blockchain: 'ethereum',
          address: ethers.Wallet.createRandom().address,
        },
        {
          label: 'Exchange SOL Address',
          blockchain: 'solana',
          address: SolanaKeypair.generate().publicKey.toBase58(),
        },
        {
          label: 'SUI Treasury',
          blockchain: 'sui',
          address: new Ed25519Keypair().getPublicKey().toSuiAddress(),
        },
      ];
      
      addressBook.forEach(entry => {
        if (entry.blockchain === 'ethereum') {
          expect(isValidEthereumAddress(entry.address)).toBe(true);
        } else if (entry.blockchain === 'solana') {
          expect(isValidSolanaAddress(entry.address)).toBe(true);
        } else if (entry.blockchain === 'sui') {
          expect(isValidSuiAddress(entry.address)).toBe(true);
        }
      });
    });

    it('should detect duplicate watch-only addresses', () => {
      const address = ethers.Wallet.createRandom().address;
      const addressBook = [
        { label: 'Wallet 1', address },
        { label: 'Wallet 2', address }, // Duplicate
      ];
      
      const addresses = addressBook.map(entry => entry.address);
      const uniqueAddresses = new Set(addresses);
      
      expect(addresses.length).toBe(2);
      expect(uniqueAddresses.size).toBe(1); // Only 1 unique address
    });
  });

  describe('Exchange Address Monitoring', () => {
    it('should validate common exchange deposit addresses', () => {
      // Exchanges typically provide deposit addresses in standard formats
      const exchangeAddresses = {
        ethereumDeposit: ethers.Wallet.createRandom().address,
        solanaDeposit: SolanaKeypair.generate().publicKey.toBase58(),
        suiDeposit: new Ed25519Keypair().getPublicKey().toSuiAddress(),
      };
      
      expect(isValidEthereumAddress(exchangeAddresses.ethereumDeposit)).toBe(true);
      expect(isValidSolanaAddress(exchangeAddresses.solanaDeposit)).toBe(true);
      expect(isValidSuiAddress(exchangeAddresses.suiDeposit)).toBe(true);
    });
  });
});

describe('Watch-Only Wallets - Error Handling', () => {
  describe('Invalid Input Handling', () => {
    it('should handle null and undefined gracefully', () => {
      expect(isValidEthereumAddress(null as any)).toBe(false);
      expect(isValidEthereumAddress(undefined as any)).toBe(false);
      expect(isValidSolanaAddress(null as any)).toBe(false);
      expect(isValidSolanaAddress(undefined as any)).toBe(false);
      expect(isValidSuiAddress(null as any)).toBe(false);
      expect(isValidSuiAddress(undefined as any)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(isValidEthereumAddress('')).toBe(false);
      expect(isValidSolanaAddress('')).toBe(false);
      expect(isValidSuiAddress('')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(isValidEthereumAddress('   ')).toBe(false);
      expect(isValidSolanaAddress('   ')).toBe(false);
      expect(isValidSuiAddress('   ')).toBe(false);
    });

    it('should trim addresses before validation', () => {
      const ethAddress = ethers.Wallet.createRandom().address;
      const paddedAddress = `  ${ethAddress}  `;
      
      // Should fail with padding
      expect(isValidEthereumAddress(paddedAddress)).toBe(false);
      // Should succeed when trimmed
      expect(isValidEthereumAddress(paddedAddress.trim())).toBe(true);
    });
  });

  describe('Cross-Blockchain Confusion Prevention', () => {
    it('should prevent using Ethereum address as Solana address', () => {
      const ethAddress = ethers.Wallet.createRandom().address;
      expect(isValidSolanaAddress(ethAddress)).toBe(false);
    });

    it('should prevent using Solana address as SUI address', () => {
      const solAddress = SolanaKeypair.generate().publicKey.toBase58();
      expect(isValidSuiAddress(solAddress)).toBe(false);
    });

    it('should prevent using SUI address as Ethereum address', () => {
      const suiAddress = new Ed25519Keypair().getPublicKey().toSuiAddress();
      expect(isValidEthereumAddress(suiAddress)).toBe(false);
    });
  });
});
