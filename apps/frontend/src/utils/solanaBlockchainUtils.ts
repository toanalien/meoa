import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

// Solana network configurations
export const SOLANA_NETWORKS = {
  MAINNET: 'mainnet-beta',
  TESTNET: 'testnet',
  DEVNET: 'devnet',
  LOCALNET: 'localnet',
} as const;

export type SolanaNetwork = (typeof SOLANA_NETWORKS)[keyof typeof SOLANA_NETWORKS];

// Solana RPC endpoints
const SOLANA_RPC_ENDPOINTS: Record<SolanaNetwork, string> = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  'testnet': 'https://api.testnet.solana.com',
  'devnet': 'https://api.devnet.solana.com',
  'localnet': 'http://localhost:8899',
};

/**
 * Returns the appropriate Solana explorer URL for a given network and address
 * @param network The Solana network
 * @param address The wallet address or transaction signature
 * @param type The type of entity (address, tx)
 * @returns The blockchain explorer URL
 */
export function getSolanaExplorerUrl(
  network: SolanaNetwork,
  address: string,
  type: 'address' | 'tx' = 'address'
): string {
  const cluster = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
  return `https://explorer.solana.com/${type}/${address}${cluster}`;
}

/**
 * Creates a Solana connection for the specified network
 * @param network The Solana network to connect to
 * @param customRpcUrl Optional custom RPC URL
 * @returns A Solana Connection instance
 */
export function createSolanaConnection(
  network: SolanaNetwork = 'mainnet-beta',
  customRpcUrl?: string
): Connection {
  const rpcUrl = customRpcUrl || SOLANA_RPC_ENDPOINTS[network];
  return new Connection(rpcUrl, 'confirmed');
}

// Interface for transaction parameters
export interface SolanaTransactionParams {
  to: string;
  amount: string; // in SOL (will be converted to lamports)
}

// Interface for bulk operation results
export interface SolanaBulkOperationResult {
  walletAddress: string;
  success: boolean;
  txHash?: string;
  error?: string;
  balance?: string; // In SOL
}

// Progress callback type
export type SolanaProgressCallback = (current: number, total: number) => void;

/**
 * Converts SOL to lamports (1 SOL = 1,000,000,000 lamports)
 * @param sol Amount in SOL
 * @returns Amount in lamports
 */
export function solToLamports(sol: string): number {
  return Math.floor(parseFloat(sol) * LAMPORTS_PER_SOL);
}

/**
 * Converts lamports to SOL
 * @param lamports Amount in lamports
 * @returns Amount in SOL as string
 */
export function lamportsToSol(lamports: number | bigint): string {
  const lamportsNum = typeof lamports === 'bigint' ? Number(lamports) : lamports;
  return (lamportsNum / LAMPORTS_PER_SOL).toFixed(9);
}

/**
 * Gets the SOL balance for a wallet address
 * @param address The wallet address
 * @param network The Solana network
 * @param customRpcUrl Optional custom RPC URL
 * @returns The balance in SOL
 */
export async function getSolanaBalance(
  address: string,
  network: SolanaNetwork = 'mainnet-beta',
  customRpcUrl?: string
): Promise<string> {
  try {
    const connection = createSolanaConnection(network, customRpcUrl);
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    return lamportsToSol(balance);
  } catch (error) {
    console.error('Error getting Solana balance:', error);
    throw error;
  }
}

/**
 * Transfers SOL from one wallet to another
 * @param privateKey The sender's private key (base58 encoded)
 * @param params Transaction parameters
 * @param network The Solana network
 * @param customRpcUrl Optional custom RPC URL
 * @returns The transaction signature
 */
export async function transferSolana(
  privateKey: string,
  params: SolanaTransactionParams,
  network: SolanaNetwork = 'mainnet-beta',
  customRpcUrl?: string
): Promise<string> {
  try {
    const connection = createSolanaConnection(network, customRpcUrl);
    
    // Decode private key from base58
    const secretKey = bs58.decode(privateKey);
    const fromKeypair = Keypair.fromSecretKey(secretKey);
    
    // Create recipient public key
    const toPublicKey = new PublicKey(params.to);
    
    // Convert SOL to lamports
    const lamports = solToLamports(params.amount);
    
    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports,
      })
    );
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromKeypair]
    );
    
    return signature;
  } catch (error) {
    console.error('Error transferring SOL:', error);
    throw error;
  }
}

/**
 * Sends SOL from multiple wallets to a single recipient
 * @param privateKeys Array of private keys (base58 encoded)
 * @param params Transaction parameters
 * @param network The Solana network
 * @param onProgress Optional callback for progress updates
 * @param customRpcUrl Optional custom RPC URL
 * @returns Array of operation results
 */
