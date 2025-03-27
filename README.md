# Wallet Manager

A secure wallet management service that allows users to manage multiple cryptocurrency wallets and perform bulk operations like sending, swapping, transferring, and approving tokens.

## Features

- **Secure Wallet Management**: Create and import wallets with encrypted private keys stored in local storage
- **Master Password Protection**: All wallet private keys are encrypted with a user-defined master password
- **Bulk Operations**: Perform operations on multiple wallets simultaneously:
  - Send native tokens (ETH, BNB, etc.)
  - Transfer ERC20 tokens
  - Approve ERC20 tokens for spending
  - Execute custom transactions (for swaps or other complex operations)
- **Multi-Network Support**: Connect to various blockchain networks including Ethereum, BSC, Polygon, and more

## Project Structure

This project is organized as a monorepo using pnpm workspaces:

```
wallet-manager/
├── apps/
│   ├── frontend/       # Next.js frontend application
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── pages/       # Next.js pages
│   │   │   ├── styles/      # CSS styles
│   │   │   └── utils/       # Utility functions
│   │   ├── public/          # Static assets
│   │   ├── next.config.js   # Next.js configuration
│   │   └── package.json     # Frontend dependencies
│   └── backend/        # Backend service (future expansion)
├── packages/
│   └── common/         # Shared code (future expansion)
├── pnpm-workspace.yaml # Workspace configuration
└── package.json        # Root package.json
```

## Technology Stack

- **Frontend**: Next.js with Ant Design
- **Blockchain Interaction**: ethers.js
- **Encryption**: CryptoJS
- **Package Management**: pnpm with monorepo structure

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- pnpm (v7 or later)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/wallet-manager.git
   cd wallet-manager
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev:fe
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Building for Production

```bash
pnpm build:fe
```

The build output will be in the `apps/frontend/out` directory, which can be served by any static file server.

## Security Considerations

- All wallet private keys are encrypted using AES encryption with the user's master password
- Private keys are never stored in plain text
- The master password is never stored; it only exists in memory during the session
- Always use this application on a secure device and network

## License

MIT
