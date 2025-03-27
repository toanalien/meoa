import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Form,
  Input,
  Select,
  Table,
  Typography,
  Divider,
  Modal,
  Alert,
  Spin,
  Tag,
  Space,
  Tooltip,
  Progress,
  message,
} from "antd";
import {
  SendOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  DownloadOutlined,
  KeyOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useWallet } from "@/utils/WalletContext";
import {
  bulkSend,
  bulkTransferToken,
  bulkApproveToken,
  bulkCustomTransaction,
  bulkCheckNativeBalance,
  getExplorerUrl,
  TransactionParams,
  BulkOperationResult,
} from "@/utils/blockchainUtils";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// Common blockchain networks
const NETWORKS = [
  { name: "Ethereum Mainnet", rpcUrl: "https://eth.llamarpc.com" },
  { name: "Ethereum Sepolia", rpcUrl: "https://rpc.sepolia.org" },
  { name: "BSC Mainnet", rpcUrl: "https://bsc-dataseed.binance.org" },
  { name: "Polygon Mainnet", rpcUrl: "https://polygon-rpc.com" },
  { name: "Arbitrum One", rpcUrl: "https://arb1.arbitrum.io/rpc" },
  { name: "Optimism", rpcUrl: "https://mainnet.optimism.io" },
];

// Operation types
enum OperationType {
  SEND = "send",
  TRANSFER_TOKEN = "transfer_token",
  APPROVE_TOKEN = "approve_token",
  CUSTOM = "custom",
  CHECK_NATIVE_BALANCE = "check_native_balance",
}

