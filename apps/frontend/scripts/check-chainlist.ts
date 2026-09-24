import { BUILTIN_NETWORKS } from "../src/utils/builtinNetworks";

function urlsOf(rpc: unknown): string[] {
  if (!Array.isArray(rpc)) return [];
  const urls: string[] = [];
  for (const entry of rpc) {
    if (typeof entry === "string") urls.push(entry.trim());
    else if (entry && typeof entry === "object" && typeof (entry as { url?: unknown }).url === "string") {
      urls.push((entry as { url: string }).url.trim());
    }
  }
  return urls;
}

async function main() {
  let response: Response;
  try {
    response = await fetch("https://chainlist.org/rpcs.json");
  } catch (error) {
    console.error("UNREACHABLE", error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
  if (!response.ok) {
    console.error(`UNREACHABLE HTTP ${response.status}`);
    process.exit(2);
  }

  const data = (await response.json()) as Array<{ chainId?: number; rpc?: unknown }>;
  let failed = false;
  for (const network of BUILTIN_NETWORKS) {
    const chain = data.find((entry) => entry.chainId === network.chainId);
    if (!chain) {
      console.error(`MISSING CHAIN ${network.chainId}`);
      failed = true;
      continue;
    }
    const live = new Set(urlsOf(chain.rpc));
    const missing = network.rpcUrls.filter((url) => !live.has(url));
    if (missing.length > 0) {
      console.error(`MISSING URLS ${network.chainId} ${missing.join(" ")}`);
      failed = true;
    } else {
      console.log(`PASS ${network.chainId} ${network.rpcUrls.length}`);
    }
  }
  if (failed) {
    console.error("FAIL");
    process.exit(1);
  }
  console.log("PASS ALL");
}

main().catch((error) => {
  console.error("UNREACHABLE", error instanceof Error ? error.message : String(error));
  process.exit(2);
});
