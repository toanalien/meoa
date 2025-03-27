import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { message } from "antd";
import { encryptWallet, decryptWallet, generateWallet } from "@/utils/walletUtils";
import CryptoJS from "crypto-js";

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
  bulkImportWallets: (inputs: string[]) => Promise<{ success: number; failed: number; wallets: Wallet[] }>;
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

  // Constants for storage keys
  const WALLET_STORAGE_KEY = "meoa_wallets";
  const PASSWORD_FLAG_KEY = "meoa_has_password";
  const ENCRYPTED_PASSWORD_KEY = "meoa_encrypted_master_password";
  
  // Legacy keys for backward compatibility
  const LEGACY_WALLET_KEY = "wallets";
  const LEGACY_PASSWORD_FLAG_KEY = "hasPassword";
  const LEGACY_ENCRYPTED_PASSWORD_KEY = "encryptedMasterPassword";

  // Encrypt master password for storage
  const encryptMasterPassword = (password: string): string => {
    // Use a fixed salt for simplicity (in a production app, you might want to use a more secure approach)
    const salt = "wallet-manager-salt";
    return CryptoJS.AES.encrypt(password, salt).toString();
  };

  // Decrypt master password from storage
  const decryptMasterPassword = (encryptedPassword: string): string => {
    const salt = "wallet-manager-salt";
    const bytes = CryptoJS.AES.decrypt(encryptedPassword, salt);
    return bytes.toString(CryptoJS.enc.Utf8);
  };

  // Helper function to save wallets to localStorage
  const saveWalletsToLocalStorage = (walletsToSave: Wallet[]) => {
    if (typeof window !== "undefined") {
      try {
        console.log("Explicitly saving wallets to localStorage:", walletsToSave);
        
        // Stringify the wallet data
        const walletData = JSON.stringify(walletsToSave);
        
        // Save to the new key
        localStorage.setItem(WALLET_STORAGE_KEY, walletData);
        
        // Also save to sessionStorage as a backup
        sessionStorage.setItem(WALLET_STORAGE_KEY, walletData);
        
        // Remove the legacy key to avoid duplication
        if (localStorage.getItem(LEGACY_WALLET_KEY)) {
          localStorage.removeItem(LEGACY_WALLET_KEY);
        }
        
        // Verify the wallets were saved correctly
        const storedWallets = localStorage.getItem(WALLET_STORAGE_KEY);
        console.log("Verified explicitly stored wallets:", storedWallets);
      } catch (error) {
        console.error("Failed to save wallets to localStorage:", error);
        message.error("Failed to save wallets");
      }
    }
  };

  // Load wallets and master password from localStorage on initial render (client-side only)
  useEffect(() => {
    // Only run on the client side
    if (typeof window !== "undefined") {
      console.log("Loading data from localStorage on initial render");
      
      // Try to load wallets from different storage locations in order of preference
      let loadedWallets: Wallet[] | null = null;
      
      // 1. Try new localStorage key
      const storedWallets = localStorage.getItem(WALLET_STORAGE_KEY);
      console.log("Stored wallets (new key):", storedWallets);
      
      if (storedWallets) {
        try {
          loadedWallets = JSON.parse(storedWallets);
        } catch (error) {
          console.error("Failed to parse stored wallets (new key):", error);
        }
      }
      
      // 2. If not found, try legacy localStorage key
      if (!loadedWallets) {
        const legacyWallets = localStorage.getItem(LEGACY_WALLET_KEY);
        console.log("Stored wallets (legacy key):", legacyWallets);
        
        if (legacyWallets) {
          try {
            loadedWallets = JSON.parse(legacyWallets);
          } catch (error) {
            console.error("Failed to parse stored wallets (legacy key):", error);
          }
        }
      }
      
      // 3. If still not found, try sessionStorage
      if (!loadedWallets) {
        const sessionWallets = sessionStorage.getItem(WALLET_STORAGE_KEY);
        console.log("Stored wallets (session storage):", sessionWallets);
        
        if (sessionWallets) {
          try {
            loadedWallets = JSON.parse(sessionWallets);
          } catch (error) {
            console.error("Failed to parse stored wallets (session storage):", error);
          }
        }
      }
      
      // Set wallets if we found them
      if (loadedWallets && Array.isArray(loadedWallets)) {
        console.log("Setting wallets from storage:", loadedWallets);
        setWallets(loadedWallets);
        
        // Ensure wallets are saved with the new key format
        saveWalletsToLocalStorage(loadedWallets);
      } else {
        console.log("No wallets found in storage or invalid format");
      }

      // Check if password is set (try both new and legacy keys)
      const hasPassword = localStorage.getItem(PASSWORD_FLAG_KEY) || localStorage.getItem(LEGACY_PASSWORD_FLAG_KEY);
      setIsPasswordSet(hasPassword === "true");
      
      // Load encrypted master password if it exists (try both new and legacy keys)
      const encryptedMasterPassword = 
        localStorage.getItem(ENCRYPTED_PASSWORD_KEY) || 
        localStorage.getItem(LEGACY_ENCRYPTED_PASSWORD_KEY);
      
      console.log("Encrypted master password:", encryptedMasterPassword);
      
      if (encryptedMasterPassword) {
        try {
          const decryptedPassword = decryptMasterPassword(encryptedMasterPassword);
          console.log("Master password decrypted successfully");
          setMasterPasswordState(decryptedPassword);
        } catch (error) {
          console.error("Failed to decrypt master password:", error);
          // Don't show an error message to the user, just let them enter the password again
        }
      }
    }
  }, []);

  // Save wallets to localStorage whenever they change (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined" && wallets.length > 0) {
      console.log("Saving wallets to localStorage from useEffect:", wallets);
      saveWalletsToLocalStorage(wallets);
    }
  }, [wallets]);

  const setMasterPassword = (password: string) => {
    setMasterPasswordState(password);
    if (typeof window !== "undefined") {
      // Store password flag in the new key
      localStorage.setItem(PASSWORD_FLAG_KEY, "true");
      
      // Store encrypted master password in the new key
      const encryptedPassword = encryptMasterPassword(password);
      localStorage.setItem(ENCRYPTED_PASSWORD_KEY, encryptedPassword);
      
      // Remove legacy keys to avoid duplication
      if (localStorage.getItem(LEGACY_PASSWORD_FLAG_KEY)) {
        localStorage.removeItem(LEGACY_PASSWORD_FLAG_KEY);
      }
      if (localStorage.getItem(LEGACY_ENCRYPTED_PASSWORD_KEY)) {
        localStorage.removeItem(LEGACY_ENCRYPTED_PASSWORD_KEY);
      }
      
      // Save wallets to localStorage when setting master password
      if (wallets.length > 0) {
        console.log("Saving wallets when setting master password:", wallets);
        saveWalletsToLocalStorage(wallets);
      }
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

      const updatedWallets = [...wallets, wallet];
      setWallets(updatedWallets);
      saveWalletsToLocalStorage(updatedWallets);
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
        (result: { address: string }) => result.address
      );
      
      const wallet: Wallet = {
        id: Date.now().toString(),
        name,
        address,
        encryptedPrivateKey,
      };

      const updatedWallets = [...wallets, wallet];
      setWallets(updatedWallets);
      saveWalletsToLocalStorage(updatedWallets);
      message.success("Wallet imported successfully");
      return wallet;
    } catch (error) {
      console.error("Failed to import wallet:", error);
      message.error("Failed to import wallet");
      return null;
    }
  };

  const bulkImportWallets = async (inputs: string[]): Promise<{ success: number; failed: number; wallets: Wallet[] }> => {
    if (!masterPassword) {
      message.error("Master password not set");
      return { success: 0, failed: inputs.length, wallets: [] };
    }

    const results = {
      success: 0,
      failed: 0,
      wallets: [] as Wallet[],
    };

    // Process each input line
    for (const input of inputs) {
      const trimmedInput = input.trim();
      if (!trimmedInput) continue; // Skip empty lines

      try {
        // Import the wallet using the utility function
        const { createWalletFromInput } = await import("@/utils/walletUtils");
        const walletData = createWalletFromInput(trimmedInput);
        
        // Encrypt the private key
        const encryptedPrivateKey = await encryptWallet(walletData.privateKey, masterPassword);
        
        // Create a wallet object
        const wallet: Wallet = {
          id: Date.now().toString() + results.success, // Ensure unique ID
          name: `Imported Wallet ${results.success + 1}`, // Auto-generate name
          address: walletData.address,
          encryptedPrivateKey,
        };
        
        results.wallets.push(wallet);
        results.success++;
      } catch (error) {
        console.error("Failed to import wallet:", error);
        results.failed++;
      }
    }

    if (results.wallets.length > 0) {
      const updatedWallets = [...wallets, ...results.wallets];
      setWallets(updatedWallets);
      saveWalletsToLocalStorage(updatedWallets);
      message.success(`Successfully imported ${results.success} wallet(s)`);
      
      if (results.failed > 0) {
        message.warning(`Failed to import ${results.failed} wallet(s)`);
      }
    } else if (results.failed > 0) {
      message.error(`Failed to import all ${results.failed} wallet(s)`);
    }

    return results;
  };

  const removeWallet = (id: string) => {
    const updatedWallets = wallets.filter((wallet) => wallet.id !== id);
    setWallets(updatedWallets);
    saveWalletsToLocalStorage(updatedWallets);
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
    bulkImportWallets,
    removeWallet,
    getDecryptedWallet,
    isPasswordSet,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
