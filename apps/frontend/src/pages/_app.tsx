import "@/styles/globals.css";
import { ConfigProvider } from "antd";
import type { AppProps } from "next/app";
import { WalletProvider } from "@/utils/WalletContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1677ff",
        },
      }}
    >
      <WalletProvider>
        <Component {...pageProps} />
      </WalletProvider>
    </ConfigProvider>
  );
}
