# Dinari Wallet - Chrome Extension

Official browser wallet for the Dinari Blockchain. Manage DNT (native token) and AFC (asset-backed token) directly from your Chrome browser.

## Features

- **Dual Token Support**: Manage both DNT and AFC tokens
- **Secure Key Management**: AES-256-GCM encryption with PBKDF2 key derivation
- **BIP39 Seed Phrases**: 12-word mnemonic backup
- **Transaction Management**: Send, receive, and view transaction history
- **Auto-Lock**: Automatic wallet locking after inactivity
- **RPC Configuration**: Connect to any Dinari blockchain node
- **Modern UI**: African-inspired design with dark theme

## Prerequisites

- Chrome browser (version 110+)
- Dinari blockchain node running (default: http://https://rpctiger-testnet.dinariblockchain.network:8545)
- Basic understanding of cryptocurrency wallets

## Installation

### Method 1: Developer Mode (Recommended for Testing)

1. **Clone or download the wallet files**

2. **Add required CDN libraries to `popup/popup.html`**
   
   Add these script tags in the `<head>` section:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/elliptic@6.5.4/dist/elliptic.min.js"></script>
   <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/bip39@3.1.0/dist/bip39.min.js"></script>
   ```

3. **Create placeholder icon files**
   
   Create 3 PNG files in `assets/icons/`:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)
   
   You can use any simple colored square images for testing.

4. **Load extension in Chrome**
   - Open Chrome
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `dinari-wallet` folder
   - The extension icon should appear in your toolbar

### Method 2: Production Build (Future)

Package as `.crx` file for Chrome Web Store distribution (not yet implemented).

## First Time Setup

### Option A: Create New Wallet

1. Click the Dinari extension icon
2. Click "Create New Wallet"
3. Enter a strong password (min 8 characters)
4. **IMPORTANT**: Write down your 12-word seed phrase
5. Verify the seed phrase by entering 3 random words
6. Your wallet is created!

**CRITICAL**: Store your seed phrase in a safe place. Anyone with your seed phrase can access your funds.

### Option B: Import Existing Wallet

1. Click the Dinari extension icon
2. Click "Import Existing Wallet"
3. Enter your 64-character hex private key
4. Create a new password for this browser
5. Your wallet is imported!

## Usage

### Viewing Balance

- DNT and AFC balances are displayed on the main screen
- Click the refresh button (↻) to update
- Current block height shows network status

### Receiving Tokens

1. Click the orange "Receive" button
2. Copy your address or share the QR code
3. Anyone can send DNT or AFC to this address

### Sending Tokens

1. Click the green "Send" button
2. Select token type (DNT or AFC)
3. Enter recipient address (starts with 'D')
4. Enter amount
5. Adjust fee if needed (default: 0.001 DNT)
6. Click "Review Transaction"
7. Verify details in confirmation modal
8. Enter your password to sign
9. Transaction sent!

**Note**: Fees are always paid in DNT, even when sending AFC.

### Transaction History

- View recent transactions on main screen
- Click "View All" for complete history with pagination
- Click any transaction to view details

### Settings

Access settings via the gear icon (⚙):

- **View Full Address**: Display complete wallet address
- **Export Private Key**: Export private key (requires password)
- **RPC Endpoint**: Change blockchain node URL
- **Lock Wallet**: Lock immediately
- **Clear Wallet Data**: Remove wallet (requires confirmation)

## Security

### Password Requirements

- Minimum 8 characters
- Recommended: Mix of uppercase, lowercase, numbers, and symbols
- Password is used to encrypt your private key

### Private Key Security

- Private keys are encrypted using AES-256-GCM
- Encryption key derived from password using PBKDF2 (100,000 iterations)
- Private keys never leave your browser
- Private keys are never transmitted over the network

### Auto-Lock

- Wallet automatically locks after 5 minutes of inactivity (configurable)
- Password required to unlock
- Session cleared on browser close

### Best Practices

1. **Never share your password** - It cannot be recovered if lost
2. **Never share your private key** - Anyone with it can steal your funds
3. **Back up your seed phrase** - Write it down and store securely offline
4. **Use a strong password** - Longer and more complex is better
5. **Verify addresses** - Always double-check recipient addresses
6. **Start with small amounts** - Test transactions with small amounts first

## Troubleshooting

### Wallet Not Connecting to Node

**Problem**: "Cannot connect to blockchain node" error

**Solutions**:
- Verify your node is running: `http://https://rpctiger-testnet.dinariblockchain.network:8545`
- Check RPC endpoint in Settings
- Test with curl: `curl -X POST http://https://rpctiger-testnet.dinariblockchain.network:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"chain_getHeight","params":{},"id":1}'`
- Check firewall settings

### Transaction Not Appearing

**Problem**: Sent transaction but not showing in history

**Causes**:
- Transaction still in mempool (not yet mined)
- Wait for next block to be mined
- Check transaction hash in node logs

**Solutions**:
- Refresh wallet after 30-60 seconds
- Check if transaction was rejected by mempool
- Verify sufficient balance for amount + fee

### Balance Shows Zero

**Problem**: Balance is 0 but you have funds

**Solutions**:
- Click refresh button (↻)
- Check if wallet address is correct
- Verify node is synchronized
- Check block height matches network

### Password Not Working

**Problem**: "Incorrect password" when unlocking

**Solutions**:
- Double-check password (case-sensitive)
- Try importing wallet using private key if you have it
- If password truly lost, wallet cannot be recovered (use seed phrase to restore)

### Extension Not Loading

**Problem**: Extension icon appears but clicking does nothing

**Solutions**:
- Reload extension: chrome://extensions/ → click reload icon
- Check browser console for errors (F12)
- Verify all files are present in extension folder
- Check that CDN scripts are loading (check Network tab)

## Development

### Project Structure

```
dinari-wallet/
├── manifest.json              # Extension configuration
├── popup/
│   ├── popup.html            # UI layout
│   ├── popup.js              # Main application logic
│   └── popup.css             # Styling
├── background/
│   └── service-worker.js     # Background tasks
├── lib/
│   ├── crypto.js             # Cryptography functions
│   ├── storage.js            # Encrypted storage
│   ├── rpc.js                # Blockchain communication
│   └── utils.js              # Helper functions
├── assets/
│   ├── icons/                # Extension icons
│   └── logo.svg              # Wallet logo
└── README.md                 # This file
```

### Adding Features

1. **New RPC Method**: Add to `lib/rpc.js`
2. **New Screen**: Add HTML to `popup/popup.html` and logic to `popup/popup.js`
3. **New Utility**: Add to `lib/utils.js`
4. **Styling**: Update `popup/popup.css`

### Testing

**Test with known values**:
- Private key: `f1b07e32f1f1bdaf5efa886e6511c91e187138905b3f96600304d8535fbefa6d`
- Address: `DFSVTrK1N53SeFiKKXRUVKCZKRvmA2xzoU`

**Test checklist**:
- [ ] Create new wallet
- [ ] Import wallet from private key
- [ ] View balance (DNT and AFC)
- [ ] Send DNT transaction
- [ ] Send AFC transaction
- [ ] View transaction history
- [ ] Copy address
- [ ] Lock/unlock wallet
- [ ] Auto-lock after 5 minutes
- [ ] Export private key
- [ ] Change RPC endpoint

## Technical Details

### Address Format

- Version byte: `0x1e` (30 decimal)
- Encoding: Base58Check
- Format: 1 version byte + 20 hash bytes + 4 checksum bytes
- All addresses start with 'D'

### Transaction Signing

- Algorithm: ECDSA with secp256k1
- Hash function: SHA-256
- Signature encoding: DER format
- Signature includes: from, to, amount, tokenType, feeDNT, nonce

### Token Denominations

- 1 DNT = 100,000,000 satoshis
- 1 AFC = 100,000,000 satoshis
- Maximum 8 decimal places

## Roadmap

- [ ] QR code generation for receive screen
- [ ] Multi-language support
- [ ] Transaction notes/labels
- [ ] Address book
- [ ] Hardware wallet integration
- [ ] Web3 provider for dApps
- [ ] Mobile version
- [ ] Token swap functionality

## Support

For issues, questions, or feature requests:

1. Check this README first
2. Review troubleshooting section
3. Check browser console for errors
4. Contact development team

## License

[Your License Here]

## Version History

### v1.0.0 (Current)
- Initial release
- Create/import wallet
- Send/receive DNT and AFC
- Transaction history
- Auto-lock security
- RPC configuration

## Disclaimer

This is beta software. Use at your own risk. Always test with small amounts first. Never share your private key or seed phrase. The developers are not responsible for any loss of funds.