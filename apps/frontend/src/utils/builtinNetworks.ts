import records from "./builtinChainRecords.json";
import { bestHttpsRpcs, type ChainlistChain } from "./rpcPool";

const DISPLAY_NAMES: Record<number, string> = {
  1: "Ethereum Mainnet",
  11155111: "Ethereum Sepolia",
  56: "BSC Mainnet",
  137: "Polygon Mainnet",
  42161: "Arbitrum One",
  10: "Optimism",
};

const NETWORK_ORDER = [1, 11155111, 56, 137, 42161, 10];

const TX_EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  11155111: "https://sepolia.etherscan.io/tx/",
  56: "https://bscscan.com/tx/",
  137: "https://polygonscan.com/tx/",
  42161: "https://arbiscan.io/tx/",
  10: "https://optimistic.etherscan.io/tx/",
};

export interface BuiltinNetwork {
  chainId: number;
  name: string;
  chain: ChainlistChain;
  rpcUrls: string[];
}

const chains = records as ChainlistChain[];

/**
 * Snapshot of the fastest public HTTPS RPCs from https://chainlist.org/rpcs.json.
 * The app does not refresh this list on its own. Re-run `pnpm refresh:rpcs` to update it.
 */
export const BUILTIN_NETWORKS: BuiltinNetwork[] = NETWORK_ORDER.map((chainId) => {
  const chain = chains.find((entry) => entry.chainId === chainId);
  if (!chain) {
    throw new Error(`Missing bundled Chainlist record for chain ${chainId}`);
  }
  return {
    chainId,
    name: DISPLAY_NAMES[chainId],
    chain,
    rpcUrls: bestHttpsRpcs(chain),
  };
});

export function builtinNetworkById(chainId: number): BuiltinNetwork | undefined {
  return BUILTIN_NETWORKS.find((network) => network.chainId === chainId);
}

export function joinRpcUrls(urls: readonly string[]): string {
  return urls.join(", ");
}

export function txExplorerUrl(chainId: number | undefined, txHash: string): string {
  const base = (chainId !== undefined && TX_EXPLORERS[chainId]) || "https://etherscan.io/tx/";
  return `${base}${txHash}`;
}