export async function bulkSendSolana(
  privateKeys: string[],
  params: SolanaTransactionParams,
  network: SolanaNetwork = 'mainnet-beta',
  onProgress?: SolanaProgressCallback,
  customRpcUrl?: string
): Promise<SolanaBulkOperationResult[]> {
  const results: SolanaBulkOperationResult[] = [];
  const total = privateKeys.length;
  
  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    
    // Update progress
    if (onProgress) {
      onProgress(i + 1, total);
    }
    
    try {
      // Get wallet address
      const secretKey = bs58.decode(privateKey);
      const keypair = Keypair.fromSecretKey(secretKey);
      const walletAddress = keypair.publicKey.toBase58();
      
      // Transfer SOL
      const txHash = await transferSolana(privateKey, params, network, customRpcUrl);
      
      results.push({
        walletAddress,
        success: true,
        txHash,
      });
    } catch (error) {
      // Get wallet address for error reporting
      try {
        const secretKey = bs58.decode(privateKey);
        const keypair = Keypair.fromSecretKey(secretKey);
        const walletAddress = keypair.publicKey.toBase58();
        
        results.push({
          walletAddress,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      } catch {
        results.push({
          walletAddress: 'Invalid Key',
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  
  return results;
}

/**
 * Checks the balance of multiple Solana wallets
 * @param privateKeys Array of private keys (base58 encoded)
 * @param network The Solana network
 * @param onProgress Optional callback for progress updates
 * @param customRpcUrl Optional custom RPC URL
 * @returns Array of operation results with balances
 */
export async function bulkCheckSolanaBalance(
  privateKeys: string[],
  network: SolanaNetwork = 'mainnet-beta',
  onProgress?: SolanaProgressCallback,
  customRpcUrl?: string
): Promise<SolanaBulkOperationResult[]> {
  const results: SolanaBulkOperationResult[] = [];
  const total = privateKeys.length;
  
  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    
    // Update progress
    if (onProgress) {
      onProgress(i + 1, total);
    }
    
    try {
      // Get wallet address
      const secretKey = bs58.decode(privateKey);
      const keypair = Keypair.fromSecretKey(secretKey);
      const walletAddress = keypair.publicKey.toBase58();
      
      // Get balance
      const balance = await getSolanaBalance(walletAddress, network, customRpcUrl);
      
      results.push({
        walletAddress,
        success: true,
        balance,
      });
    } catch (error) {
      // Get wallet address for error reporting
      try {
        const secretKey = bs58.decode(privateKey);
        const keypair = Keypair.fromSecretKey(secretKey);
        const walletAddress = keypair.publicKey.toBase58();
        
        results.push({
          walletAddress,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      } catch {
        results.push({
          walletAddress: 'Invalid Key',
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  
  return results;
}

/**
 * Gets transaction details
 * @param signature The transaction signature
 * @param network The Solana network
 * @param customRpcUrl Optional custom RPC URL
 * @returns Transaction details
 */
export async function getSolanaTransaction(
  signature: string,
  network: SolanaNetwork = 'mainnet-beta',
  customRpcUrl?: string
) {
  const connection = createSolanaConnection(network, customRpcUrl);
  return await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });
}

/**
 * Gets recent transactions for an address
 * @param address The wallet address
 * @param limit Maximum number of transactions to fetch
 * @param network The Solana network
 * @param customRpcUrl Optional custom RPC URL
 * @returns Array of transaction signatures
 */
export async function getSolanaTransactionHistory(
  address: string,
  limit: number = 10,
  network: SolanaNetwork = 'mainnet-beta',
  customRpcUrl?: string
) {
  const connection = createSolanaConnection(network, customRpcUrl);
  const publicKey = new PublicKey(address);
  
  const signatures = await connection.getSignaturesForAddress(publicKey, {
    limit,
  });
  
  return signatures;
}

/**
 * Requests airdrop on devnet/testnet (for testing purposes)
 * @param address The wallet address to receive airdrop
 * @param amount Amount in SOL
 * @param network The Solana network (must be devnet or testnet)
 * @returns Transaction signature
 */
export async function requestSolanaAirdrop(
  address: string,
  amount: number = 1,
  network: SolanaNetwork = 'devnet'
): Promise<string> {
  if (network === 'mainnet-beta') {
    throw new Error('Airdrop not available on mainnet');
  }
  
  const connection = createSolanaConnection(network);
  const publicKey = new PublicKey(address);
  const lamports = solToLamports(amount.toString());
  
  const signature = await connection.requestAirdrop(publicKey, lamports);
  await connection.confirmTransaction(signature);
  
  return signature;
}
