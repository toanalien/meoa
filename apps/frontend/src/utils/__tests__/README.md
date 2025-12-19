# SUI Blockchain Testing Suite

## Overview

This directory contains comprehensive test suites for the SUI blockchain integration, including unit tests, integration tests, and end-to-end tests.

## Test Files

### 1. `suiWalletUtils.test.ts`
Unit tests for SUI wallet utilities covering:
- ✅ Wallet generation
- ✅ Wallet creation from private keys
- ✅ Wallet creation from mnemonics
- ✅ Wallet encryption/decryption
- ✅ Input validation and detection
- ✅ Multi-account derivation

### 2. `suiBlockchainUtils.test.ts`
Unit tests for SUI blockchain operations:
- ✅ Network configurations
- ✅ Explorer URL generation
- ✅ SUI/MIST conversions
- ✅ Balance checking
- ✅ Single transfers
- ✅ Bulk operations
- ✅ Transaction queries

### 3. `sui-e2e.test.ts`
End-to-end integration tests simulating real-world workflows:
- ✅ Complete wallet lifecycle (create → encrypt → decrypt)
- ✅ Multi-wallet bulk operations
- ✅ Mixed input imports (mnemonic + private key)
- ✅ Multi-account derivation from single mnemonic
- ✅ Transaction and explorer integration
- ✅ Amount conversion and precision
- ✅ Error handling and edge cases
- ✅ Full user journey simulation

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test suiWalletUtils
npm test suiBlockchainUtils
npm test sui-e2e
```

## Test Coverage

The test suite covers:

### Wallet Operations
- Random wallet generation
- Deterministic wallet creation from seeds
- Private key import (base64 and hex formats)
- Mnemonic phrase import (12 and 24 words)
- Wallet encryption with AES
- Wallet decryption with password verification
- Multi-account HD derivation

### Blockchain Operations
- Balance queries across different networks
- Token transfers with gas budget
- Bulk transfer operations
- Bulk balance checking
- Transaction tracking
- Explorer URL generation
- SUI ↔ MIST conversions

### Integration Scenarios
- User registration flow
- Wallet backup and restore
- Multi-wallet management
- Batch transactions
- Error recovery
- Network switching

## Mocked Dependencies

The tests use Jest mocks for:
- `@mysten/sui.js/client` - SUI blockchain client
- `@mysten/sui.js/transactions` - Transaction building
- Network requests to SUI nodes

This allows tests to run quickly without actual blockchain interaction.

## Test Data

### Test Mnemonic
```
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
```

This is a standard BIP39 test mnemonic used across cryptocurrency wallets.

### Expected Behaviors

1. **Wallet Addresses**: Should match pattern `^0x[a-fA-F0-9]{64}$`
2. **Transaction Hashes**: Should match pattern `^0x[a-fA-F0-9]+$`
3. **Balance Format**: Should be in SUI with 9 decimal places
4. **Encryption**: Should produce different ciphertexts for same input

## Adding New Tests

When adding new SUI features:

1. Add unit tests in the appropriate test file
2. Add integration tests in `sui-e2e.test.ts`
3. Update this README with new test coverage
4. Ensure all tests pass before committing

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:
- No external dependencies required
- All blockchain interactions are mocked
- Fast execution (< 30 seconds for full suite)
- Deterministic results

## Troubleshooting

### Tests fail with "Cannot find module"
```bash
npm install
```

### Tests timeout
Increase Jest timeout in `jest.config.js`:
```javascript
testTimeout: 10000
```

### Mock not working
Clear Jest cache:
```bash
npm test -- --clearCache
```

## Best Practices

1. ✅ Keep tests isolated and independent
2. ✅ Use descriptive test names
3. ✅ Test both success and failure cases
4. ✅ Mock external dependencies
5. ✅ Verify error messages and edge cases
6. ✅ Update tests when code changes

## Related Documentation

- [SUI Documentation](https://docs.sui.io/)
- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
