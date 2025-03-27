import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  Button,
  Input,
  Form,
  Modal,
  List,
  Typography,
  Space,
  Tooltip,
  message,
  Checkbox,
  Tabs,
  Spin,
} from "antd";
import {
  PlusOutlined,
  ImportOutlined,
  LockOutlined,
  DeleteOutlined,
  CopyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  UploadOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useWallet, Wallet } from "@/utils/WalletContext";
import { detectWalletInputType, createWalletFromInput } from "@/utils/walletUtils";

const { Text, Paragraph } = Typography;

const WalletManager: React.FC = () => {
  const {
    wallets,
    masterPassword,
    setMasterPassword,
    addWallet,
    importWallet,
    importWatchOnlyWallet,
    bulkImportWallets,
    bulkImportWatchOnlyWallets,
    removeWallet,
    getDecryptedWallet,
    isPasswordSet,
  } = useWallet();

  // Initialize with false and update in useEffect to avoid hydration mismatch
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState<boolean>(false);
  
  // Set initial state based on isPasswordSet after component mounts (client-side only)
  useEffect(() => {
    setIsPasswordModalVisible(!isPasswordSet);
  }, [isPasswordSet]);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState<boolean>(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState<boolean>(false);
  const [isWatchOnlyModalVisible, setIsWatchOnlyModalVisible] = useState<boolean>(false);
  const [isBulkImportModalVisible, setIsBulkImportModalVisible] = useState<boolean>(false);
  const [isBulkWatchOnlyModalVisible, setIsBulkWatchOnlyModalVisible] = useState<boolean>(false);
  const [isViewPrivateKeyModalVisible, setIsViewPrivateKeyModalVisible] = useState<boolean>(false);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [privateKey, setPrivateKey] = useState<string>("");
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false);
  const [recommendPassword, setRecommendPassword] = useState<boolean>(false);
  const [bulkImportLoading, setBulkImportLoading] = useState<boolean>(false);
  const [activeImportTab, setActiveImportTab] = useState<string>("textbox");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watchOnlyFileInputRef = useRef<HTMLInputElement>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  
  const [passwordForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [importForm] = Form.useForm();
  const [watchOnlyForm] = Form.useForm();
  const [bulkImportForm] = Form.useForm();
  const [bulkWatchOnlyForm] = Form.useForm();

  // Generate a strong random password
  const generateStrongPassword = (): string => {
    const length = 16;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let password = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    return password;
  };

  // Handle setting the master password
  const handleSetPassword = (values: { password: string; confirmPassword: string }) => {
    if (values.password !== values.confirmPassword) {
      message.error("Passwords do not match");
      return;
    }

    setMasterPassword(values.password);
    setIsPasswordModalVisible(false);
    passwordForm.resetFields();
    setRecommendPassword(false);
  };

  // Handle recommend password change
  const handleRecommendPasswordChange = (checked: boolean) => {
    setRecommendPassword(checked);
    if (checked) {
      const strongPassword = generateStrongPassword();
      passwordForm.setFieldsValue({
        password: strongPassword,
        confirmPassword: strongPassword
      });
    } else {
      passwordForm.setFieldsValue({
        password: "",
        confirmPassword: ""
      });
    }
  };

  // Handle creating a new wallet
  const handleCreateWallet = async (values: { name?: string }) => {
    await addWallet(values.name);
    setIsCreateModalVisible(false);
    createForm.resetFields();
  };

  // Handle importing an existing wallet
  const handleImportWallet = async (values: { name?: string; privateKey: string }) => {
    const inputType = detectWalletInputType(values.privateKey);
    
    if (!inputType) {
      message.error("Invalid input: not a valid private key or mnemonic phrase");
      return;
    }
    
    try {
      // Use the utility function to create a wallet from the input
      const walletData = createWalletFromInput(values.privateKey);
      
      // Import the wallet using the private key
      await importWallet(values.name, walletData.privateKey);
      
      message.success(`Wallet imported successfully from ${inputType}`);
      setIsImportModalVisible(false);
      importForm.resetFields();
    } catch (error) {
      console.error("Failed to import wallet:", error);
      message.error("Failed to import wallet");
    }
  };

  // Handle importing a watch-only wallet
  const handleImportWatchOnlyWallet = async (values: { name?: string; address: string }) => {
    try {
      // Import the watch-only wallet
      await importWatchOnlyWallet(values.name, values.address);
      
      message.success("Watch-only wallet imported successfully");
      setIsWatchOnlyModalVisible(false);
      watchOnlyForm.resetFields();
    } catch (error) {
      console.error("Failed to import watch-only wallet:", error);
      message.error("Failed to import watch-only wallet");
    }
  };

  // Handle viewing a wallet's private key
  const handleViewPrivateKey = async (wallet: Wallet) => {
    setSelectedWallet(wallet);
    const decrypted = await getDecryptedWallet(wallet.id);
    
    if (decrypted) {
      setPrivateKey(decrypted.privateKey);
      setIsViewPrivateKeyModalVisible(true);
    }
  };

  // Handle copying text to clipboard
  const copyToClipboard = (text: string, description: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => {
          message.success(`${description} copied to clipboard`);
        },
        (err) => {
          message.error(`Failed to copy: ${err}`);
        }
      );
    } else {
      message.error("Clipboard API not available");
    }
  };

  // Handle bulk import from text input
  const handleBulkImportFromText = async (values: { walletInputs: string }) => {
    if (!masterPassword) {
      message.error("Master password not set");
      return;
    }

    const lines = values.walletInputs.split("\n").filter(line => line.trim() !== "");
    
    if (lines.length === 0) {
      message.error("No valid inputs found");
      return;
    }

    setBulkImportLoading(true);
    setImportProgress(null);
    
    try {
      const result = await bulkImportWallets(
        lines,
        (current, total) => setImportProgress({ current, total })
      );
      
      if (result.success > 0) {
        setIsBulkImportModalVisible(false);
        bulkImportForm.resetFields();
      }
    } catch (error) {
      console.error("Bulk import error:", error);
      message.error("Failed to import wallets");
    } finally {
      setBulkImportLoading(false);
    }
  };

  // Handle bulk import of watch-only wallets from text input
  const handleBulkWatchOnlyImport = async (values: { addressInputs: string }) => {
    const lines = values.addressInputs.split("\n").filter(line => line.trim() !== "");
    
    if (lines.length === 0) {
      message.error("No valid addresses found");
      return;
    }

    setBulkImportLoading(true);
    setImportProgress(null);
    
    try {
      const result = await bulkImportWatchOnlyWallets(
        lines,
        (current, total) => setImportProgress({ current, total })
      );
      
      if (result.success > 0) {
        setIsBulkWatchOnlyModalVisible(false);
        bulkWatchOnlyForm.resetFields();
      }
    } catch (error) {
      console.error("Bulk watch-only import error:", error);
      message.error("Failed to import watch-only wallets");
    } finally {
      setBulkImportLoading(false);
    }
  };

  // Handle file selection for watch-only wallet import
  const handleWatchOnlyFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setBulkImportLoading(true);
    setImportProgress(null);
    
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(line => line.trim() !== "");
      
      if (lines.length === 0) {
        message.error("No valid addresses found in file");
        return;
      }

      const result = await bulkImportWatchOnlyWallets(
        lines,
        (current, total) => setImportProgress({ current, total })
      );
      
      if (result.success > 0) {
        setIsBulkWatchOnlyModalVisible(false);
        // Reset the file input
        if (watchOnlyFileInputRef.current) {
          watchOnlyFileInputRef.current.value = "";
        }
      }
    } catch (error) {
      console.error("File import error for watch-only wallets:", error);
      message.error("Failed to import watch-only wallets from file");
    } finally {
      setBulkImportLoading(false);
    }
  };

  // Handle file selection for bulk import
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!masterPassword) {
      message.error("Master password not set");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setBulkImportLoading(true);
    setImportProgress(null);
    
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(line => line.trim() !== "");
      
      if (lines.length === 0) {
        message.error("No valid inputs found in file");
        return;
      }

      const result = await bulkImportWallets(
        lines,
        (current, total) => setImportProgress({ current, total })
      );
      
      if (result.success > 0) {
        setIsBulkImportModalVisible(false);
        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (error) {
      console.error("File import error:", error);
      message.error("Failed to import wallets from file");
    } finally {
      setBulkImportLoading(false);
    }
  };

  return (
    <div>
      {/* Password Modal */}
      <Modal
        title="Set Master Password"
        open={isPasswordModalVisible}
        onCancel={() => {
          if (isPasswordSet) {
            setIsPasswordModalVisible(false);
          } else {
            message.warning("You must set a master password to continue");
          }
        }}
        footer={null}
        closable={isPasswordSet}
        maskClosable={isPasswordSet}
      >
        <Form form={passwordForm} onFinish={handleSetPassword} layout="vertical">
          <Paragraph>
            This password will be used to encrypt and decrypt your wallet private keys.
            Make sure to remember it as it cannot be recovered.
          </Paragraph>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: "Please enter a password" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Enter your master password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            rules={[{ required: true, message: "Please confirm your password" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Confirm your master password"
            />
          </Form.Item>
          <Form.Item>
            <Checkbox 
              checked={recommendPassword}
              onChange={(e) => handleRecommendPasswordChange(e.target.checked)}
            >
              Recommend strong password
            </Checkbox>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Set Password
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Wallet Modal */}
      <Modal
        title="Create New Wallet"
        open={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        footer={null}
      >
        <Form form={createForm} onFinish={handleCreateWallet} layout="vertical">
          <Form.Item
            name="name"
            label="Wallet Name (optional)"
            rules={[{ required: false }]}
          >
            <Input placeholder="Enter a name or leave empty for auto-generated name" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Create Wallet
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Wallet Modal */}
      <Modal
        title="Import Wallet"
        open={isImportModalVisible}
        onCancel={() => setIsImportModalVisible(false)}
        footer={null}
      >
        <Form form={importForm} onFinish={handleImportWallet} layout="vertical">
          <Form.Item
            name="name"
            label="Wallet Name (optional)"
            rules={[{ required: false }]}
          >
            <Input placeholder="Enter a name or leave empty for auto-generated name" />
          </Form.Item>
          <Form.Item
            name="privateKey"
            label="Private Key or Mnemonic Phrase"
            rules={[{ required: true, message: "Please enter a private key or mnemonic phrase" }]}
          >
            <Input.Password placeholder="Enter a private key or mnemonic phrase" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Import Wallet
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* View Private Key Modal */}
      <Modal
        title={`Private Key for ${selectedWallet?.name}`}
        open={isViewPrivateKeyModalVisible}
        onCancel={() => {
          setIsViewPrivateKeyModalVisible(false);
          setShowPrivateKey(false);
          setPrivateKey("");
        }}
        footer={[
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(privateKey, "Private key")}
          >
            Copy
          </Button>,
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setIsViewPrivateKeyModalVisible(false);
              setShowPrivateKey(false);
              setPrivateKey("");
            }}
          >
            Close
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text type="warning">
            Warning: Never share your private key with anyone. Anyone with your private key has full
            control of your wallet.
          </Text>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Input.Password
              value={privateKey}
              readOnly
              visibilityToggle={false}
              style={{ flex: 1 }}
            />
            <Button
              icon={showPrivateKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => setShowPrivateKey(!showPrivateKey)}
              style={{ marginLeft: 8 }}
            />
          </div>
          {showPrivateKey && (
            <Paragraph
              style={{
                wordBreak: "break-all",
                padding: 10,
                background: "#f5f5f5",
                borderRadius: 4,
              }}
            >
              {privateKey}
            </Paragraph>
          )}
        </Space>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        title="Bulk Import Wallets"
        open={isBulkImportModalVisible}
        onCancel={() => {
          setIsBulkImportModalVisible(false);
          bulkImportForm.resetFields();
          setActiveImportTab("textbox");
        }}
        footer={null}
        width={600}
      >
        <Paragraph>
          Import multiple wallets at once by providing a list of private keys or mnemonic phrases.
          Each line will be treated as a separate wallet.
        </Paragraph>
        
        <Tabs
          activeKey={activeImportTab}
          onChange={(key) => setActiveImportTab(key)}
          items={[
            {
              key: "textbox",
              label: (
                <span>
                  <FileTextOutlined /> From Text
                </span>
              ),
              children: (
                <Form form={bulkImportForm} layout="vertical" onFinish={handleBulkImportFromText}>
                  <Form.Item
                    name="walletInputs"
                    rules={[{ required: true, message: "Please enter private keys or mnemonic phrases" }]}
                  >
                    <Input.TextArea
                      placeholder="Enter one private key or mnemonic phrase per line"
                      rows={10}
                      style={{ fontFamily: "monospace" }}
                    />
                  </Form.Item>
                  <Form.Item>
                    <Button 
                      type="primary" 
                      htmlType="submit" 
                      loading={bulkImportLoading}
                      block
                    >
                      Import Wallets
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: "file",
              label: (
                <span>
                  <UploadOutlined /> From File
                </span>
              ),
              children: (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept=".txt"
                    onChange={handleFileChange}
                  />
                  <Space direction="vertical" size="large">
                    <Button 
                      icon={<UploadOutlined />} 
                      onClick={() => fileInputRef.current?.click()}
                      size="large"
                    >
                      Select Text File
                    </Button>
                    <Text type="secondary">
                      Select a text file containing one private key or mnemonic phrase per line
                    </Text>
                    {bulkImportLoading && (
                      <div style={{ marginTop: 20 }}>
                        <Spin tip={
                          importProgress 
                            ? `Importing wallets... ${importProgress.current}/${importProgress.total}`
                            : "Importing wallets..."
                        } />
                      </div>
                    )}
                  </Space>
                </div>
              ),
            },
          ]}
        />
      </Modal>

      {/* Bulk Watch-Only Import Modal */}
      <Modal
        title="Bulk Import Watch-Only Wallets"
        open={isBulkWatchOnlyModalVisible}
        onCancel={() => {
          setIsBulkWatchOnlyModalVisible(false);
          bulkWatchOnlyForm.resetFields();
          setActiveImportTab("textbox");
        }}
        footer={null}
        width={600}
      >
        <Paragraph>
          Import multiple watch-only wallets at once by providing a list of Ethereum addresses.
          Each line will be treated as a separate watch-only wallet.
        </Paragraph>
        
        <Tabs
          activeKey={activeImportTab}
          onChange={(key) => setActiveImportTab(key)}
          items={[
            {
              key: "textbox",
              label: (
                <span>
                  <FileTextOutlined /> From Text
                </span>
              ),
              children: (
                <Form form={bulkWatchOnlyForm} layout="vertical" onFinish={handleBulkWatchOnlyImport}>
                  <Form.Item
                    name="addressInputs"
                    rules={[{ required: true, message: "Please enter Ethereum addresses" }]}
                  >
                    <Input.TextArea
                      placeholder="Enter one Ethereum address per line (0x...)"
                      rows={10}
                      style={{ fontFamily: "monospace" }}
                    />
                  </Form.Item>
                  <Form.Item>
                    <Button 
                      type="primary" 
                      htmlType="submit" 
                      loading={bulkImportLoading}
                      block
                    >
                      Import Watch-Only Wallets
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: "file",
              label: (
                <span>
                  <UploadOutlined /> From File
                </span>
              ),
              children: (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <input
                    type="file"
                    ref={watchOnlyFileInputRef}
                    style={{ display: "none" }}
                    accept=".txt"
                    onChange={handleWatchOnlyFileChange}
                  />
                  <Space direction="vertical" size="large">
                    <Button 
                      icon={<UploadOutlined />} 
                      onClick={() => watchOnlyFileInputRef.current?.click()}
                      size="large"
                    >
                      Select Text File
                    </Button>
                    <Text type="secondary">
                      Select a text file containing one Ethereum address per line
                    </Text>
                    {bulkImportLoading && (
                      <div style={{ marginTop: 20 }}>
                        <Spin tip={
                          importProgress 
                            ? `Importing watch-only wallets... ${importProgress.current}/${importProgress.total}`
                            : "Importing watch-only wallets..."
                        } />
                      </div>
                    )}
                  </Space>
                </div>
              ),
            },
          ]}
        />
      </Modal>

      {/* Watch-Only Wallet Modal */}
      <Modal
        title="Import Watch-Only Wallet"
        open={isWatchOnlyModalVisible}
        onCancel={() => setIsWatchOnlyModalVisible(false)}
        footer={null}
      >
        <Form form={watchOnlyForm} onFinish={handleImportWatchOnlyWallet} layout="vertical">
          <Paragraph>
            A watch-only wallet allows you to monitor an address without having access to the private key.
            You cannot send transactions from a watch-only wallet.
          </Paragraph>
          <Form.Item
            name="name"
            label="Wallet Name (optional)"
            rules={[{ required: false }]}
          >
            <Input placeholder="Enter a name or leave empty for auto-generated name" />
          </Form.Item>
          <Form.Item
            name="address"
            label="Ethereum Address"
            rules={[
              { required: true, message: "Please enter an Ethereum address" },
              { 
                pattern: /^0x[a-fA-F0-9]{40}$/, 
                message: "Please enter a valid Ethereum address (0x followed by 40 hexadecimal characters)" 
              }
            ]}
          >
            <Input placeholder="Enter an Ethereum address (0x...)" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Import Watch-Only Wallet
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Main Content */}
      <Card
        title="Wallet Management"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<LockOutlined />}
              onClick={() => setIsPasswordModalVisible(true)}
            >
              {isPasswordSet ? "Change Password" : "Set Password"}
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => {
                if (!masterPassword) {
                  message.error("Please set a master password first");
                  setIsPasswordModalVisible(true);
                  return;
                }
                setIsCreateModalVisible(true);
              }}
            >
              Create Wallet
            </Button>
            <Button
              icon={<ImportOutlined />}
              onClick={() => {
                if (!masterPassword) {
                  message.error("Please set a master password first");
                  setIsPasswordModalVisible(true);
                  return;
                }
                setIsImportModalVisible(true);
              }}
            >
              Import Wallet
            </Button>
            <Button
              icon={<EyeOutlined />}
              onClick={() => {
                setIsWatchOnlyModalVisible(true);
              }}
            >
              Watch Address
            </Button>
            <Button
              icon={<EyeOutlined />}
              onClick={() => {
                setIsBulkWatchOnlyModalVisible(true);
              }}
            >
              Bulk Watch
            </Button>
            <Button
              icon={<FileTextOutlined />}
              onClick={() => {
                if (!masterPassword) {
                  message.error("Please set a master password first");
                  setIsPasswordModalVisible(true);
                  return;
                }
                setIsBulkImportModalVisible(true);
              }}
            >
              Bulk Import
            </Button>
          </Space>
        }
      >
        {wallets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <Text type="secondary">No wallets yet. Create or import a wallet to get started.</Text>
          </div>
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={wallets}
            renderItem={(wallet) => (
              <List.Item
                actions={[
                  <Tooltip title={wallet.isWatchOnly ? "No private key for watch-only wallets" : "View Private Key"} key="view">
                    <Button
                      icon={<EyeOutlined />}
                      onClick={() => handleViewPrivateKey(wallet)}
                      disabled={wallet.isWatchOnly}
                    />
                  </Tooltip>,
                  <Tooltip title="Copy Address" key="copy">
                    <Button
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(wallet.address, "Address")}
                    />
                  </Tooltip>,
                  <Tooltip title="Delete Wallet" key="delete">
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        Modal.confirm({
                          title: "Delete Wallet",
                          content: `Are you sure you want to delete the wallet "${wallet.name}"? This action cannot be undone.`,
                          onOk: () => removeWallet(wallet.id),
                        });
                      }}
                    />
                  </Tooltip>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {wallet.name}
                      {wallet.isWatchOnly && (
                        <Tooltip title="Watch-only wallet">
                          <Text type="secondary" style={{ fontSize: "0.85rem" }}>
                            (Watch-only)
                          </Text>
                        </Tooltip>
                      )}
                    </Space>
                  }
                  description={
                    <Text copyable style={{ fontSize: "0.85rem" }}>
                      {wallet.address}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};

export default WalletManager;
