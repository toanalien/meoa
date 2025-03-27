import { Wallet, HDNodeWallet } from "ethers";
import CryptoJS from "crypto-js";

/**
 * Default derivation path for Ethereum wallets
 */
export const DEFAULT_DERIVATION_PATH = "m/44'/60'/0'/0/0";

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

/**
 * Validates if a string is a valid mnemonic phrase
 * @param mnemonic The mnemonic phrase to validate
 * @returns Boolean indicating if the mnemonic phrase is valid
 */
export function isValidMnemonic(mnemonic: string): boolean {
  try {
    // Check if the mnemonic has 12, 15, 18, 21, or 24 words
    const words = mnemonic.trim().split(/\s+/);
    if (![12, 15, 18, 21, 24].includes(words.length)) {
      return false;
    }
    
    // Try to create a wallet with this mnemonic
    Wallet.fromPhrase(mnemonic);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detects if a string is a private key or mnemonic phrase
 * @param input The input string to check
 * @returns "privateKey", "mnemonic", or null if invalid
 */
export function detectWalletInputType(input: string): "privateKey" | "mnemonic" | null {
  if (isValidPrivateKey(input)) {
    return "privateKey";
  }
  
  if (isValidMnemonic(input)) {
    return "mnemonic";
  }
  
  return null;
}

/**
 * Creates a wallet from a private key or mnemonic phrase
 * @param input The private key or mnemonic phrase
 * @param derivationPath Optional derivation path for mnemonic (defaults to m/44'/60'/0'/0/0)
 * @returns Object containing the wallet's address and private key
 */
export function createWalletFromInput(
  input: string,
  derivationPath: string = DEFAULT_DERIVATION_PATH
): { address: string; privateKey: string } {
  const inputType = detectWalletInputType(input);
  
  if (!inputType) {
    throw new Error("Invalid input: not a valid private key or mnemonic phrase");
  }
  
  let wallet: Wallet | HDNodeWallet;
  
  if (inputType === "privateKey") {
    // Ensure the private key has the 0x prefix
    const formattedKey = input.startsWith("0x") ? input : `0x${input}`;
    wallet = new Wallet(formattedKey);
  } else {
    // Create wallet from mnemonic
    // In ethers v6, we need to use HDNodeWallet.fromPhrase
    wallet = HDNodeWallet.fromPhrase(input);
    
    // If a derivation path is provided and it's not the default one that's already used
    // by HDNodeWallet.fromPhrase, we need to derive it
    if (derivationPath && derivationPath !== "m/44'/60'/0'/0/0") {
      try {
        // Try to derive the custom path
        wallet = wallet.derivePath(derivationPath);
      } catch (derivationError) {
        console.error("Failed to use custom derivation path:", derivationError);
        // We already have a wallet from the default path, so just continue
      }
    }
  }
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}
