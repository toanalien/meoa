import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ethers } from "ethers";
import {
  bulkApproveToken,
  bulkCheckNativeBalance,
  bulkCheckTokenBalance,
  bulkCustomTransaction,
  bulkSend,
  bulkTransferToken,
  getNativeBalance,
  USDT_ADDRESSES,
  usdtAddressForChain,
} from "./blockchainUtils";
import { BUILTIN_NETWORKS, joinRpcUrls, txExplorerUrl } from "./builtinNetworks";
import {
  createRpcRotator,
  openRpcPool,
  parseRpcList,
  bestHttpsRpcs,
  usableHttpsRpcs,
  type JsonRpcTransport,
} from "./rpcPool";

const ENDPOINTS = ["https://a.example/rpc", "https://b.example/rpc"];
const RPC_INPUT = " https://a.example/rpc , https://b.example/rpc,,";
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const RECIPIENT = "0x0000000000000000000000000000000000000001";
const TOKEN = "0x00000000000000000000000000000000000000aa";
const TX_HASH = `0x${"ab".repeat(32)}`;

const tokenInterface = new ethers.Interface([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
]);

function jsonResult(result: string) {
  return { status: 200, body: { jsonrpc: "2.0", id: 1, result } };
}

function tokenCallResult(data: string) {
  if (data.startsWith("0x313ce567")) {
    return jsonResult(tokenInterface.encodeFunctionResult("decimals", [18]));
  }
  if (data.startsWith("0x95d89b41")) {
    return jsonResult(tokenInterface.encodeFunctionResult("symbol", ["USDT"]));
  }
  if (data.startsWith("0x70a08231")) {
    return jsonResult(tokenInterface.encodeFunctionResult("balanceOf", [ethers.parseUnits("1", 18)]));
  }
  return {
    status: 200,
    body: { error: { code: -32601, message: `unexpected eth_call ${data.slice(0, 10)}` } },
  };
}

function successTransport(hits: string[]): JsonRpcTransport {
  return async (url, request) => {
    hits.push(url);
    switch (request.method) {
      case "eth_chainId":
        return jsonResult("0x1");
      case "eth_getTransactionCount":
        return jsonResult("0x3");
      case "eth_gasPrice":
        return jsonResult("0x3b9aca00");
      case "eth_estimateGas":
        return jsonResult("0x5208");
      case "eth_sendRawTransaction":
        return jsonResult(TX_HASH);
      case "eth_getBalance":
        return jsonResult("0xde0b6b3a7640000");
      case "eth_call":
        return tokenCallResult((request.params[0] as { data: string }).data);
      default:
        return { status: 500, body: { error: { message: `unexpected ${request.method}` } } };
    }
  };
}

function assertRoundRobin(hits: string[], endpoints: string[]) {
  assert.ok(hits.length >= endpoints.length, `expected at least ${endpoints.length} calls, got ${hits.length}`);
  hits.forEach((url, index) => {
    assert.equal(url, endpoints[index % endpoints.length], `call ${index} used ${url}`);
  });
}

describe("parseRpcList", () => {
  test("splits, trims, and drops empty pieces", () => {
    assert.deepEqual(parseRpcList(RPC_INPUT), ENDPOINTS);
    assert.deepEqual(parseRpcList("https://only.example/rpc"), ["https://only.example/rpc"]);
  });

  test("round-trips the joined default list", () => {
    assert.deepEqual(parseRpcList(joinRpcUrls(parseRpcList(RPC_INPUT))), ENDPOINTS);
    for (const network of BUILTIN_NETWORKS) {
      assert.deepEqual(parseRpcList(joinRpcUrls(network.rpcUrls)), network.rpcUrls);
      for (const url of network.rpcUrls) {
        assert.equal(url.includes(","), false);
      }
    }
  });
});

