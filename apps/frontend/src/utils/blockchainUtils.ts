import { ethers } from "ethers";
import { JsonRpcTransport, openRpcPool, RpcRotator } from "./rpcPool";

// USDT contract addresses for different networks
export const USDT_ADDRESSES = {
  ETHEREUM: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  BSC: "0x55d398326f99059ff775485246999027b3197955", // BSC USDT (BUSD)
  POLYGON: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
  ARBITRUM: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
  OPTIMISM: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
};

/** USDT address for a built-in chain. Sepolia keeps the Ethereum USDT default. */
export function usdtAddressForChain(chainId?: number): string {
  switch (chainId) {
    case 56:
      return USDT_ADDRESSES.BSC;
    case 137:
      return USDT_ADDRESSES.POLYGON;
    case 42161:
      return USDT_ADDRESSES.ARBITRUM;
    case 10:
      return USDT_ADDRESSES.OPTIMISM;
    default:
      return USDT_ADDRESSES.ETHEREUM;
  }
}

/**
 * Returns the Blockscan URL for a wallet address
 * @param address The wallet address
 * @returns The Blockscan URL for the address
 */
export function getExplorerUrl(address: string): string {
  return `https://blockscan.com/address/${address}`;
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

const erc20 = new ethers.Interface(ERC20_ABI);

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
export type ProgressCallback = (
  current: number,
  total: number,
  activeAddresses?: readonly string[]
) => void;

/**
 * Creates a provider for the specified network
 * @param rpcUrl The RPC URL for the network
 * @returns An ethers provider
 */
export function createProvider(rpcUrl: string) {
  return new ethers.JsonRpcProvider(rpcUrl);
}

async function rpcHex(pool: RpcRotator, method: string, params: unknown[]): Promise<string> {
  const result = await pool.call(method, params);
  if (typeof result !== "string") {
    throw new Error(`${method} returned an unexpected result`);
  }
  return result;
}

async function readContract(
  pool: RpcRotator,
  tokenAddress: string,
  fragment: string,
  args: unknown[] = []
): Promise<ethers.Result> {
  const data = erc20.encodeFunctionData(fragment, args);
  const raw = await rpcHex(pool, "eth_call", [{ to: tokenAddress, data }, "latest"]);
  return erc20.decodeFunctionResult(fragment, raw);
}

function txFeeFields(params: TransactionParams): { gasLimit?: bigint; gasPrice?: bigint } {
  return {
    gasLimit: params.gasLimit ? ethers.parseUnits(params.gasLimit, "wei") : undefined,
    gasPrice: params.gasPrice ? ethers.parseUnits(params.gasPrice, "gwei") : undefined,
  };
}

async function resolveChainId(pool: RpcRotator): Promise<number> {
  return Number(BigInt(await rpcHex(pool, "eth_chainId", [])));
}

async function broadcastTransaction(
  pool: RpcRotator,
  privateKey: string,
  chainId: number,
  fields: {
    to: string;
    value?: bigint;
    data?: string;
    gasLimit?: bigint;
    gasPrice?: bigint;
  }
): Promise<{ walletAddress: string; txHash: string }> {
  const wallet = new ethers.Wallet(privateKey);
  const data = fields.data ?? "0x";
  const value = fields.value ?? BigInt(0);
  const nonce = Number(
    BigInt(await rpcHex(pool, "eth_getTransactionCount", [wallet.address, "pending"]))
  );
  const gasPrice = fields.gasPrice ?? BigInt(await rpcHex(pool, "eth_gasPrice", []));
  const gasLimit =
    fields.gasLimit ??
    BigInt(
      await rpcHex(pool, "eth_estimateGas", [
        {
          from: wallet.address,
          to: fields.to,
          value: ethers.toQuantity(value),
          data,
        },
      ])
    );
  const signed = await wallet.signTransaction({
    type: 0,
    chainId,
    nonce,
    gasPrice,
    gasLimit,
    to: fields.to,
    value,
    data,
  });
  const txHash = await rpcHex(pool, "eth_sendRawTransaction", [signed]);
  return { walletAddress: wallet.address, txHash };
}

function failedWallet(privateKey: string, error: unknown): BulkOperationResult {
  return {
    walletAddress: new ethers.Wallet(privateKey).address,
    success: false,
    error: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Sends native tokens (ETH, BNB, etc.) from multiple wallets.
 * `rpcUrl` may be one URL or several separated by commas.
 */
export async function bulkSend(
  privateKeys: string[],
  params: TransactionParams,
  rpcUrl: string,
  onProgress?: ProgressCallback,
  transport?: JsonRpcTransport
): Promise<BulkOperationResult[]> {
  const pool = openRpcPool(rpcUrl, transport);
  const results: BulkOperationResult[] = [];
  const total = privateKeys.length;
  let chainId: number | undefined;

  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    if (onProgress) onProgress(i + 1, total);
    try {
      if (chainId === undefined) chainId = await resolveChainId(pool);
      const sent = await broadcastTransaction(pool, privateKey, chainId, {
        to: params.to,
        value: params.value ? ethers.parseEther(params.value) : undefined,
        ...txFeeFields(params),
      });
      results.push({
        walletAddress: sent.walletAddress,
        success: true,
        txHash: sent.txHash,
      });
    } catch (error) {
      console.error(`Error sending from wallet:`, error);
      results.push(failedWallet(privateKey, error));
    }
  }

  return results;
}

/**
 * Transfers ERC20 tokens from multiple wallets.
 * `rpcUrl` may be one URL or several separated by commas.
 */
export async function bulkTransferToken(
  privateKeys: string[],
  params: TransactionParams,
  rpcUrl: string,
  onProgress?: ProgressCallback,
  transport?: JsonRpcTransport
): Promise<BulkOperationResult[]> {
  if (!params.tokenAddress) {
    throw new Error("Token address is required for token transfers");
  }

  const pool = openRpcPool(rpcUrl, transport);
  const results: BulkOperationResult[] = [];
  const total = privateKeys.length;
  let chainId: number | undefined;

  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    if (onProgress) onProgress(i + 1, total);
    try {
      const decimals = Number((await readContract(pool, params.tokenAddress, "decimals"))[0]);
      const amount = ethers.parseUnits(params.value || "0", decimals);
      const data = erc20.encodeFunctionData("transfer", [params.to, amount]);
      if (chainId === undefined) chainId = await resolveChainId(pool);
      const sent = await broadcastTransaction(pool, privateKey, chainId, {
        to: params.tokenAddress,
        data,
        value: BigInt(0),
        ...txFeeFields(params),
      });
      results.push({
        walletAddress: sent.walletAddress,
        success: true,
        txHash: sent.txHash,
      });
    } catch (error) {
      console.error(`Error transferring tokens from wallet:`, error);
      results.push(failedWallet(privateKey, error));
    }
  }

  return results;
}

/**
 * Approves ERC20 tokens for spending from multiple wallets.
 * `rpcUrl` may be one URL or several separated by commas.
 */
export async function bulkApproveToken(
  privateKeys: string[],
  params: TransactionParams,
  rpcUrl: string,
  onProgress?: ProgressCallback,
  transport?: JsonRpcTransport
): Promise<BulkOperationResult[]> {
  if (!params.tokenAddress) {
    throw new Error("Token address is required for token approvals");
  }

  const pool = openRpcPool(rpcUrl, transport);
  const results: BulkOperationResult[] = [];
  const total = privateKeys.length;
  let chainId: number | undefined;

  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    if (onProgress) onProgress(i + 1, total);
    try {
      const decimals = Number((await readContract(pool, params.tokenAddress, "decimals"))[0]);
      const amount =
        params.value === "max" ? ethers.MaxUint256 : ethers.parseUnits(params.value || "0", decimals);
      const data = erc20.encodeFunctionData("approve", [params.to, amount]);
      if (chainId === undefined) chainId = await resolveChainId(pool);
      const sent = await broadcastTransaction(pool, privateKey, chainId, {
        to: params.tokenAddress,
        data,
        value: BigInt(0),
        ...txFeeFields(params),
      });
      results.push({
        walletAddress: sent.walletAddress,
        success: true,
        txHash: sent.txHash,
      });
    } catch (error) {
      console.error(`Error approving tokens from wallet:`, error);
      results.push(failedWallet(privateKey, error));
    }
  }

  return results;
}

