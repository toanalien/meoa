export const TAB_KEYS = {
  wallets: "wallets",
  operations: "operations",
} as const;

export type TabKey = (typeof TAB_KEYS)[keyof typeof TAB_KEYS];

export const TAB_PATHS: Record<TabKey, string> = {
  wallets: "/wallets",
  operations: "/operations",
};

export const TAB_LABELS: Record<TabKey, string> = {
  wallets: "Wallet Management",
  operations: "Bulk Operations",
};

export function isTabKey(value: string): value is TabKey {
  return value === TAB_KEYS.wallets || value === TAB_KEYS.operations;
}
