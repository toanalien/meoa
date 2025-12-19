import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { fromB64 } from "@mysten/sui.js/utils";

// SUI network configurations
export const SUI_NETWORKS = {
  MAINNET: "mainnet",
  TESTNET: "testnet",
  DEVNET: "devnet",
  LOCALNET: "localnet",
} as const;

export type SuiNetwork = (typeof SUI_NETWORKS)[keyof typeof SUI_NETWORKS];

/**
 * Returns the appropriate SUI explorer URL for a given network and address
 * @param network The SUI network
 * @param address The wallet address
 * @param type The type of entity (address, tx, object)
 * @returns The blockchain explorer URL
 */
export function getSuiExplorerUrl(
  network: SuiNetwork,
  address: string,
  type: "address" | "tx" | "object" = "address"
): string {
  const baseUrl = "https://suiexplorer.com";
  const networkParam = network === "mainnet" ? "" : `?network=${network}`;
  
  return `${baseUrl}/${type}/${address}${networkParam}`;
}

/**
 * Creates a SUI client for the specified network
 * @param network The SUI network to connect to
 * @returns A SuiClient instance
 */
export function createSuiClient(network: SuiNetwork = "mainnet"): SuiClient {
  return new SuiClient({ url: getFullnodeUrl(network) });
}

// Interface for transaction parameters
export interface SuiTransactionParams {
  to: string;
  amount: string; // in SUI (will be converted to MIST)
  gasbudget?: string;
}

// Interface for bulk operation results
export interface SuiBulkOperationResult {
  walletAddress: string;
  success: boolean;
  txHash?: string;
  error?: string;
  balance?: string; // In SUI
}

// Progress callback type
export type SuiProgressCallback = (current: number, total: number) => void;

/**
 * Converts SUI to MIST (1 SUI = 1,000,000,000 MIST)
 * @param sui Amount in SUI
 * @returns Amount in MIST
 */
export function suiToMist(sui: string): bigint {
  const suiAmount = parseFloat(sui);
  return BigInt(Math.floor(suiAmount * 1_000_000_000));
}

/**
 * Converts MIST to SUI
 * @param mist Amount in MIST
 * @returns Amount in SUI as string
 */
export function mistToSui(mist: string | bigint): string {
  const mistAmount = typeof mist === "string" ? BigInt(mist) : mist;
  return (Number(mistAmount) / 1_000_000_000).toFixed(9);
}

/**
 * Gets the SUI balance for a wallet address
 * @param address The wallet address
 * @param network The SUI network
 * @returns The balance in SUI
 */
export async function getSuiBalance(
  address: string,
  network: SuiNetwork = "mainnet"
): Promise<string> {
  try {
    const client = createSuiClient(network);
    const balance = await client.getBalance({ owner: address });
    return mistToSui(balance.totalBalance);
  } catch (error) {
    console.error("Error getting SUI balance:", error);
    throw error;
  }
}

/**
 * Transfers SUI from one wallet to another
 * @param privateKey The sender's private key (base64 encoded)
 * @param params Transaction parameters
 * @param network The SUI network
 * @returns The transaction digest (hash)
 */
export async function transferSui(
  privateKey: string,
  params: SuiTransactionParams,
  network: SuiNetwork = "mainnet"
): Promise<string> {
  try {
    const client = createSuiClient(network);
    
    // Create keypair from private key
    const secretKey = fromB64(privateKey);
    const keypair = Ed25519Keypair.fromSecretKey(secretKey);
    
    // Create transaction block
    const txb = new TransactionBlock();
    
    // Convert SUI to MIST
    const amountInMist = suiToMist(params.amount);
    
    // Split coins and transfer
    const [coin] = txb.splitCoins(txb.gas, [txb.pure(amountInMist)]);
    txb.transferObjects([coin], txb.pure(params.to));
    
    // Set gas budget if provided
    if (params.gasbudget) {
      txb.setGasBudget(BigInt(params.gasbudget));
    }
    
    // Sign and execute transaction
    const result = await client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: txb,
    });
    
    return result.digest;
  } catch (error) {
    console.error("Error transferring SUI:", error);
    throw error;
  }
}

