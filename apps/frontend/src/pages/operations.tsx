import React from "react";
import AppLayout from "@/components/AppLayout";
import { TAB_KEYS } from "@/utils/tabRoutes";

export default function OperationsPage() {
  return <AppLayout activeTab={TAB_KEYS.operations} />;
}
