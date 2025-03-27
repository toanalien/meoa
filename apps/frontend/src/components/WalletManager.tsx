import React, { useState, useEffect } from "react";
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
  Divider,
  message,
} from "antd";
import {
  PlusOutlined,
  ImportOutlined,
  LockOutlined,
  DeleteOutlined,
  CopyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from "@ant-design/icons";
import { useWallet, Wallet } from "@/utils/WalletContext";
import { isValidPrivateKey } from "@/utils/walletUtils";

const { Text, Paragraph } = Typography;

const WalletManager: React.FC = () => {
  const {
    wallets,
    masterPassword,
    setMasterPassword,
    addWallet,
    importWallet,
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
  const [isViewPrivateKeyModalVisible, setIsViewPrivateKeyModalVisible] = useState<boolean>(false);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [privateKey, setPrivateKey] = useState<string>("");
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false);
  const [passwordForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [importForm] = Form.useForm();

  // Handle setting the master password
  const handleSetPassword = (values: { password: string; confirmPassword: string }) => {
    if (values.password !== values.confirmPassword) {
      message.error("Passwords do not match");
      return;
    }

    setMasterPassword(values.password);
    setIsPasswordModalVisible(false);
    passwordForm.resetFields();
  };

  // Handle creating a new wallet
  const handleCreateWallet = async (values: { name: string }) => {
    await addWallet(values.name);
    setIsCreateModalVisible(false);
    createForm.resetFields();
  };

  // Handle importing an existing wallet
  const handleImportWallet = async (values: { name: string; privateKey: string }) => {
    if (!isValidPrivateKey(values.privateKey)) {
      message.error("Invalid private key format");
      return;
    }

    await importWallet(values.name, values.privateKey);
    setIsImportModalVisible(false);
    importForm.resetFields();
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
            label="Wallet Name"
            rules={[{ required: true, message: "Please enter a name for this wallet" }]}
          >
            <Input placeholder="Enter a name for this wallet" />
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
            label="Wallet Name"
            rules={[{ required: true, message: "Please enter a name for this wallet" }]}
          >
            <Input placeholder="Enter a name for this wallet" />
          </Form.Item>
          <Form.Item
            name="privateKey"
            label="Private Key"
            rules={[{ required: true, message: "Please enter the private key" }]}
          >
            <Input.Password placeholder="Enter the private key" />
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
                  <Tooltip title="View Private Key" key="view">
                    <Button
                      icon={<EyeOutlined />}
                      onClick={() => handleViewPrivateKey(wallet)}
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
                  title={wallet.name}
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
