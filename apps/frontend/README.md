# Wallet Manager Frontend

This is the frontend application for the Wallet Manager project, built with Next.js and Ant Design.

## Directory Structure

```
src/
├── components/         # React components
│   ├── WalletManager.tsx   # Wallet management UI
│   └── BulkOperations.tsx  # Bulk operations UI
├── pages/              # Next.js pages
│   ├── _app.tsx        # App wrapper with global providers
│   └── index.tsx       # Main page with tabs
├── styles/             # CSS styles
│   └── globals.css     # Global styles
└── utils/              # Utility functions
    ├── WalletContext.tsx   # Context for wallet state management
    ├── walletUtils.ts      # Wallet generation and encryption utilities
    └── blockchainUtils.ts  # Blockchain interaction utilities
```

## Components

### WalletManager

The WalletManager component provides the UI for:
- Setting a master password
- Creating new wallets
- Importing existing wallets
- Viewing wallet details
- Viewing and copying private keys
- Removing wallets

### BulkOperations

The BulkOperations component provides the UI for:
- Selecting multiple wallets
- Configuring blockchain operations
- Executing operations in bulk:
  - Sending native tokens (ETH, BNB, etc.)
  - Transferring ERC20 tokens
  - Approving ERC20 tokens
  - Executing custom transactions
- Viewing operation results

## Utilities

### WalletContext

The WalletContext provides a React context for managing wallet state across the application:
- Storing and retrieving wallets from localStorage
- Encrypting and decrypting wallet private keys
- Adding, importing, and removing wallets
- Managing the master password

### walletUtils

The walletUtils module provides functions for:
- Generating new Ethereum wallets
- Encrypting wallet private keys
- Decrypting wallet private keys
- Validating private keys

### blockchainUtils

The blockchainUtils module provides functions for:
- Creating providers for different networks
- Sending native tokens from multiple wallets
- Transferring ERC20 tokens from multiple wallets
- Approving ERC20 tokens from multiple wallets
- Executing custom transactions from multiple wallets
- Getting native token and ERC20 token balances

## Security

- All wallet private keys are encrypted using AES encryption with the user's master password
- Private keys are never stored in plain text
- The master password is never stored; it only exists in memory during the session

## Development

To start the development server:

```bash
pnpm dev
```

To build for production:

```bash
pnpm build
```

## Dependencies

- Next.js: React framework
- Ant Design: UI components
- ethers.js: Ethereum library
- CryptoJS: Encryption library