describe("rpc rotator", () => {
  test("successive calls walk endpoints in round-robin order", async () => {
    const hits: string[] = [];
    const endpoints = ["https://a.example/rpc", "https://b.example/rpc", "https://c.example/rpc"];
    const rotator = createRpcRotator(endpoints, async (url) => {
      hits.push(url);
      return jsonResult("0x1");
    });
    for (let i = 0; i < 7; i++) {
      assert.equal(await rotator.call("eth_chainId", []), "0x1");
    }
    assert.deepEqual(
      hits,
      Array.from({ length: 7 }, (_, index) => endpoints[index % endpoints.length])
    );
  });

  test("one URL stays one URL", async () => {
    const hits: string[] = [];
    const rotator = createRpcRotator(["https://only.example/rpc"], async (url) => {
      hits.push(url);
      return jsonResult("0x1");
    });
    await rotator.call("eth_blockNumber", []);
    await rotator.call("eth_blockNumber", []);
    assert.deepEqual(hits, ["https://only.example/rpc", "https://only.example/rpc"]);
  });

  test("HTTP 429 fails over to the next URL and returns its success", async () => {
    const hits: string[] = [];
    const rotator = createRpcRotator(ENDPOINTS, async (url) => {
      hits.push(url);
      if (url === ENDPOINTS[0]) return { status: 429, body: "Too Many Requests" };
      return jsonResult("0x11");
    });
    assert.equal(await rotator.call("eth_blockNumber", []), "0x11");
    assert.deepEqual(hits, ENDPOINTS);
  });

  test("JSON-RPC rate-limit message fails over to the next URL", async () => {
    const hits: string[] = [];
    const rotator = createRpcRotator(ENDPOINTS, async (url) => {
      hits.push(url);
      if (url === ENDPOINTS[0]) {
        return {
          status: 200,
          body: { error: { code: -32005, message: "project rate limit exceeded" } },
        };
      }
      return jsonResult("0x22");
    });
    assert.equal(await rotator.call("eth_blockNumber", []), "0x22");
    assert.deepEqual(hits, ENDPOINTS);
  });

  test("transport failure fails over to the next URL", async () => {
    const hits: string[] = [];
    const rotator = createRpcRotator(ENDPOINTS, async (url) => {
      hits.push(url);
      if (url === ENDPOINTS[0]) throw new Error("connect ECONNREFUSED");
      return jsonResult("0x33");
    });
    assert.equal(await rotator.call("eth_blockNumber", []), "0x33");
    assert.deepEqual(hits, ENDPOINTS);
  });

  test("every URL failing is a failure", async () => {
    for (const fail of [
      async () => ({ status: 429, body: { error: { message: "rate limit exceeded" } } }),
      async () => {
        throw new Error("socket hang up");
      },
    ] as JsonRpcTransport[]) {
      const hits: string[] = [];
      const rotator = createRpcRotator(ENDPOINTS, async (url, request) => {
        hits.push(url);
        return fail(url, request);
      });
      await assert.rejects(() => rotator.call("eth_chainId", []), /rate limit|socket hang up/i);
      assert.deepEqual(hits, ENDPOINTS);
    }
  });

  test("quota, disabled API key, unknown token, 403, and empty JSON-RPC errors fail over", async () => {
    const failures = [
      {
        status: 200,
        body: {
          error: {
            message:
              "You've reached the usage limit for your current plan. To continue with higher limits and uninterrupted access, please upgrade here: https://www.1rpc.io/#pricing",
          },
        },
      },
      {
        status: 403,
        body: {
          error: {
            code: -32051,
            message: "API key disabled, json-rpc code: -32051, rest code: 403",
          },
        },
      },
      { status: 200, body: { error: { code: -32051, message: "API key disabled" } } },
      { status: 200, body: { error: { message: "Unknown token" } } },
      { status: 403, body: "Forbidden" },
      { status: 200, body: { error: {} } },
    ];
    for (const failure of failures) {
      const hits: string[] = [];
      const rotator = createRpcRotator(ENDPOINTS, async (url) => {
        hits.push(url);
        if (url === ENDPOINTS[0]) return failure;
        return jsonResult("0x44");
      });
      assert.equal(await rotator.call("eth_blockNumber", []), "0x44");
      assert.deepEqual(hits, ENDPOINTS);
    }
  });

  test("a non-rate-limit JSON-RPC error is not retried", async () => {
    const hits: string[] = [];
    const rotator = createRpcRotator(ENDPOINTS, async (url) => {
      hits.push(url);
      return { status: 200, body: { error: { code: 3, message: "execution reverted" } } };
    });
    await assert.rejects(() => rotator.call("eth_call", []), /execution reverted/);
    assert.deepEqual(hits, [ENDPOINTS[0]]);
  });

  test("openRpcPool uses the parsed comma-separated list", () => {
    assert.deepEqual([...openRpcPool(RPC_INPUT, async () => jsonResult("0x0")).endpoints], ENDPOINTS);
    assert.throws(() => openRpcPool(" , ,"), /No RPC endpoints configured/);
  });
});

