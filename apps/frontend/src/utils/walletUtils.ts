import { Wallet } from "ethers";
import CryptoJS from "crypto-js";

/**
 * Generates a new Ethereum wallet
 * @returns Object containing the wallet's address and private key
 */
export function generateWallet() {
  const wallet = Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

/**
 * Encrypts a wallet's private key using AES encryption
 * @param privateKey The private key to encrypt
 * @param password The password to use for encryption
 * @returns The encrypted private key as a string
 */
export async function encryptWallet(privateKey: string, password: string): Promise<string> {
  return CryptoJS.AES.encrypt(privateKey, password).toString();
}

/**
 * Decrypts an encrypted private key and returns the wallet
 * @param encryptedPrivateKey The encrypted private key
 * @param password The password used for encryption
 * @returns Object containing the wallet's address and private key
 */
export async function decryptWallet(
  encryptedPrivateKey: string,
  password: string
): Promise<{ address: string; privateKey: string }> {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, password);
    const privateKey = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!privateKey) {
      throw new Error("Failed to decrypt private key");
    }
    
    const wallet = new Wallet(privateKey);
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt wallet. Incorrect password?");
  }
}

/**
 * Validates if a string is a valid Ethereum private key
 * @param privateKey The private key to validate
 * @returns Boolean indicating if the private key is valid
 */
export function isValidPrivateKey(privateKey: string): boolean {
  try {
    // Remove '0x' prefix if present
    const cleanPrivateKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    
    // Check if it's a valid hex string of the correct length (64 characters = 32 bytes)
    if (!/^[0-9a-fA-F]{64}$/.test(cleanPrivateKey)) {
      return false;
    }
    
    // Try to create a wallet with this private key
    new Wallet(`0x${cleanPrivateKey}`);
    return true;
  } catch {
    return false;
  }
}
