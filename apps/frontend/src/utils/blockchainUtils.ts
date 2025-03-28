import { ethers, Wallet, Contract } from "ethers";

// USDT contract addresses for different networks
export const USDT_ADDRESSES = {
  ETHEREUM: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  BSC: "0x55d398326f99059ff775485246999027b3197955", // BSC USDT (BUSD)
  POLYGON: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
  ARBITRUM: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
  OPTIMISM: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
};

/**
 * Returns the appropriate blockchain explorer URL for a given network and address
 * @param rpcUrl The RPC URL for the network
 * @param address The wallet address
 * @returns The blockchain explorer URL for the address
 */
export function getExplorerUrl(rpcUrl: string, address: string): string {
  // Determine which explorer to use based on the RPC URL
  if (rpcUrl.includes("binance") || rpcUrl.includes("bsc")) {
    return `https://bscscan.com/address/${address}`;
  } else if (rpcUrl.includes("polygon")) {
    return `https://polygonscan.com/address/${address}`;
  } else if (rpcUrl.includes("arbitrum")) {
    return `https://arbiscan.io/address/${address}`;
  } else if (rpcUrl.includes("optimism")) {
    return `https://optimistic.etherscan.io/address/${address}`;
  } else if (rpcUrl.includes("sepolia")) {
    return `https://sepolia.etherscan.io/address/${address}`;
  } else {
    // Default to Etherscan for Ethereum and unknown networks
    return `https://etherscan.io/address/${address}`;
  }
}