describe("chainlist https filter", () => {
  test("keeps placeholder-free https urls from strings and objects", () => {
    const selected = usableHttpsRpcs({
      chainId: 1,
      rpc: [
        "https://a.example/rpc",
        { url: "https://b.example/rpc" },
        "wss://a.example/ws",
        "http://insecure.example/rpc",
        "https://mainnet.infura.io/v3/${INFURA_API_KEY}",
        { url: "https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}" },
        { url: "  https://c.example/rpc  " },
      ],
    });
    assert.deepEqual(selected, [
      "https://a.example/rpc",
      "https://b.example/rpc",
      "https://c.example/rpc",
    ]);
    assert.ok(selected.length > 1);
  });

  test("best defaults keep at most 10 public endpoints and skip embedded API keys", () => {
    const chain = {
      chainId: 1,
      rpc: [
        { url: "https://eth.example/v1/0123456789abcdef0123456789abcdef" },
        "wss://eth.example/ws",
        "https://rpc.example/secret/${API_KEY}",
        { url: "https://a.example/rpc" },
        { url: "https://b.example/rpc" },
        { url: "https://c.example/rpc" },
        { url: "https://d.example/rpc" },
        { url: "https://e.example/rpc" },
        { url: "https://f.example/rpc" },
        { url: "https://g.example/rpc" },
        { url: "https://h.example/rpc" },
        { url: "https://i.example/rpc" },
        { url: "https://j.example/rpc" },
        { url: "https://k.example/rpc" },
      ],
    };
    assert.deepEqual(bestHttpsRpcs(chain), [
      "https://a.example/rpc",
      "https://b.example/rpc",
      "https://c.example/rpc",
      "https://d.example/rpc",
      "https://e.example/rpc",
      "https://f.example/rpc",
      "https://g.example/rpc",
      "https://h.example/rpc",
      "https://i.example/rpc",
      "https://j.example/rpc",
    ]);
  });

  test("built-in defaults are the 10 best public endpoints for the six chain ids", () => {
    assert.deepEqual(
      BUILTIN_NETWORKS.map((network) => network.chainId),
      [1, 11155111, 56, 137, 42161, 10]
    );
    assert.deepEqual(
      BUILTIN_NETWORKS.map((network) => network.name),
      [
        "Ethereum Mainnet",
        "Ethereum Sepolia",
        "BSC Mainnet",
        "Polygon Mainnet",
        "Arbitrum One",
        "Optimism",
      ]
    );
    for (const network of BUILTIN_NETWORKS) {
      assert.deepEqual(network.rpcUrls, bestHttpsRpcs(network.chain));
      assert.ok(network.rpcUrls.length > 1, `${network.chainId} should have more than one https rpc`);
      assert.ok(network.rpcUrls.length <= 10, `${network.chainId} should keep at most 10 rpcs`);
      for (const url of network.rpcUrls) {
        assert.equal(url.toLowerCase().startsWith("https://"), true);
        assert.equal(url.includes("${"), false);
        assert.equal(url.toLowerCase().startsWith("wss://"), false);
      }
    }
  });
});

