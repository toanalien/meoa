import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { fromB64, toB64 } from "@mysten/sui.js/utils";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import CryptoJS from "crypto-js";

/**
 * Default derivation path for SUI wallets
 * SUI uses the same derivation path as Solana (m/44'/784'/0'/0')
 */
export const DEFAULT_SUI_DERIVATION_PATH = "m/44'/784'/0'/0'";

/**
 * Generates a new SUI wallet with a random keypair
 * @returns Object containing the wallet's address and private key (base64 encoded)
 */
export function generateSuiWallet() {
  const keypair = new Ed25519Keypair();
  const address = keypair.getPublicKey().toSuiAddress();
  const privateKey = toB64(keypair.export().privateKey);
  
  return {
    address,
    privateKey,
  };
}

/**
 * Creates a SUI wallet from a private key
 * @param privateKey The private key (base64 or hex encoded)
 * @returns Object containing the wallet's address and private key
 */
export function createSuiWalletFromPrivateKey(privateKey: string): {
  address: string;
  privateKey: string;
} {
  try {
    // Try to parse as base64
    let secretKey: Uint8Array;
    
    if (privateKey.startsWith("0x")) {
      // Hex format
      const hexKey = privateKey.slice(2);
      secretKey = new Uint8Array(
        hexKey.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
      );
    } else {
      // Base64 format
      secretKey = fromB64(privateKey);
    }
    
    const keypair = Ed25519Keypair.fromSecretKey(secretKey);
    const address = keypair.getPublicKey().toSuiAddress();
    
    return {
      address,
      privateKey: toB64(keypair.export().privateKey),
    };
  } catch (error) {
    console.error("Error creating SUI wallet from private key:", error);
    throw new Error("Invalid SUI private key format");
  }
}

/**
 * Creates a SUI wallet from a mnemonic phrase
 * @param mnemonic The mnemonic phrase (12 or 24 words)
 * @param accountIndex The account index for derivation (default: 0)
 * @returns Object containing the wallet's address and private key
 */
export function createSuiWalletFromMnemonic(
  mnemonic: string,
  accountIndex: number = 0
): {
  address: string;
  privateKey: string;
} {
  try {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error("Invalid mnemonic phrase");
    }
    
    // Generate seed from mnemonic
    const seed = bip39.mnemonicToSeedSync(mnemonic, "");
    
    // Derive the path with account index
    const path = `${DEFAULT_SUI_DERIVATION_PATH}/${accountIndex}'`;
    const { key } = derivePath(path, seed.toString("hex"));
    
    // Create keypair from derived key
    const keypair = Ed25519Keypair.fromSecretKey(key);
    const address = keypair.getPublicKey().toSuiAddress();
    
    return {
      address,
      privateKey: toB64(keypair.export().privateKey),
    };
  } catch (error) {
    console.error("Error creating SUI wallet from mnemonic:", error);
    throw new Error("Failed to create SUI wallet from mnemonic");
  }
}

/**
 * Encrypts a SUI wallet's private key using AES encryption
 * @param privateKey The private key to encrypt (base64 encoded)
 * @param password The password to use for encryption
 * @returns The encrypted private key as a string
 */
export async function encryptSuiWallet(
  privateKey: string,
  password: string
): Promise<string> {
  return CryptoJS.AES.encrypt(privateKey, password).toString();
}

/**
 * Decrypts an encrypted SUI private key and returns the wallet
 * @param encryptedPrivateKey The encrypted private key
 * @param password The password used for encryption
 * @returns Object containing the wallet's address and private key
 */
export async function decryptSuiWallet(
  encryptedPrivateKey: string,
  password: string
): Promise<{ address: string; privateKey: string }> {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, password);
    const privateKey = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!privateKey) {
      throw new Error("Failed to decrypt private key");
    }
    
    return createSuiWalletFromPrivateKey(privateKey);
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt SUI wallet. Incorrect password?");
  }
}

/**
 * Validates if a string is a valid SUI private key
 * @param privateKey The private key to validate (base64 or hex)
 * @returns Boolean indicating if the private key is valid
 */
export function isValidSuiPrivateKey(privateKey: string): boolean {
  try {
    createSuiWalletFromPrivateKey(privateKey);
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
export function isValidSuiMnemonic(mnemonic: string): boolean {
  try {
    return bip39.validateMnemonic(mnemonic.trim());
  } catch {
    return false;
  }
}

/**
 * Detects if a string is a private key or mnemonic phrase for SUI
 * @param input The input string to check
 * @returns "privateKey", "mnemonic", or null if invalid
 */
export function detectSuiWalletInputType(
  input: string
): "privateKey" | "mnemonic" | null {
  if (isValidSuiPrivateKey(input)) {
    return "privateKey";
  }
  
  if (isValidSuiMnemonic(input)) {
    return "mnemonic";
  }
  
  return null;
}

/**
 * Creates a SUI wallet from a private key or mnemonic phrase
 * @param input The private key or mnemonic phrase
 * @param accountIndex Optional account index for mnemonic (defaults to 0)
 * @returns Object containing the wallet's address and private key
 */
export function createSuiWalletFromInput(
  input: string,
  accountIndex: number = 0
): { address: string; privateKey: string } {
  const inputType = detectSuiWalletInputType(input);
  
  if (!inputType) {
    throw new Error(
      "Invalid input: not a valid SUI private key or mnemonic phrase"
    );
  }
  
  if (inputType === "privateKey") {
    return createSuiWalletFromPrivateKey(input);
  } else {
    return createSuiWalletFromMnemonic(input, accountIndex);
  }
}