const BulkOperations: React.FC = () => {
  const { wallets, getDecryptedWallet, masterPassword } = useWallet();
  const [form] = Form.useForm();
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [operationType, setOperationType] = useState<OperationType>(OperationType.SEND);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<BulkOperationResult[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState<boolean>(false);
  const [operationInProgress, setOperationInProgress] = useState<boolean>(false);
  
  // Function to convert results to CSV format
  const convertToCSV = (data: BulkOperationResult[], includePrivateKeys: boolean = false): string => {
    if (data.length === 0) return "";
    
    // Determine headers based on operation type
    const isBalanceCheck = operationType === OperationType.CHECK_NATIVE_BALANCE;
    
    // Define headers based on operation type
    const headers = ["Wallet Address", "Status"];
    
    if (includePrivateKeys) {
      headers.push("Private Key");
    }
    
    if (isBalanceCheck) {
      headers.push("Balance");
      headers.push("Txns");
    } else {
      headers.push("Transaction Hash");
    }
    
    headers.push("Error");
    
    // Create CSV header row
    let csv = headers.join(",") + "\n";
    
    // Add data rows
    data.forEach(item => {
      const status = item.success ? "Success" : "Failed";
      const row = [
        `"${item.walletAddress}"`, // Wrap in quotes to handle addresses with commas
        status
      ];
      
      // Add private key placeholder (will be filled later if includePrivateKeys is true)
      if (includePrivateKeys) {
        row.push(""); // Placeholder for private key
      }
      
      if (isBalanceCheck) {
        row.push(item.balance ? `${item.balance}` : "");
        row.push(item.txCount !== undefined ? `${item.txCount}` : "");
      } else {
        row.push(item.txHash ? `"${item.txHash}"` : "");
      }
      
      row.push(item.error ? `"${item.error.replace(/"/g, '""')}"` : ""); // Escape quotes in error messages
      
      csv += row.join(",") + "\n";
    });
    
    return csv;
  };
  
  // Handle export to CSV
  const handleExportCSV = () => {
    if (results.length === 0) return;
    
    const csv = convertToCSV(results);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    // Create a link and trigger download
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    // Create filename based on operation type and date
    const date = new Date().toISOString().split("T")[0];
    const opType = operationType.replace("_", "-");
    link.setAttribute("download", `${opType}-results-${date}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Handle export to CSV with private keys
  const handleExportCSVWithPrivateKeys = async () => {
    if (results.length === 0 || !masterPassword) return;
    
    // Show confirmation modal
    Modal.confirm({
      title: "Security Warning",
      icon: <WarningOutlined style={{ color: "#ff4d4f" }} />,
      content: (
        <div>
          <Paragraph>
            <Text strong type="danger">
              You are about to export wallet private keys in plain text.
            </Text>
          </Paragraph>
          <Paragraph>
            Private keys provide full control over your wallets. Anyone with access to this file can:
          </Paragraph>
          <ul>
            <li>Transfer all funds from your wallets</li>
            <li>Execute transactions on your behalf</li>
            <li>Take complete control of your assets</li>
          </ul>
          <Paragraph>
            <Text strong>
              Are you sure you want to continue?
            </Text>
          </Paragraph>
        </div>
      ),
      okText: "Yes, Export with Private Keys",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          // Start with the basic CSV format
          let csv = convertToCSV(results, true);
          const csvLines = csv.split("\n");
          
          // Find wallet IDs for each address in the results
          const walletMap = new Map<string, string>(); // Map of address to wallet ID
          wallets.forEach(wallet => {
            walletMap.set(wallet.address.toLowerCase(), wallet.id);
          });
          
          // Process each line (skip header)
          for (let i = 1; i < csvLines.length; i++) {
            if (!csvLines[i].trim()) continue;
            
            const parts = csvLines[i].split(",");
            const address = parts[0].replace(/"/g, "").trim();
            
            // Find the wallet ID for this address
            const walletId = walletMap.get(address.toLowerCase());
            
            if (walletId) {
              // Get the decrypted wallet
              const decryptedWallet = await getDecryptedWallet(walletId);
              
              if (decryptedWallet) {
                // Insert private key at the correct position (after status)
                parts.splice(2, 0, `"${decryptedWallet.privateKey}"`);
                csvLines[i] = parts.join(",");
              } else {
                // If we couldn't decrypt, just leave the private key field empty
                parts.splice(2, 0, "");
                csvLines[i] = parts.join(",");
              }
            } else {
              // If we couldn't find the wallet, just leave the private key field empty
              parts.splice(2, 0, "");
              csvLines[i] = parts.join(",");
            }
          }
          
          // Rejoin the CSV
          csv = csvLines.join("\n");
          
          // Create and download the file
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement("a");
          link.setAttribute("href", url);
          
          // Create filename based on operation type and date
          const date = new Date().toISOString().split("T")[0];
          const opType = operationType.replace("_", "-");
          link.setAttribute("download", `${opType}-results-with-private-keys-${date}.csv`);
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Show success message
          message.success("CSV with private keys exported successfully");
        } catch (error) {
          console.error("Error exporting CSV with private keys:", error);
          message.error("Failed to export CSV with private keys");
        }
      },
    });
  };
  
  // Initialize form with default values after component mounts (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      form.setFieldsValue({
        operationType: OperationType.SEND,
        network: NETWORKS[0].rpcUrl,
        rpcUrl: NETWORKS[0].rpcUrl,
      });
    }
  }, [form]);

  // Handle wallet selection
  const handleWalletSelectionChange = (selectedRowKeys: React.Key[]) => {
    setSelectedWallets(selectedRowKeys as string[]);
  };

  // Handle operation type change
  const handleOperationTypeChange = (value: OperationType) => {
    setOperationType(value);
    form.resetFields(["tokenAddress", "data"]);
  };

  // Handle network selection change
  const handleNetworkChange = (value: string) => {
    if (value === "custom") {
      form.setFieldsValue({ rpcUrl: "" });
    } else {
      const network = NETWORKS.find((n) => n.rpcUrl === value);
      if (network) {
        form.setFieldsValue({ rpcUrl: network.rpcUrl });
      }
    }
  };

  // Define the form values type
  interface FormValues {
    operationType: OperationType;
    network: string;
    rpcUrl: string;
    to: string;
    value?: string;
    tokenAddress?: string;
    data?: string;
    gasLimit?: string;
    gasPrice?: string;
  }

  // Execute the bulk operation
  const handleExecuteOperation = async () => {
    if (!masterPassword) {
      Modal.error({
        title: "Master Password Required",
        content: "Please set a master password before performing operations.",
      });
      return;
    }

    if (selectedWallets.length === 0) {
      Modal.error({
        title: "No Wallets Selected",
        content: "Please select at least one wallet to perform the operation.",
      });
      return;
    }

    // Show the custom confirm modal
    setConfirmModalVisible(true);
  };

  // Handle the actual operation execution
  const executeOperation = async () => {
    const values = form.getFieldsValue() as FormValues;
    try {
      setOperationInProgress(true);
      setLoading(true);
      setResults([]);
      setShowResults(false);

      // For balance checking, we only need addresses
      if (operationType === OperationType.CHECK_NATIVE_BALANCE) {
        // Get addresses for selected wallets
        const addresses: string[] = selectedWallets.map(walletId => {
          const wallet = wallets.find(w => w.id === walletId);
          return wallet ? wallet.address : "";
        }).filter(address => address !== "");

        if (addresses.length === 0) {
          throw new Error("No valid wallet addresses found");
        }

        // Reset progress
        setProgress({ current: 0, total: addresses.length });

        // Check balances with progress tracking
        const operationResults = await bulkCheckNativeBalance(
          addresses, 
          values.rpcUrl,
          (current, total) => setProgress({ current, total })
        );
        setResults(operationResults);
        setShowResults(true);
        return;
      }

      // For other operations, we need private keys
      const privateKeys: string[] = [];
      for (const walletId of selectedWallets) {
        const wallet = wallets.find(w => w.id === walletId);
        
        // Skip watch-only wallets for operations that require private keys
        if (wallet?.isWatchOnly) {
          continue;
        }
        
        const decryptedWallet = await getDecryptedWallet(walletId);
        if (decryptedWallet) {
          privateKeys.push(decryptedWallet.privateKey);
        }
      }

      if (privateKeys.length === 0) {
        throw new Error("No valid wallets with private keys selected");
      }

      // Prepare transaction parameters
      const params: TransactionParams = {
        to: values.to,
        value: values.value,
        gasLimit: values.gasLimit,
        gasPrice: values.gasPrice,
        tokenAddress: values.tokenAddress,
        data: values.data,
      };

      // Reset progress
      setProgress({ current: 0, total: privateKeys.length });

      // Execute the operation based on the selected type with progress tracking
      let operationResults: BulkOperationResult[] = [];
      
      switch (operationType) {
        case OperationType.SEND:
          operationResults = await bulkSend(
            privateKeys, 
            params, 
            values.rpcUrl,
            (current, total) => setProgress({ current, total })
          );
          break;
        case OperationType.TRANSFER_TOKEN:
          operationResults = await bulkTransferToken(
            privateKeys, 
            params, 
            values.rpcUrl,
            (current, total) => setProgress({ current, total })
          );
          break;
        case OperationType.APPROVE_TOKEN:
          operationResults = await bulkApproveToken(
            privateKeys, 
            params, 
            values.rpcUrl,
            (current, total) => setProgress({ current, total })
          );
          break;
        case OperationType.CUSTOM:
          operationResults = await bulkCustomTransaction(
            privateKeys, 
            params, 
            values.rpcUrl,
            (current, total) => setProgress({ current, total })
          );
          break;
      }

      setResults(operationResults);
      setShowResults(true);
    } catch (error) {
      Modal.error({
        title: "Operation Failed",
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setLoading(false);
      setOperationInProgress(false);
      setConfirmModalVisible(false);
    }
  };

  // Define a type for the wallet table record
  interface WalletTableRecord {
    id: string;
    name: string;
    address: string;
    isWatchOnly?: boolean;
    key: string;
  }

  // Table columns for wallet selection
  const walletColumns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: WalletTableRecord) => (
        <Space>
          {text}
          {record.isWatchOnly && (
            <Tooltip title="Watch-only wallet">
              <Text type="secondary" style={{ fontSize: "0.85rem" }}>
                (Watch-only)
              </Text>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "Address",
      dataIndex: "address",
      key: "address",
      render: (text: string) => (
        <Text style={{ fontSize: "0.85rem" }} ellipsis={{ tooltip: text }}>
          {text}
        </Text>
      ),
    },
    {
      title: "Type",
      key: "type",
      render: (_: unknown, record: WalletTableRecord) => (
        <Tag color={record.isWatchOnly ? "blue" : "green"}>
          {record.isWatchOnly ? "Watch-only" : "Full Access"}
        </Tag>
      ),
    },
  ];

  // Get table columns for operation results based on operation type
  const getResultColumns = () => {
    const baseColumns = [
      {
        title: "Wallet Address",
        dataIndex: "walletAddress",
        key: "walletAddress",
        render: (text: string) => {
          const rpcUrl = form.getFieldValue("rpcUrl");
          const explorerUrl = getExplorerUrl(rpcUrl, text);
          
          return (
            <a 
              href={explorerUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ fontSize: "0.85rem" }}
            >
              <Text ellipsis={{ tooltip: text }}>
                {text}
              </Text>
            </a>
          );
        },
      },
      {
        title: "Status",
        dataIndex: "success",
        key: "success",
        render: (success: boolean) =>
          success ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Success
            </Tag>
          ) : (
            <Tag color="error" icon={<ExclamationCircleOutlined />}>
              Failed
            </Tag>
          ),
      },
    ];

    // Add balance and transaction count columns for native balance check operation
    if (operationType === OperationType.CHECK_NATIVE_BALANCE) {
      baseColumns.push({
        title: "Balance",
        dataIndex: "balance",
        key: "balance",
        render: (text: string) => (
          <Text>{text ? `${text} ETH` : "-"}</Text>
        ),
      });
      
      baseColumns.push({
        title: "Txns",
        dataIndex: "txCount",
        key: "txCount",
        render: (count: any) => (
          <Text>{count !== undefined ? count : "-"}</Text>
        ),
      });
    } else {
      // Add transaction hash column for transaction operations
      baseColumns.push({
        title: "Transaction Hash",
        dataIndex: "txHash",
        key: "txHash",
        render: (text: string) => {
          if (!text) return <Text>-</Text>;
          
          const rpcUrl = form.getFieldValue("rpcUrl");
          let explorerUrl = "";
          
          // Determine which explorer to use based on the RPC URL
          if (rpcUrl.includes("binance") || rpcUrl.includes("bsc")) {
            explorerUrl = `https://bscscan.com/tx/${text}`;
          } else if (rpcUrl.includes("polygon")) {
            explorerUrl = `https://polygonscan.com/tx/${text}`;
          } else if (rpcUrl.includes("arbitrum")) {
            explorerUrl = `https://arbiscan.io/tx/${text}`;
          } else if (rpcUrl.includes("optimism")) {
            explorerUrl = `https://optimistic.etherscan.io/tx/${text}`;
          } else if (rpcUrl.includes("sepolia")) {
            explorerUrl = `https://sepolia.etherscan.io/tx/${text}`;
          } else {
            // Default to Etherscan for Ethereum and unknown networks
            explorerUrl = `https://etherscan.io/tx/${text}`;
          }
          
          return (
            <a 
              href={explorerUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ fontSize: "0.85rem" }}
            >
              <Text ellipsis={{ tooltip: text }}>
                {text}
              </Text>
            </a>
          );
        },
      });
    }

    // Add error column for all operations
    baseColumns.push({
      title: "Error",
      dataIndex: "error",
      key: "error",
      render: (text: string) => (
        <Text type="danger" style={{ fontSize: "0.85rem" }} ellipsis={{ tooltip: text }}>
          {text || "-"}
        </Text>
      ),
    });

    return baseColumns;
  };

  return (
    <div>
      <Card title="Bulk Operations">
        {!masterPassword ? (
          <Alert
            message="Master Password Required"
            description="Please set a master password in the Wallet Management tab before performing operations."
            type="warning"
            showIcon
          />
        ) : wallets.length === 0 ? (
          <Alert
            message="No Wallets Available"
            description="Please create or import wallets in the Wallet Management tab before performing operations."
            type="info"
            showIcon
          />
        ) : (
          <>
            <Title level={5}>1. Select Wallets</Title>
            <Table
              rowSelection={{
                type: "checkbox",
                selectedRowKeys: selectedWallets,
                onChange: handleWalletSelectionChange,
              }}
              columns={walletColumns}
              dataSource={wallets.map((wallet) => ({
                ...wallet,
                key: wallet.id,
              }))}
              size="small"
              pagination={false}
              style={{ marginBottom: 24 }}
            />

            <Divider />

            <Title level={5}>2. Configure Operation</Title>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleExecuteOperation}
              initialValues={{
                operationType: OperationType.SEND,
                network: NETWORKS[0].rpcUrl,
                rpcUrl: NETWORKS[0].rpcUrl,
              }}
            >
              <Form.Item
                name="operationType"
                label="Operation Type"
                rules={[{ required: true, message: "Please select an operation type" }]}
              >
                <Select onChange={(value) => handleOperationTypeChange(value as OperationType)}>
                  <Option value={OperationType.SEND}>
                    <Space>
                      Send Native Tokens (ETH, BNB, etc.)
                    </Space>
                  </Option>
                  <Option value={OperationType.TRANSFER_TOKEN}>
                    <Space>
                      Transfer ERC20 Tokens
                    </Space>
                  </Option>
                  <Option value={OperationType.APPROVE_TOKEN}>
                    <Space>
                      Approve ERC20 Tokens
                    </Space>
                  </Option>
                  <Option value={OperationType.CUSTOM}>
                    <Space>
                      Custom Transaction
                    </Space>
                  </Option>
                  <Option value={OperationType.CHECK_NATIVE_BALANCE}>
                    <Space>
                      Check Native Balance
                      <Tag color="blue" style={{ marginLeft: 8 }}>Safe</Tag>
                    </Space>
                  </Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="network"
                label="Network"
                rules={[{ required: true, message: "Please select a network" }]}
              >
                <Select onChange={handleNetworkChange}>
                  {NETWORKS.map((network) => (
                    <Option key={network.rpcUrl} value={network.rpcUrl}>
                      {network.name}
                    </Option>
                  ))}
                  <Option value="custom">Custom RPC URL</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="rpcUrl"
                label="RPC URL"
                rules={[{ required: true, message: "Please enter the RPC URL" }]}
              >
                <Input placeholder="e.g., https://eth.llamarpc.com" />
              </Form.Item>

              {operationType !== OperationType.CHECK_NATIVE_BALANCE && (
                <Form.Item
                  name="to"
                  label="To Address"
                  rules={[{ required: true, message: "Please enter the recipient address" }]}
                >
                  <Input placeholder="0x..." />
                </Form.Item>
              )}

              {(operationType === OperationType.SEND ||
                operationType === OperationType.TRANSFER_TOKEN ||
                operationType === OperationType.APPROVE_TOKEN) && (
                <Form.Item
                  name="value"
                  label={
                    operationType === OperationType.SEND
                      ? "Amount (in ETH/BNB/etc.)"
                      : operationType === OperationType.TRANSFER_TOKEN
                      ? "Token Amount"
                      : "Approval Amount (or 'max' for unlimited)"
                  }
                  rules={[{ required: true, message: "Please enter the amount" }]}
                >
                  <Input
                    placeholder={
                      operationType === OperationType.APPROVE_TOKEN
                        ? "Enter amount or 'max' for unlimited approval"
                        : "e.g., 0.1"
                    }
                  />
                </Form.Item>
              )}

              {(operationType === OperationType.TRANSFER_TOKEN ||
                operationType === OperationType.APPROVE_TOKEN) && (
                <Form.Item
                  name="tokenAddress"
                  label="Token Contract Address"
                  rules={[{ required: true, message: "Please enter the token contract address" }]}
                >
                  <Input placeholder="0x..." />
                </Form.Item>
              )}

              {operationType === OperationType.CUSTOM && (
                <Form.Item
                  name="data"
                  label="Transaction Data (Hex)"
                  rules={[{ required: true, message: "Please enter the transaction data" }]}
                >
                  <TextArea rows={4} placeholder="0x..." />
                </Form.Item>
              )}

              <Form.Item name="gasLimit" label="Gas Limit (optional)">
                <Input placeholder="e.g., 21000" />
              </Form.Item>

              <Form.Item name="gasPrice" label="Gas Price (Gwei, optional)">
                <Input placeholder="e.g., 5" />
              </Form.Item>

              <Form.Item>
                {operationType !== OperationType.CHECK_NATIVE_BALANCE && 
                 selectedWallets.some(id => wallets.find(w => w.id === id)?.isWatchOnly) && (
                  <Alert
                    message="Watch-only wallets detected"
                    description="Some selected wallets are watch-only and will be skipped for this operation as it requires private keys."
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={loading}
                  disabled={selectedWallets.length === 0}
                >
                  {operationType === OperationType.CHECK_NATIVE_BALANCE
                    ? "Check Balances"
                    : "Execute Operation"}
                </Button>
              </Form.Item>
            </Form>

            {/* Progress indicator outside modal (keeping for backward compatibility) */}
            {loading && !confirmModalVisible && (
              <div style={{ textAlign: "center", margin: "20px 0" }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                <div style={{ marginTop: 8 }}>
                  {progress 
                    ? `Processing transactions... ${progress.current}/${progress.total} wallets`
                    : "Processing transactions..."}
                </div>
              </div>
            )}

            {/* Custom Confirm Modal with Progress */}
            <Modal
              title="Confirm Operation"
              open={confirmModalVisible}
              onOk={() => executeOperation()}
              onCancel={() => setConfirmModalVisible(false)}
              confirmLoading={operationInProgress}
              okButtonProps={{ disabled: operationInProgress }}
              cancelButtonProps={{ disabled: operationInProgress }}
              closable={!operationInProgress}
              maskClosable={!operationInProgress}
            >
              <div>
                <Paragraph>
                  You are about to perform a bulk operation on {selectedWallets.length} wallet(s).
                  This action cannot be undone.
                </Paragraph>
                <Paragraph>
                  <Text strong>Operation:</Text>{" "}
                  {operationType === OperationType.SEND
                    ? "Send Native Tokens"
                    : operationType === OperationType.TRANSFER_TOKEN
                    ? "Transfer Tokens"
                    : operationType === OperationType.APPROVE_TOKEN
                    ? "Approve Tokens"
                    : operationType === OperationType.CHECK_NATIVE_BALANCE
                    ? "Check Native Balance"
                    : "Custom Transaction"}
                </Paragraph>
                <Paragraph>
                  <Text strong>Network:</Text> {form.getFieldValue("network") === "custom" ? "Custom RPC" : form.getFieldValue("network")}
                </Paragraph>
                {operationType !== OperationType.CHECK_NATIVE_BALANCE && (
                  <Paragraph>
                    <Text strong>To Address:</Text> {form.getFieldValue("to")}
                  </Paragraph>
                )}
                {form.getFieldValue("value") && (
                  <Paragraph>
                    <Text strong>Value:</Text> {form.getFieldValue("value")}
                  </Paragraph>
                )}
                {form.getFieldValue("tokenAddress") && (
                  <Paragraph>
                    <Text strong>Token Address:</Text> {form.getFieldValue("tokenAddress")}
                  </Paragraph>
                )}
                
                {/* Progress indicator inside modal */}
                {operationInProgress && progress && (
                  <div style={{ marginTop: 24, textAlign: "center" }}>
                    <Progress 
                      percent={Math.round((progress.current / progress.total) * 100)} 
                      status="active"
                      style={{ marginBottom: 12 }}
                    />
                    <div>
                      <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} style={{ marginRight: 8 }} />
                      Processing transactions... {progress.current}/{progress.total} wallets
                    </div>
                  </div>
                )}
              </div>
            </Modal>

            {showResults && (
              <>
                <Divider />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <Title level={5} style={{ margin: 0 }}>3. Operation Results</Title>
                  <Space>
                    <Button 
                      type="primary" 
                      icon={<DownloadOutlined />} 
                      onClick={handleExportCSV}
                      disabled={results.length === 0}
                    >
                      Export CSV
                    </Button>
                    <Button 
                      type="primary" 
                      danger
                      icon={<KeyOutlined />} 
                      onClick={handleExportCSVWithPrivateKeys}
                      disabled={results.length === 0 || !masterPassword}
                      title="Export CSV with private keys (sensitive information)"
                    >
                      Export with Private Keys
                    </Button>
                  </Space>
                </div>
                <Table
                  columns={getResultColumns()}
                  dataSource={results.map((result, index) => ({ ...result, key: index }))}
                  pagination={false}
                />
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default BulkOperations;