/**
 * Executes a custom transaction from multiple wallets.
 * `rpcUrl` may be one URL or several separated by commas.
 */
export async function bulkCustomTransaction(
  privateKeys: string[],
  params: TransactionParams,
  rpcUrl: string,
  onProgress?: ProgressCallback,
  transport?: JsonRpcTransport
): Promise<BulkOperationResult[]> {
  const pool = openRpcPool(rpcUrl, transport);
  const results: BulkOperationResult[] = [];
  const total = privateKeys.length;
  let chainId: number | undefined;

  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    if (onProgress) onProgress(i + 1, total);
    try {
      if (chainId === undefined) chainId = await resolveChainId(pool);
      const sent = await broadcastTransaction(pool, privateKey, chainId, {
        to: params.to,
        value: params.value ? ethers.parseEther(params.value) : undefined,
        data: params.data,
        ...txFeeFields(params),
      });
      results.push({
        walletAddress: sent.walletAddress,
        success: true,
        txHash: sent.txHash,
      });
    } catch (error) {
      console.error(`Error executing custom transaction from wallet:`, error);
      results.push(failedWallet(privateKey, error));
    }
  }

  return results;
}

/**
 * Gets the balance of native tokens (ETH, BNB, etc.) for a wallet.
 * `rpcUrl` may be one URL or several separated by commas.
 */
export async function getNativeBalance(
  address: string,
  rpcUrl: string,
  transport?: JsonRpcTransport
): Promise<string> {
  const pool = openRpcPool(rpcUrl, transport);
  const balance = await rpcHex(pool, "eth_getBalance", [address, "latest"]);
  return ethers.formatEther(BigInt(balance));
}

