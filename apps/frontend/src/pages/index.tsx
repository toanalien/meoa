import { useState, useEffect } from "react";
import { Layout, Typography, Tabs } from "antd";
import WalletManager from "@/components/WalletManager";
import BulkOperations from "@/components/BulkOperations";
import { WalletProvider } from "@/utils/WalletContext";

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

export default function Home() {
  return (
    <WalletProvider>
      <Layout style={{ minHeight: "100vh" }}>
        <Header style={{ background: "#fff", padding: "0 20px" }}>
          <Title level={3} style={{ margin: "16px 0" }}>
            Wallet Manager
          </Title>
        </Header>
        <Content style={{ padding: "0 50px", marginTop: 20 }}>
          <Tabs
            defaultActiveKey="wallets"
            items={[
              {
                key: "wallets",
                label: "Wallet Management",
                children: <WalletManager />,
              },
              {
                key: "operations",
                label: "Bulk Operations",
                children: <BulkOperations />,
              },
            ]}
          />
        </Content>
        <Footer style={{ textAlign: "center" }}>
          Wallet Manager ©{new Date().getFullYear()} Created with Next.js and Ant Design
        </Footer>
      </Layout>
    </WalletProvider>
  );
}
