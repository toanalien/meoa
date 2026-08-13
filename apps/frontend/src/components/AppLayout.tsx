import React from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Layout, Typography, Tabs } from "antd";
import WalletManager from "@/components/WalletManager";
import BulkOperations from "@/components/BulkOperations";
import { TAB_KEYS, TAB_LABELS, TAB_PATHS, TabKey } from "@/utils/tabRoutes";

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

interface AppLayoutProps {
  activeTab: TabKey;
}

export default function AppLayout({ activeTab }: AppLayoutProps) {
  const router = useRouter();

  const handleTabChange = (key: string) => {
    if (key === activeTab) return;
    if (key === TAB_KEYS.wallets || key === TAB_KEYS.operations) {
      router.push(TAB_PATHS[key]);
    }
  };

  return (
    <>
      <Head>
        <title>{`${TAB_LABELS[activeTab]} | Wallet Manager`}</title>
      </Head>
      <Layout style={{ minHeight: "100vh" }}>
        <Header style={{ background: "#fff", padding: "0 20px" }}>
          <Title level={3} style={{ margin: "16px 0" }}>
            Wallet Manager
          </Title>
        </Header>
        <Content style={{ padding: "0 50px", marginTop: 20 }}>
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={[
              {
                key: TAB_KEYS.wallets,
                label: (
                  <Link href={TAB_PATHS.wallets} style={{ color: "inherit" }}>
                    {TAB_LABELS.wallets}
                  </Link>
                ),
                children: activeTab === TAB_KEYS.wallets ? <WalletManager /> : null,
              },
              {
                key: TAB_KEYS.operations,
                label: (
                  <Link href={TAB_PATHS.operations} style={{ color: "inherit" }}>
                    {TAB_LABELS.operations}
                  </Link>
                ),
                children: activeTab === TAB_KEYS.operations ? <BulkOperations /> : null,
              },
            ]}
          />
        </Content>
        <Footer style={{ textAlign: "center" }}>
          Wallet Manager ©{new Date().getFullYear()} Created with Next.js and Ant Design
        </Footer>
      </Layout>
    </>
  );
}
