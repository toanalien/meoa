import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bestHttpsRpcs, looksLikeEmbeddedApiKey, type ChainlistChain } from "../src/utils/rpcPool";

const CHAIN_IDS = [1, 11155111, 56, 137, 42161, 10];
const PROBE_TIMEOUT_MS = 5000;
const PROBE_CONCURRENCY = 8;
const CANDIDATE_LIMIT = 1000;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(scriptDir, "../src/utils/builtinChainRecords.json");

function parseChainId(result: unknown): number | null {
  if (typeof result === "number" && Number.isFinite(result)) return result;
  if (typeof result === "string" && /^0x[0-9a-fA-F]+$/.test(result)) return Number(BigInt(result));
  if (typeof result === "string" && /^\d+$/.test(result)) return Number(result);
  return null;
}

async function probe(url: string, chainId: number): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      signal: controller.signal,
    });
    const body = (await response.json()) as { result?: unknown };
    if (parseChainId(body.result) !== chainId) return null;
    return Date.now() - started;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function mapPool<T, R>(items: readonly T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const loop = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: limit }, () => loop()));
  return results;
}

async function main() {
  const response = await fetch("https://chainlist.org/rpcs.json");
  if (!response.ok) {
    throw new Error(`chainlist HTTP ${response.status}`);
  }
  const data = (await response.json()) as ChainlistChain[];
  const selected = [];

  for (const chainId of CHAIN_IDS) {
    const chain = data.find((entry) => entry.chainId === chainId);
    if (!chain) throw new Error(`missing chain ${chainId}`);
    const candidates = bestHttpsRpcs(chain, CANDIDATE_LIMIT).filter((url) => !looksLikeEmbeddedApiKey(url));
    const probed = await mapPool(candidates, PROBE_CONCURRENCY, async (url) => ({
      url,
      latencyMs: await probe(url, chainId),
    }));
    const winners = probed
      .filter((entry): entry is { url: string; latencyMs: number } => entry.latencyMs !== null)
      .sort((a, b) => a.latencyMs - b.latencyMs)
      .slice(0, 10);
    if (winners.length < 2) {
      throw new Error(`only ${winners.length} working RPCs for chain ${chainId}`);
    }
    console.log(
      `chain ${chainId}: ${winners.length} of ${candidates.length} candidates`,
      winners.map((entry) => `${entry.latencyMs}ms ${entry.url}`).join(" | ")
    );
    selected.push({
      chainId,
      name: chain.name,
      rpc: winners.map((entry) => ({ url: entry.url })),
    });
  }

  await writeFile(outputPath, `${JSON.stringify(selected, null, 2)}\n`);
  console.log(`wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