describe("operations bulk actions", () => {
  test("native balance check round-robins and failsover", async () => {
    const roundRobinHits: string[] = [];
    const roundRobin = await bulkCheckNativeBalance(
      [RECIPIENT, "0x0000000000000000000000000000000000000002"],
      RPC_INPUT,
      undefined,
      successTransport(roundRobinHits)
    );
    assert.equal(roundRobin.length, 2);
    assert.equal(roundRobin[0].success, true);
    assert.equal(roundRobin[0].balance, "1.0");
    assert.equal(roundRobin[0].txCount, 3);
    assert.equal(roundRobin[1].success, true);
    assertRoundRobin(roundRobinHits, ENDPOINTS);

    const failoverHits: string[] = [];
    const failover = await bulkCheckNativeBalance(
      [RECIPIENT],
      RPC_INPUT,
      undefined,
      async (url, request) => {
        failoverHits.push(url);
        if (url === ENDPOINTS[0]) throw new Error("connect ECONNREFUSED");
        if (request.method === "eth_getBalance") return jsonResult("0x0");
        if (request.method === "eth_getTransactionCount") return jsonResult("0x2");
        return { status: 500, body: { error: { message: request.method } } };
      }
    );
    assert.equal(failover[0].success, true);
    assert.equal(failover[0].balance, "0.0");
    assert.equal(failover[0].txCount, 2);
    assert.equal(failoverHits[0], ENDPOINTS[0]);
    assert.ok(failoverHits.includes(ENDPOINTS[1]));

    const quotaHits: string[] = [];
    const quota = await bulkCheckNativeBalance([RECIPIENT], RPC_INPUT, undefined, async (url, request) => {
      quotaHits.push(url);
      if (url === ENDPOINTS[0]) {
        return {
          status: 403,
          body: {
            error: {
              code: -32051,
              message:
                "You've reached the usage limit for your current plan. To continue with higher limits and uninterrupted access, please upgrade here: https://www.1rpc.io/#pricing",
            },
          },
        };
      }
      if (request.method === "eth_getBalance") return jsonResult("0xde0b6b3a7640000");
      if (request.method === "eth_getTransactionCount") return jsonResult("0x4");
      return { status: 500, body: { error: { message: request.method } } };
    });
    assert.equal(quota[0].success, true);
    assert.equal(quota[0].error, undefined);
    assert.equal(quota[0].balance, "1.0");
    assert.ok(quotaHits.includes(ENDPOINTS[0]));
    assert.ok(quotaHits.includes(ENDPOINTS[1]));

    const exhaustedHits: string[] = [];
    const exhausted = await bulkCheckNativeBalance(
      [RECIPIENT],
      RPC_INPUT,
      undefined,
      async (url) => {
        exhaustedHits.push(url);
        return { status: 429, body: { error: { message: "rate limit exceeded" } } };
      }
    );
    assert.equal(exhausted[0].success, false);
    assert.match(exhausted[0].error ?? "", /rate limit exceeded/);
    assert.ok(exhaustedHits.includes(ENDPOINTS[0]));
    assert.ok(exhaustedHits.includes(ENDPOINTS[1]));
  });

  test("check progress lists the addresses currently in flight", async () => {
    const addresses = [
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000002",
    ];
    const snapshots: string[][] = [];
    await bulkCheckNativeBalance(
      addresses,
      "https://a.example/rpc, https://b.example/rpc",
      (_current, _total, active) => {
        snapshots.push([...(active ?? [])]);
      },
      async (_url, request) => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        if (request.method === "eth_getBalance") return jsonResult("0x0");
        return jsonResult("0x1");
      }
    );
    assert.ok(
      snapshots.some(
        (active) => active.includes(addresses[0]) && active.includes(addresses[1])
      )
    );
    assert.deepEqual(snapshots[snapshots.length - 1], []);
  });

  test("a finished address is replaced by the next one immediately", async () => {
    const addresses = Array.from({ length: 11 }, (_, index) =>
      `0x${(index + 1).toString(16).padStart(40, "0")}`
    );
    const fast = addresses[9];
    const next = addresses[10];
    let held = 0;
    const release: Array<() => void> = [];
    let nextStartedWhileOthersHeld = false;

    const results = await bulkCheckNativeBalance(
      addresses,
      "https://a.example/rpc, https://b.example/rpc",
      undefined,
      async (_url, request) => {
        if (request.method === "eth_getBalance") {
          const address = (request.params as string[])[0];
          if (address === next) {
            nextStartedWhileOthersHeld = held > 0;
            release.splice(0).forEach((unlock) => unlock());
          } else if (address !== fast) {
            held += 1;
            await new Promise<void>((resolve) => {
              release.push(() => {
                held -= 1;
                resolve();
              });
            });
          }
          return jsonResult("0x0");
        }
        return jsonResult("0x1");
      }
    );

    assert.equal(nextStartedWhileOthersHeld, true);
    assert.equal(results.length, addresses.length);
    assert.ok(results.every((result) => result.success));
    assert.deepEqual(
      results.map((result) => result.walletAddress),
      addresses
    );
  });

  test("several rpcs check 10 addresses at a time and keep order", async () => {
    const addresses = Array.from({ length: 12 }, (_, index) =>
      `0x${(index + 1).toString(16).padStart(40, "0")}`
    );
    let inflight = 0;
    let maxInflight = 0;
    const multi = await bulkCheckNativeBalance(
      addresses,
      "https://a.example/rpc, https://b.example/rpc",
      undefined,
      async (_url, request) => {
        inflight += 1;
        maxInflight = Math.max(maxInflight, inflight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inflight -= 1;
        if (request.method === "eth_getBalance") return jsonResult("0x0");
        if (request.method === "eth_getTransactionCount") return jsonResult("0x1");
        return { status: 500, body: { error: { message: request.method } } };
      }
    );
    assert.equal(multi.length, addresses.length);
    assert.deepEqual(
      multi.map((result) => result.walletAddress),
      addresses
    );
    assert.ok(multi.every((result) => result.success));
    assert.equal(maxInflight, 20);

    inflight = 0;
    maxInflight = 0;
    await bulkCheckNativeBalance(
      addresses.slice(0, 3),
      "https://only.example/rpc",
      undefined,
      async (_url, request) => {
        inflight += 1;
        maxInflight = Math.max(maxInflight, inflight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inflight -= 1;
        if (request.method === "eth_getBalance") return jsonResult("0x0");
        return jsonResult("0x1");
      }
    );
    assert.equal(maxInflight, 2);

    inflight = 0;
    maxInflight = 0;
    const tokens = await bulkCheckTokenBalance(
      addresses,
      TOKEN,
      "https://a.example/rpc, https://b.example/rpc",
      undefined,
      async (_url, request) => {
        inflight += 1;
        maxInflight = Math.max(maxInflight, inflight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inflight -= 1;
        if (request.method === "eth_call") {
          return tokenCallResult((request.params[0] as { data: string }).data);
        }
        if (request.method === "eth_getTransactionCount") return jsonResult("0x1");
        return { status: 500, body: { error: { message: request.method } } };
      }
    );
    assert.equal(tokens.length, addresses.length);
    assert.ok(tokens.every((result) => result.success && result.tokenSymbol === "USDT"));
    assert.equal(maxInflight, 20);
  });

  test("getNativeBalance uses the same failover", async () => {
    const hits: string[] = [];
    const balance = await getNativeBalance(
      RECIPIENT,
      RPC_INPUT,
      async (url) => {
        hits.push(url);
        if (url === ENDPOINTS[0]) {
          return { status: 200, body: { error: { message: "rate limit exceeded" } } };
        }
        return jsonResult("0xde0b6b3a7640000");
      }
    );
    assert.equal(balance, "1.0");
    assert.deepEqual(hits, ENDPOINTS);
  });

  test("send, transfer, approve, and custom transaction rotate across the list", async () => {
    const cases = [
      {
        name: "send",
        run: (hits: string[]) =>
          bulkSend(
            [PRIVATE_KEY],
            { to: RECIPIENT, value: "0.1" },
            RPC_INPUT,
            undefined,
            successTransport(hits)
          ),
      },
      {
        name: "transfer",
        run: (hits: string[]) =>
          bulkTransferToken(
            [PRIVATE_KEY],
            { to: RECIPIENT, value: "1", tokenAddress: TOKEN },
            RPC_INPUT,
            undefined,
            successTransport(hits)
          ),
      },
      {
        name: "approve",
        run: (hits: string[]) =>
          bulkApproveToken(
            [PRIVATE_KEY],
            { to: RECIPIENT, value: "max", tokenAddress: TOKEN },
            RPC_INPUT,
            undefined,
            successTransport(hits)
          ),
      },
      {
        name: "custom",
        run: (hits: string[]) =>
          bulkCustomTransaction(
            [PRIVATE_KEY],
            { to: RECIPIENT, value: "0.01", data: "0x1234" },
            RPC_INPUT,
            undefined,
            successTransport(hits)
          ),
      },
    ];

    for (const item of cases) {
      const hits: string[] = [];
      const results = await item.run(hits);
      assert.equal(results.length, 1, item.name);
      assert.equal(results[0].success, true, `${item.name}: ${results[0].error}`);
      assert.equal(results[0].txHash, TX_HASH, item.name);
      assertRoundRobin(hits, ENDPOINTS);
    }
  });

  test("token balance check rotates and fails when every URL fails", async () => {
    const hits: string[] = [];
    const results = await bulkCheckTokenBalance(
      [RECIPIENT],
      TOKEN,
      RPC_INPUT,
      undefined,
      successTransport(hits)
    );
    assert.equal(results[0].success, true);
    assert.equal(results[0].balance, "1.0");
    assert.equal(results[0].tokenSymbol, "USDT");
    assert.equal(results[0].tokenDecimals, 18);
    assert.equal(results[0].txCount, 3);
    assertRoundRobin(hits, ENDPOINTS);

    const failed = await bulkCheckTokenBalance([RECIPIENT], TOKEN, RPC_INPUT, undefined, async () => {
      throw new Error("network down");
    });
    assert.equal(failed[0].success, false);
    assert.match(failed[0].error ?? "", /network down/);
  });

  test("USDT defaults stay attached to chain ids", () => {
    assert.equal(usdtAddressForChain(1), USDT_ADDRESSES.ETHEREUM);
    assert.equal(usdtAddressForChain(11155111), USDT_ADDRESSES.ETHEREUM);
    assert.equal(usdtAddressForChain(56), USDT_ADDRESSES.BSC);
    assert.equal(usdtAddressForChain(137), USDT_ADDRESSES.POLYGON);
    assert.equal(usdtAddressForChain(42161), USDT_ADDRESSES.ARBITRUM);
    assert.equal(usdtAddressForChain(10), USDT_ADDRESSES.OPTIMISM);
    assert.equal(txExplorerUrl(1, "0xabc"), "https://etherscan.io/tx/0xabc");
    assert.equal(txExplorerUrl(11155111, "0xabc"), "https://sepolia.etherscan.io/tx/0xabc");
    assert.equal(txExplorerUrl(56, "0xabc"), "https://bscscan.com/tx/0xabc");
    assert.equal(txExplorerUrl(137, "0xabc"), "https://polygonscan.com/tx/0xabc");
    assert.equal(txExplorerUrl(42161, "0xabc"), "https://arbiscan.io/tx/0xabc");
    assert.equal(txExplorerUrl(10, "0xabc"), "https://optimistic.etherscan.io/tx/0xabc");
    assert.equal(txExplorerUrl(undefined, "0xabc"), "https://etherscan.io/tx/0xabc");
  });
});
