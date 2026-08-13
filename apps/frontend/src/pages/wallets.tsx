import React from "react";
import AppLayout from "@/components/AppLayout";
import { TAB_KEYS } from "@/utils/tabRoutes";

export default function WalletsPage() {
  return <AppLayout activeTab={TAB_KEYS.wallets} />;
}
