import { Keypair, PublicKey } from "@solana/web3.js";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import CryptoJS from "crypto-js";

/**
 * Default derivation path for Solana wallets
 */
export const SOLANA_DEFAULT_DERIVATION_PATH = "m/44'/501'/0'/0'";

/**
 * Interface for Solana wallet data
 */
export interface SolanaWallet {
  address: string;
  privateKey: string;
  publicKey: string;
}

/**
 * Generates a new Solana wallet with a random keypair
 * @returns Object containing the wallet's address, private key, and public key
 */
export function generateSolanaWallet(): SolanaWallet {
  const keypair = Keypair.generate();
  
  return {
    address: keypair.publicKey.toBase58(),
    privateKey: Buffer.from(keypair.secretKey).toString("hex"),
    publicKey: keypair.publicKey.toBase58(),
  };
}

/**
 * Generates a new Solana wallet from a mnemonic phrase
 * @param mnemonic The mnemonic phrase (12, 15, 18, 21, or 24 words)
 * @param derivationPath Optional derivation path (defaults to m/44'/501'/0'/0')
 * @param accountIndex Optional account index for multiple wallets from same mnemonic
 * @returns Object containing the wallet's address, private key, and public key
 */
export function generateSolanaWalletFromMnemonic(
  mnemonic: string,
  derivationPath: string = SOLANA_DEFAULT_DERIVATION_PATH,
  accountIndex: number = 0
): SolanaWallet {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic phrase");
  }

  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const fullPath = `${derivationPath}/${accountIndex}'`;
  const derivedSeed = derivePath(fullPath, seed.toString("hex")).key;
  
  const keypair = Keypair.fromSeed(derivedSeed);
  
  return {
    address: keypair.publicKey.toBase58(),
    privateKey: Buffer.from(keypair.secretKey).toString("hex"),
    publicKey: keypair.publicKey.toBase58(),
  };
}

/**
 * Creates a Solana wallet from a private key
 * @param privateKey The private key (hex string or Uint8Array)
 * @returns Object containing the wallet's address, private key, and public key
 */
export function createSolanaWalletFromPrivateKey(privateKey: string | Uint8Array): SolanaWallet {
  let secretKey: Uint8Array;
  
  if (typeof privateKey === "string") {
    // Remove '0x' prefix if present and convert hex to Uint8Array
    const cleanPrivateKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    secretKey = new Uint8Array(Buffer.from(cleanPrivateKey, "hex"));
  } else {
    secretKey = privateKey;
  }
  
  if (secretKey.length !== 64) {
    throw new Error("Invalid private key length. Solana private keys must be 64 bytes.");
  }
  
  const keypair = Keypair.fromSecretKey(secretKey);
  
  return {
    address: keypair.publicKey.toBase58(),
    privateKey: Buffer.from(keypair.secretKey).toString("hex"),
    publicKey: keypair.publicKey.toBase58(),
  };
}

/**
 * Encrypts a Solana wallet's private key using AES encryption
 * @param privateKey The private key to encrypt
 * @param password The password to use for encryption
 * @returns The encrypted private key as a string
 */
export async function encryptSolanaWallet(privateKey: string, password: string): Promise<string> {
  return CryptoJS.AES.encrypt(privateKey, password).toString();
}

/**
 * Decrypts an encrypted Solana private key and returns the wallet
 * @param encryptedPrivateKey The encrypted private key
 * @param password The password used for encryption
 * @returns Object containing the wallet's address, private key, and public key
 */
export async function decryptSolanaWallet(
  encryptedPrivateKey: string,
  password: string
): Promise<SolanaWallet> {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, password);
    const privateKey = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!privateKey) {
      throw new Error("Failed to decrypt private key");
    }
    
    return createSolanaWalletFromPrivateKey(privateKey);
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt Solana wallet. Incorrect password?");
  }
}

/**
 * Validates if a string is a valid Solana private key
 * @param privateKey The private key to validate
 * @returns Boolean indicating if the private key is valid
 */
export function isValidSolanaPrivateKey(privateKey: string): boolean {
  try {
    // Remove '0x' prefix if present
    const cleanPrivateKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    
    // Check if it's a valid hex string of the correct length (128 characters = 64 bytes)
    if (!/^[0-9a-fA-F]{128}$/.test(cleanPrivateKey)) {
      return false;
    }
    
    // Try to create a keypair with this private key
    const secretKey = new Uint8Array(Buffer.from(cleanPrivateKey, "hex"));
    Keypair.fromSecretKey(secretKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a valid Solana address (public key)
 * @param address The address to validate
 * @returns Boolean indicating if the address is valid
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a valid mnemonic phrase for Solana
 * @param mnemonic The mnemonic phrase to validate
 * @returns Boolean indicating if the mnemonic phrase is valid
 */
export function isValidSolanaMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Detects if a string is a Solana private key, mnemonic phrase, or address
 * @param input The input string to check
 * @returns "privateKey", "mnemonic", "address", or null if invalid
 */
export function detectSolanaInputType(input: string): "privateKey" | "mnemonic" | "address" | null {
  if (isValidSolanaPrivateKey(input)) {
    return "privateKey";
  }
  
  if (isValidSolanaMnemonic(input)) {
    return "mnemonic";
  }
  
  if (isValidSolanaAddress(input)) {
    return "address";
  }
  
  return null;
}

/**
 * Creates a Solana wallet from various input types (private key or mnemonic phrase)
 * @param input The private key or mnemonic phrase
 * @param derivationPath Optional derivation path for mnemonic (defaults to m/44'/501'/0'/0')
 * @param accountIndex Optional account index for multiple wallets from same mnemonic
 * @returns Object containing the wallet's address, private key, and public key
 */
export function createSolanaWalletFromInput(
  input: string,
  derivationPath: string = SOLANA_DEFAULT_DERIVATION_PATH,
  accountIndex: number = 0
): SolanaWallet {
  const inputType = detectSolanaInputType(input);
  
  if (!inputType || inputType === "address") {
    throw new Error("Invalid input: not a valid private key or mnemonic phrase");
  }
  
  if (inputType === "privateKey") {
    return createSolanaWalletFromPrivateKey(input);
  } else {
    // mnemonic
    return generateSolanaWalletFromMnemonic(input, derivationPath, accountIndex);
  }
}

/**
 * Generates a new mnemonic phrase for Solana wallets
 * @param strength Optional strength in bits (128, 160, 192, 224, 256). Defaults to 128 (12 words)
 * @returns A new mnemonic phrase
 */
export function generateSolanaMnemonic(strength: number = 128): string {
  return bip39.generateMnemonic(strength);
}