/**
 * Gets the balance of an ERC20 token for a wallet.
 * `rpcUrl` may be one URL or several separated by commas.
 */
export async function getTokenBalance(
  address: string,
  tokenAddress: string,
  rpcUrl: string,
  transport?: JsonRpcTransport
): Promise<string> {
  const pool = openRpcPool(rpcUrl, transport);
  const decimals = Number((await readContract(pool, tokenAddress, "decimals"))[0]);
  const balance = (await readContract(pool, tokenAddress, "balanceOf", [address]))[0];
  return ethers.formatUnits(balance, decimals);
}

/**
 * Gets the transaction count for a wallet address.
 * `rpcUrl` may be one URL or several separated by commas.
 */
export async function getTransactionCount(
  address: string,
  rpcUrl: string,
  transport?: JsonRpcTransport
): Promise<number> {
  const pool = openRpcPool(rpcUrl, transport);
  const txCount = await rpcHex(pool, "eth_getTransactionCount", [address, "latest"]);
  return Number(BigInt(txCount));
}

const ADDRESS_CHECK_CONCURRENCY = 10;

function checkConcurrency(endpointCount: number): number {
  return endpointCount > 1 ? ADDRESS_CHECK_CONCURRENCY : 1;
}

async function mapInOrder<T, R>(
  items: readonly T[],
  concurrency: number,
  onProgress: ProgressCallback | undefined,
  worker: (item: T) => Promise<R>,
  label?: (item: T) => string
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let completed = 0;
  let nextIndex = 0;
  const total = items.length;
  const active: string[] = [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const report = () => {
    if (onProgress) onProgress(completed, total, [...active]);
  };

  const runOne = async (index: number) => {
    const item = items[index];
    const name = label?.(item);
    if (name) {
      active.push(name);
      report();
    }
    try {
      results[index] = await worker(item);
    } finally {
      if (name) {
        const found = active.indexOf(name);
        if (found >= 0) active.splice(found, 1);
      }
      completed += 1;
      report();
    }
  };

  const loop = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await runOne(index);
    }
  };

  await Promise.all(Array.from({ length: limit }, () => loop()));
  return results;
}

/**
 * Checks native token balances for multiple wallets in bulk.
 * `rpcUrl` may be one URL or several separated by commas.
 * Several endpoints keep 10 addresses in flight. A finished address is replaced immediately.
 */
export async function bulkCheckNativeBalance(
  addresses: string[],
  rpcUrl: string,
  onProgress?: ProgressCallback,
  transport?: JsonRpcTransport
): Promise<BulkOperationResult[]> {
  const pool = openRpcPool(rpcUrl, transport);
  return mapInOrder(
    addresses,
    checkConcurrency(pool.endpoints.length),
    onProgress,
    async (address) => {
      try {
        const [balance, txCount] = await Promise.all([
          rpcHex(pool, "eth_getBalance", [address, "latest"]),
          rpcHex(pool, "eth_getTransactionCount", [address, "latest"]),
        ]);
        return {
          walletAddress: address,
          success: true,
          balance: ethers.formatEther(BigInt(balance)),
          txCount: Number(BigInt(txCount)),
        };
      } catch (error) {
        console.error(`Error checking wallet data:`, error);
        return {
          walletAddress: address,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    (address) => address
  );
}

/**
 * Checks token balances for multiple wallets in bulk.
 * `rpcUrl` may be one URL or several separated by commas.
 * Several endpoints keep 10 addresses in flight. A finished address is replaced immediately.
 */
export async function bulkCheckTokenBalance(
  addresses: string[],
  tokenAddress: string,
  rpcUrl: string,
  onProgress?: ProgressCallback,
  transport?: JsonRpcTransport
): Promise<BulkOperationResult[]> {
  const pool = openRpcPool(rpcUrl, transport);
  const results: BulkOperationResult[] = [];

  try {
    const [symbolResult, decimalsResult] = await Promise.all([
      readContract(pool, tokenAddress, "symbol"),
      readContract(pool, tokenAddress, "decimals"),
    ]);
    const symbol = String(symbolResult[0]);
    const decimals = Number(decimalsResult[0]);

    return mapInOrder(
      addresses,
      checkConcurrency(pool.endpoints.length),
      onProgress,
      async (address) => {
        try {
          const [balanceResult, txCount] = await Promise.all([
            readContract(pool, tokenAddress, "balanceOf", [address]),
            rpcHex(pool, "eth_getTransactionCount", [address, "latest"]),
          ]);
          return {
            walletAddress: address,
            success: true,
            balance: ethers.formatUnits(balanceResult[0], decimals),
            txCount: Number(BigInt(txCount)),
            tokenSymbol: symbol,
            tokenDecimals: decimals,
          };
        } catch (error) {
          console.error(`Error checking token balance for wallet:`, error);
          return {
            walletAddress: address,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      (address) => address
    );
  } catch (error) {
    console.error(`Error initializing token contract:`, error);
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
