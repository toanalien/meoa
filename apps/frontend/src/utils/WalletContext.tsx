import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { message } from "antd";
import { encryptWallet, decryptWallet, generateWallet } from "./walletUtils";

export interface Wallet {
  id: string;
  name: string;
  address: string;
  encryptedPrivateKey: string;
}

interface WalletContextType {
  wallets: Wallet[];
  masterPassword: string | null;
  setMasterPassword: (password: string) => void;
  addWallet: (name: string) => Promise<Wallet | null>;
  importWallet: (name: string, privateKey: string) => Promise<Wallet | null>;
  removeWallet: (id: string) => void;
  getDecryptedWallet: (id: string) => Promise<{ privateKey: string; address: string } | null>;
  isPasswordSet: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [masterPassword, setMasterPasswordState] = useState<string | null>(null);
  const [isPasswordSet, setIsPasswordSet] = useState<boolean>(false);

  // Load wallets from localStorage on initial render (client-side only)
  useEffect(() => {
    // Only run on the client side
    if (typeof window !== "undefined") {
      const storedWallets = localStorage.getItem("wallets");
      if (storedWallets) {
        try {
          setWallets(JSON.parse(storedWallets));
        } catch (error) {
          console.error("Failed to parse stored wallets:", error);
          message.error("Failed to load stored wallets");
        }
      }

      // Check if password is set
      const hasPassword = localStorage.getItem("hasPassword");
      setIsPasswordSet(hasPassword === "true");
    }
  }, []);

  // Save wallets to localStorage whenever they change (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("wallets", JSON.stringify(wallets));
    }
  }, [wallets]);

  const setMasterPassword = (password: string) => {
    setMasterPasswordState(password);
    if (typeof window !== "undefined") {
      localStorage.setItem("hasPassword", "true");
    }
    setIsPasswordSet(true);
    message.success("Master password set successfully");
  };

  const addWallet = async (name: string): Promise<Wallet | null> => {
    if (!masterPassword) {
      message.error("Master password not set");
      return null;
    }

    try {
      const newWallet = generateWallet();
      const encryptedPrivateKey = await encryptWallet(newWallet.privateKey, masterPassword);
      
      const wallet: Wallet = {
        id: Date.now().toString(),
        name,
        address: newWallet.address,
        encryptedPrivateKey,
      };

      setWallets((prev) => [...prev, wallet]);
      message.success("Wallet created successfully");
      return wallet;
    } catch (error) {
      console.error("Failed to create wallet:", error);
      message.error("Failed to create wallet");
      return null;
    }
  };

  const importWallet = async (name: string, privateKey: string): Promise<Wallet | null> => {
    if (!masterPassword) {
      message.error("Master password not set");
      return null;
    }

    try {
      const encryptedPrivateKey = await encryptWallet(privateKey, masterPassword);
      const address = await decryptWallet(encryptedPrivateKey, masterPassword).then(
        (result) => result.address
      );
      
      const wallet: Wallet = {
        id: Date.now().toString(),
        name,
        address,
        encryptedPrivateKey,
      };

      setWallets((prev) => [...prev, wallet]);
      message.success("Wallet imported successfully");
      return wallet;
    } catch (error) {
      console.error("Failed to import wallet:", error);
      message.error("Failed to import wallet");
      return null;
    }
  };

  const removeWallet = (id: string) => {
    setWallets((prev) => prev.filter((wallet) => wallet.id !== id));
    message.success("Wallet removed successfully");
  };

  const getDecryptedWallet = async (id: string) => {
    if (!masterPassword) {
      message.error("Master password not set");
      return null;
    }

    const wallet = wallets.find((w) => w.id === id);
    if (!wallet) {
      message.error("Wallet not found");
      return null;
    }

    try {
      const decrypted = await decryptWallet(wallet.encryptedPrivateKey, masterPassword);
      return decrypted;
    } catch (error) {
      console.error("Failed to decrypt wallet:", error);
      message.error("Failed to decrypt wallet. Incorrect password?");
      return null;
    }
  };

  const value = {
    wallets,
    masterPassword,
    setMasterPassword,
    addWallet,
    importWallet,
    removeWallet,
    getDecryptedWallet,
    isPasswordSet,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