/**
 * Sends SUI from multiple wallets to a single recipient
 * @param privateKeys Array of private keys (base64 encoded)
 * @param params Transaction parameters
 * @param network The SUI network
 * @param onProgress Optional callback for progress updates
 * @returns Array of operation results
 */
export async function bulkSendSui(
  privateKeys: string[],
  params: SuiTransactionParams,
  network: SuiNetwork = "mainnet",
  onProgress?: SuiProgressCallback
): Promise<SuiBulkOperationResult[]> {
  const results: SuiBulkOperationResult[] = [];
  const total = privateKeys.length;
  
  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    
    // Update progress
    if (onProgress) {
      onProgress(i + 1, total);
    }
    
    try {
      // Get wallet address
      const secretKey = fromB64(privateKey);
      const keypair = Ed25519Keypair.fromSecretKey(secretKey);
      const walletAddress = keypair.getPublicKey().toSuiAddress();
      
      // Transfer SUI
      const txHash = await transferSui(privateKey, params, network);
      
      results.push({
        walletAddress,
        success: true,
        txHash,
      });
    } catch (error) {
      // Get wallet address for error reporting
      try {
        const secretKey = fromB64(privateKey);
        const keypair = Ed25519Keypair.fromSecretKey(secretKey);
        const walletAddress = keypair.getPublicKey().toSuiAddress();
        
        results.push({
          walletAddress,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      } catch {
        results.push({
          walletAddress: "Invalid Key",
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  
  return results;
}

/**
 * Checks the balance of multiple SUI wallets
 * @param privateKeys Array of private keys (base64 encoded)
 * @param network The SUI network
 * @param onProgress Optional callback for progress updates
 * @returns Array of operation results with balances
 */
export async function bulkCheckSuiBalance(
  privateKeys: string[],
  network: SuiNetwork = "mainnet",
  onProgress?: SuiProgressCallback
): Promise<SuiBulkOperationResult[]> {
  const results: SuiBulkOperationResult[] = [];
  const total = privateKeys.length;
  
  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    
    // Update progress
    if (onProgress) {
      onProgress(i + 1, total);
    }
    
    try {
      // Get wallet address
      const secretKey = fromB64(privateKey);
      const keypair = Ed25519Keypair.fromSecretKey(secretKey);
      const walletAddress = keypair.getPublicKey().toSuiAddress();
      
      // Get balance
      const balance = await getSuiBalance(walletAddress, network);
      
      results.push({
        walletAddress,
        success: true,
        balance,
      });
    } catch (error) {
      // Get wallet address for error reporting
      try {
        const secretKey = fromB64(privateKey);
        const keypair = Ed25519Keypair.fromSecretKey(secretKey);
        const walletAddress = keypair.getPublicKey().toSuiAddress();
        
        results.push({
          walletAddress,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      } catch {
        results.push({
          walletAddress: "Invalid Key",
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  
  return results;
}

/**
 * Gets all coins owned by an address
 * @param address The wallet address
 * @param network The SUI network
 * @returns Array of coin objects
 */
export async function getSuiCoins(
  address: string,
  network: SuiNetwork = "mainnet"
) {
  const client = createSuiClient(network);
  return await client.getAllCoins({ owner: address });
}

/**
 * Gets transaction details
 * @param digest The transaction digest (hash)
 * @param network The SUI network
 * @returns Transaction details
 */
export async function getSuiTransaction(
  digest: string,
  network: SuiNetwork = "mainnet"
) {
  const client = createSuiClient(network);
  return await client.getTransactionBlock({
    digest,
    options: {
      showEffects: true,
      showInput: true,
      showEvents: true,
      showObjectChanges: true,
      showBalanceChanges: true,
    },
  });
}
