import { ethers, Wallet, Contract } from "ethers";

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
}

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
 * @returns Array of operation results
 */
export async function bulkSend(
  privateKeys: string[],
  params: TransactionParams,
  rpcUrl: string
): Promise<BulkOperationResult[]> {
  const provider = createProvider(rpcUrl);
  const results: BulkOperationResult[] = [];

  for (const privateKey of privateKeys) {
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
 * @returns Array of operation results
 */
export async function bulkTransferToken(
  privateKeys: string[],
  params: TransactionParams,
  rpcUrl: string
): Promise<BulkOperationResult[]> {
  if (!params.tokenAddress) {
    throw new Error("Token address is required for token transfers");
  }

  const provider = createProvider(rpcUrl);
  const results: BulkOperationResult[] = [];

  for (const privateKey of privateKeys) {
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
 * @returns Array of operation results
 */
export async function bulkApproveToken(
  privateKeys: string[],
  params: TransactionParams,
  rpcUrl: string
): Promise<BulkOperationResult[]> {
  if (!params.tokenAddress) {
    throw new Error("Token address is required for token approvals");
  }

  const provider = createProvider(rpcUrl);
  const results: BulkOperationResult[] = [];

  for (const privateKey of privateKeys) {
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
 * @returns Array of operation results
 */
export async function bulkCustomTransaction(
  privateKeys: string[],
  params: TransactionParams,
  rpcUrl: string
): Promise<BulkOperationResult[]> {
  const provider = createProvider(rpcUrl);
  const results: BulkOperationResult[] = [];

  for (const privateKey of privateKeys) {
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
 * Checks native token balances for multiple wallets in bulk
 * @param privateKeys Array of private keys
 * @param rpcUrl The RPC URL for the network
 * @returns Array of operation results with wallet addresses and balances
 */
export async function bulkCheckNativeBalance(
  privateKeys: string[],
  rpcUrl: string
): Promise<BulkOperationResult[]> {
  const provider = createProvider(rpcUrl);
  const results: BulkOperationResult[] = [];

  for (const privateKey of privateKeys) {
    try {
      const wallet = new Wallet(privateKey);
      const address = wallet.address;
      const balance = await provider.getBalance(address);
      
      results.push({
        walletAddress: address,
        success: true,
        balance: ethers.formatEther(balance),
      });
    } catch (error) {
      console.error(`Error checking balance for wallet:`, error);
      results.push({
        walletAddress: new Wallet(privateKey).address,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
