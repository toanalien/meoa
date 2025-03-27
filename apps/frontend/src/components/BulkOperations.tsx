import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Form,
  Input,
  Select,
  Checkbox,
  Table,
  Typography,
  Space,
  Divider,
  Modal,
  Alert,
  Spin,
  Tag,
} from "antd";
import {
  SendOutlined,
  SwapOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { useWallet, Wallet } from "@/utils/WalletContext";
import {
  bulkSend,
  bulkTransferToken,
  bulkApproveToken,
  bulkCustomTransaction,
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
}

const BulkOperations: React.FC = () => {
  const { wallets, getDecryptedWallet, masterPassword } = useWallet();
  const [form] = Form.useForm();
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [operationType, setOperationType] = useState<OperationType>(OperationType.SEND);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<BulkOperationResult[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [customRpcUrl, setCustomRpcUrl] = useState<string>("");
  
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

  // Execute the bulk operation
  const handleExecuteOperation = async (values: any) => {
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

    // Confirm the operation
    Modal.confirm({
      title: "Confirm Operation",
      icon: <ExclamationCircleOutlined />,
      content: (
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
              : "Custom Transaction"}
          </Paragraph>
          <Paragraph>
            <Text strong>Network:</Text> {values.network === "custom" ? "Custom RPC" : values.network}
          </Paragraph>
          <Paragraph>
            <Text strong>To Address:</Text> {values.to}
          </Paragraph>
          {values.value && (
            <Paragraph>
              <Text strong>Value:</Text> {values.value}
            </Paragraph>
          )}
          {values.tokenAddress && (
            <Paragraph>
              <Text strong>Token Address:</Text> {values.tokenAddress}
            </Paragraph>
          )}
        </div>
      ),
      onOk: async () => {
        try {
          setLoading(true);
          setResults([]);
          setShowResults(false);

          // Get private keys for selected wallets
          const privateKeys: string[] = [];
          for (const walletId of selectedWallets) {
            const wallet = await getDecryptedWallet(walletId);
            if (wallet) {
              privateKeys.push(wallet.privateKey);
            }
          }

          if (privateKeys.length === 0) {
            throw new Error("Failed to decrypt wallets");
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

          // Execute the operation based on the selected type
          let operationResults: BulkOperationResult[] = [];
          
          switch (operationType) {
            case OperationType.SEND:
              operationResults = await bulkSend(privateKeys, params, values.rpcUrl);
              break;
            case OperationType.TRANSFER_TOKEN:
              operationResults = await bulkTransferToken(privateKeys, params, values.rpcUrl);
              break;
            case OperationType.APPROVE_TOKEN:
              operationResults = await bulkApproveToken(privateKeys, params, values.rpcUrl);
              break;
            case OperationType.CUSTOM:
              operationResults = await bulkCustomTransaction(privateKeys, params, values.rpcUrl);
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
        }
      },
    });
  };

  // Table columns for wallet selection
  const walletColumns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
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
  ];

  // Table columns for operation results
  const resultColumns = [
    {
      title: "Wallet Address",
      dataIndex: "walletAddress",
      key: "walletAddress",
      render: (text: string) => (
        <Text style={{ fontSize: "0.85rem" }} ellipsis={{ tooltip: text }}>
          {text}
        </Text>
      ),
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
    {
      title: "Transaction Hash",
      dataIndex: "txHash",
      key: "txHash",
      render: (text: string) =>
        text ? (
          <Text style={{ fontSize: "0.85rem" }} ellipsis={{ tooltip: text }}>
            {text}
          </Text>
        ) : (
          "-"
        ),
    },
    {
      title: "Error",
      dataIndex: "error",
      key: "error",
      render: (text: string) =>
        text ? (
          <Text type="danger" style={{ fontSize: "0.85rem" }} ellipsis={{ tooltip: text }}>
            {text}
          </Text>
        ) : (
          "-"
        ),
    },
  ];

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
                  <Option value={OperationType.SEND}>Send Native Tokens (ETH, BNB, etc.)</Option>
                  <Option value={OperationType.TRANSFER_TOKEN}>Transfer ERC20 Tokens</Option>
                  <Option value={OperationType.APPROVE_TOKEN}>Approve ERC20 Tokens</Option>
                  <Option value={OperationType.CUSTOM}>Custom Transaction</Option>
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

              <Form.Item
                name="to"
                label="To Address"
                rules={[{ required: true, message: "Please enter the recipient address" }]}
              >
                <Input placeholder="0x..." />
              </Form.Item>

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
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={loading}
                  disabled={selectedWallets.length === 0}
                >
                  Execute Operation
                </Button>
              </Form.Item>
            </Form>

            {loading && (
              <div style={{ textAlign: "center", margin: "20px 0" }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                <div style={{ marginTop: 8 }}>Processing transactions...</div>
              </div>
            )}

            {showResults && (
              <>
                <Divider />
                <Title level={5}>3. Operation Results</Title>
                <Table
                  columns={resultColumns}
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