// Standard ERC20 ABI for token interactions
const ERC20_ABI = [
  "function transfer(address to, uint amount) returns (bool)",
  "function approve(address spender, uint amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint)",
  "function allowance(address owner, address spender) view returns (uint)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

// Interface for transaction parameters
export interface TransactionParams {
  to: string;
  value?: string; // in ETH or token amount
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  tokenAddress?: string; // For token transfers
}

// Interface for bulk operation results
export interface BulkOperationResult {
  walletAddress: string;
  success: boolean;
  txHash?: string;
  error?: string;
  balance?: string; // Added for balance check operations
  txCount?: number; // Transaction count for the wallet
  tokenSymbol?: string; // Added for token balance check operations
  tokenDecimals?: number; // Added for token balance check operations
}

// Progress callback type
export type ProgressCallback = (current: number, total: number) => void;

/**
 * Creates a provider for the specified network
 * @param rpcUrl The RPC URL for the network
 * @returns An ethers provider
 */
export function createProvider(rpcUrl: string) {
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Sends native tokens (ETH, BNB, etc.) from multiple wallets
 * @param privateKeys Array of private keys
 * @param params Transaction parameters
 * @param rpcUrl The RPC URL for the network
 * @param onProgress Optional callback for progress updates
 * @returns Array of operation results
 */
export async function bulkSend(
  privateKeys: string[],
  params: TransactionParams,
  rpcUrl: string,
  onProgress?: ProgressCallback
): Promise<BulkOperationResult[]> {
  const provider = createProvider(rpcUrl);
  const results: BulkOperationResult[] = [];
  const total = privateKeys.length;

  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    
    // Update progress
    if (onProgress) {
      onProgress(i + 1, total);
    }
    try {
      const wallet = new Wallet(privateKey, provider);
      
      const tx = await wallet.sendTransaction({
        to: params.to,
        value: params.value ? ethers.parseEther(params.value) : undefined,
        gasLimit: params.gasLimit ? ethers.parseUnits(params.gasLimit, "wei") : undefined,
        gasPrice: params.gasPrice ? ethers.parseUnits(params.gasPrice, "gwei") : undefined,
      });

      results.push({
        walletAddress: wallet.address,
        success: true,
        txHash: tx.hash,
      });
    } catch (error) {
      console.error(`Error sending from wallet:`, error);
      results.push({
        walletAddress: new Wallet(privateKey).address,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Transfers ERC20 tokens from multiple wallets
 * @param privateKeys Array of private keys
 * @param params Transaction parameters including token address
 * @param rpcUrl The RPC URL for the network
 * @param onProgress Optional callback for progress updates
 * @returns Array of operation results
 */
export async function bulkTransferToken(
  privateKeys: string[],
  params: TransactionParams,
  rpcUrl: string,
  onProgress?: ProgressCallback
): Promise<BulkOperationResult[]> {
  if (!params.tokenAddress) {
    throw new Error("Token address is required for token transfers");
  }

  const provider = createProvider(rpcUrl);
  const results: BulkOperationResult[] = [];
  const total = privateKeys.length;

  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    
    // Update progress
    if (onProgress) {
      onProgress(i + 1, total);
    }
    try {
      const wallet = new Wallet(privateKey, provider);
      const tokenContract = new Contract(params.tokenAddress, ERC20_ABI, wallet);
      
      // Get token decimals
      const decimals = await tokenContract.decimals();
      
      // Parse the amount with the correct number of decimals
      const amount = ethers.parseUnits(params.value || "0", decimals);
      
      const tx = await tokenContract.transfer(params.to, amount, {
        gasLimit: params.gasLimit ? ethers.parseUnits(params.gasLimit, "wei") : undefined,
        gasPrice: params.gasPrice ? ethers.parseUnits(params.gasPrice, "gwei") : undefined,
      });

      results.push({
        walletAddress: wallet.address,
        success: true,
        txHash: tx.hash,
      });
    } catch (error) {
      console.error(`Error transferring tokens from wallet:`, error);
      results.push({
        walletAddress: new Wallet(privateKey).address,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Approves ERC20 tokens for spending from multiple wallets
 * @param privateKeys Array of private keys
 * @param params Transaction parameters including token address
 * @param rpcUrl The RPC URL for the network
 * @param onProgress Optional callback for progress updates
 * @returns Array of operation results
 */
export async function bulkApproveToken(
  privateKeys: string[],
  params: TransactionParams,
  rpcUrl: string,
  onProgress?: ProgressCallback
): Promise<BulkOperationResult[]> {
  if (!params.tokenAddress) {
    throw new Error("Token address is required for token approvals");
  }

  const provider = createProvider(rpcUrl);
  const results: BulkOperationResult[] = [];
  const total = privateKeys.length;

  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    
    // Update progress
    if (onProgress) {
      onProgress(i + 1, total);
    }
    try {
      const wallet = new Wallet(privateKey, provider);
      const tokenContract = new Contract(params.tokenAddress, ERC20_ABI, wallet);
      
      // Get token decimals
      const decimals = await tokenContract.decimals();
      
      // Parse the amount with the correct number of decimals
      // If value is "max", approve maximum possible amount
      const amount = params.value === "max" 
        ? ethers.MaxUint256 
        : ethers.parseUnits(params.value || "0", decimals);
      
      const tx = await tokenContract.approve(params.to, amount, {
        gasLimit: params.gasLimit ? ethers.parseUnits(params.gasLimit, "wei") : undefined,
        gasPrice: params.gasPrice ? ethers.parseUnits(params.gasPrice, "gwei") : undefined,
      });

      results.push({
        walletAddress: wallet.address,
        success: true,
        txHash: tx.hash,
      });
    } catch (error) {
      console.error(`Error approving tokens from wallet:`, error);
      results.push({
        walletAddress: new Wallet(privateKey).address,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Executes a custom transaction from multiple wallets (for swaps or other complex operations)
 * @param privateKeys Array of private keys
 * @param params Transaction parameters including custom data
 * @param rpcUrl The RPC URL for the network
 * @param onProgress Optional callback for progress updates
 * @returns Array of operation results
 */
export async function bulkCustomTransaction(
  privateKeys: string[],
  params: TransactionParams,
  rpcUrl: string,
  onProgress?: ProgressCallback
): Promise<BulkOperationResult[]> {
  const provider = createProvider(rpcUrl);
  const results: BulkOperationResult[] = [];
  const total = privateKeys.length;

  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    
    // Update progress
    if (onProgress) {
      onProgress(i + 1, total);
    }
    try {
      const wallet = new Wallet(privateKey, provider);
      
      const tx = await wallet.sendTransaction({
        to: params.to,
        value: params.value ? ethers.parseEther(params.value) : undefined,
        data: params.data,
        gasLimit: params.gasLimit ? ethers.parseUnits(params.gasLimit, "wei") : undefined,
        gasPrice: params.gasPrice ? ethers.parseUnits(params.gasPrice, "gwei") : undefined,
      });

      results.push({
        walletAddress: wallet.address,
        success: true,
        txHash: tx.hash,
      });
    } catch (error) {
      console.error(`Error executing custom transaction from wallet:`, error);
      results.push({
        walletAddress: new Wallet(privateKey).address,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Gets the balance of native tokens (ETH, BNB, etc.) for a wallet
 * @param address The wallet address
 * @param rpcUrl The RPC URL for the network
 * @returns The balance in ETH as a string
 */
export async function getNativeBalance(address: string, rpcUrl: string): Promise<string> {
  const provider = createProvider(rpcUrl);
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

/**
 * Gets the balance of an ERC20 token for a wallet
 * @param address The wallet address
 * @param tokenAddress The token contract address
 * @param rpcUrl The RPC URL for the network
 * @returns The token balance as a string
 */
export async function getTokenBalance(
  address: string,
  tokenAddress: string,
  rpcUrl: string
): Promise<string> {
  const provider = createProvider(rpcUrl);
  const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
  
  const decimals = await tokenContract.decimals();
  const balance = await tokenContract.balanceOf(address);
  
  return ethers.formatUnits(balance, decimals);
}

/**
 * Gets the transaction count for a wallet address
 * @param address The wallet address
 * @param rpcUrl The RPC URL for the network
 * @returns The transaction count as a number
 */
export async function getTransactionCount(
  address: string,
  rpcUrl: string
): Promise<number> {
  const provider = createProvider(rpcUrl);
  const txCount = await provider.getTransactionCount(address);
  return txCount;
}

/**
 * Checks native token balances for multiple wallets in bulk
 * @param addresses Array of wallet addresses
 * @param rpcUrl The RPC URL for the network
 * @param onProgress Optional callback for progress updates
 * @returns Array of operation results with wallet addresses, balances, and transaction counts
 */
export async function bulkCheckNativeBalance(
  addresses: string[],
  rpcUrl: string,
  onProgress?: ProgressCallback
): Promise<BulkOperationResult[]> {
  const provider = createProvider(rpcUrl);
  const results: BulkOperationResult[] = [];
  const total = addresses.length;

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    
    // Update progress
    if (onProgress) {
      onProgress(i + 1, total);
    }
    try {
      // Get balance and transaction count in parallel
      const [balance, txCount] = await Promise.all([
        provider.getBalance(address),
        provider.getTransactionCount(address)
      ]);
      
      results.push({
        walletAddress: address,
        success: true,
        balance: ethers.formatEther(balance),
        txCount: txCount
      });
    } catch (error) {
      console.error(`Error checking wallet data:`, error);
      results.push({
        walletAddress: address,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Checks token balances for multiple wallets in bulk
 * @param addresses Array of wallet addresses
 * @param tokenAddress The token contract address
 * @param rpcUrl The RPC URL for the network
 * @param onProgress Optional callback for progress updates
 * @returns Array of operation results with wallet addresses and token balances
 */
export async function bulkCheckTokenBalance(
  addresses: string[],
  tokenAddress: string,
  rpcUrl: string,
  onProgress?: ProgressCallback
): Promise<BulkOperationResult[]> {
  const provider = createProvider(rpcUrl);
  const results: BulkOperationResult[] = [];
  const total = addresses.length;

  try {
    // Initialize token contract
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
    
    // Get token metadata
    const [symbol, decimals] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.decimals()
    ]);

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      
      // Update progress
      if (onProgress) {
        onProgress(i + 1, total);
      }
      
      try {
        // Get token balance and transaction count in parallel
        const [balance, txCount] = await Promise.all([
          tokenContract.balanceOf(address),
          provider.getTransactionCount(address)
        ]);
        
        results.push({
          walletAddress: address,
          success: true,
          balance: ethers.formatUnits(balance, decimals),
          txCount: txCount,
          tokenSymbol: symbol,
          tokenDecimals: decimals
        });
      } catch (error) {
        console.error(`Error checking token balance for wallet:`, error);
        results.push({
          walletAddress: address,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    console.error(`Error initializing token contract:`, error);
    // If token contract initialization fails, mark all addresses as failed
    for (const address of addresses) {
      results.push({
        walletAddress: address,
        success: false,
        error: `Token contract error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return results;
}
