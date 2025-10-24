/**
 * Dinari Wallet - Complete Popup Script
 * With all corrections integrated
 */

// Global state
let currentWallet = null;
let currentScreen = null;
let seedPhraseWords = [];
let verifyIndices = [];

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize RPC client
    await DinariRPC.initialize();
    
    // Check if wallet exists
    const walletExists = await DinariStorage.walletExists();
    
    if (!walletExists) {
      // No wallet - show welcome screen
      showScreen('welcomeScreen');
    } else {
      // Wallet exists - check session
      const sessionValid = await DinariStorage.isSessionValid();
      
      if (sessionValid) {
        // Session valid - go to main wallet
        await initializeWallet();
      } else {
        // Session expired - show login
        showScreen('loginScreen');
      }
    }
  } catch (error) {
    console.error('Initialization error:', error);
    DinariUtils.showToast('Failed to initialize wallet', 'error');
  }
});

/**
 * Show a specific screen and hide all others
 */
function showScreen(screenId) {
  // Hide all screens
  const screens = document.querySelectorAll('.container');
  screens.forEach(screen => screen.classList.add('hidden'));
  
  // Show requested screen
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.remove('hidden');
    currentScreen = screenId;
  }
}

// ============================================================================
// WELCOME SCREEN
// ============================================================================

document.getElementById('btnCreateWallet').addEventListener('click', () => {
  showScreen('createPasswordScreen');
});

document.getElementById('btnImportWallet').addEventListener('click', () => {
  showScreen('importWalletScreen');
});

// ============================================================================
// CREATE WALLET FLOW
// ============================================================================

// Step 1: Create Password
document.getElementById('createPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const password = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const errorEl = document.getElementById('passwordError');
  
  // Validate passwords match
  if (password !== confirmPassword) {
    errorEl.textContent = 'Passwords do not match';
    errorEl.classList.remove('hidden');
    return;
  }
  
  // Check password strength
  const strength = DinariUtils.validatePasswordStrength(password);
  if (!strength.strong) {
    errorEl.textContent = 'Password too weak. ' + strength.suggestions.join(', ');
    errorEl.classList.remove('hidden');
    return;
  }
  
  errorEl.classList.add('hidden');
  
  try {
    // Generate mnemonic seed phrase
    seedPhraseWords = DinariCrypto.generateMnemonic().split(' ');
    
    // Display seed phrase
    displaySeedPhrase();
    
    // Store password temporarily (we'll use it after verification)
    sessionStorage.setItem('tempPassword', password);
    
    showScreen('seedPhraseScreen');
  } catch (error) {
    console.error('Error generating seed phrase:', error);
    DinariUtils.showToast('Failed to generate seed phrase', 'error');
  }
});

document.getElementById('btnBackToWelcome').addEventListener('click', () => {
  document.getElementById('createPasswordForm').reset();
  showScreen('welcomeScreen');
});

// Step 2: Display Seed Phrase
function displaySeedPhrase() {
  const container = document.getElementById('seedPhraseDisplay');
  container.innerHTML = '';
  
  seedPhraseWords.forEach((word, index) => {
    const wordEl = document.createElement('div');
    wordEl.style.cssText = 'padding: 8px; background: hsl(var(--card)); border-radius: var(--radius-sm); border: 1px solid hsl(var(--border));';
    wordEl.innerHTML = `<span style="color: hsl(var(--foreground) / 0.5); font-size: 11px;">${index + 1}.</span> <span style="font-weight: 600;">${word}</span>`;
    container.appendChild(wordEl);
  });
}

document.getElementById('btnCopySeed').addEventListener('click', async () => {
  const seedPhrase = seedPhraseWords.join(' ');
  const success = await DinariUtils.copyToClipboard(seedPhrase);
  
  if (success) {
    DinariUtils.showToast('Seed phrase copied to clipboard', 'success');
  } else {
    DinariUtils.showToast('Failed to copy', 'error');
  }
});

document.getElementById('seedSavedCheckbox').addEventListener('change', (e) => {
  document.getElementById('btnVerifySeed').disabled = !e.target.checked;
});

document.getElementById('btnVerifySeed').addEventListener('click', () => {
  // Generate random indices to verify
  verifyIndices = [];
  while (verifyIndices.length < 3) {
    const index = Math.floor(Math.random() * 12);
    if (!verifyIndices.includes(index)) {
      verifyIndices.push(index);
    }
  }
  verifyIndices.sort((a, b) => a - b);
  
  // Display word numbers
  document.getElementById('verifyWord1Num').textContent = verifyIndices[0] + 1;
  document.getElementById('verifyWord2Num').textContent = verifyIndices[1] + 1;
  document.getElementById('verifyWord3Num').textContent = verifyIndices[2] + 1;
  
  showScreen('verifySeedScreen');
});

// Step 3: Verify Seed Phrase
document.getElementById('verifySeedForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const word1 = document.getElementById('verifyWord1').value.trim().toLowerCase();
  const word2 = document.getElementById('verifyWord2').value.trim().toLowerCase();
  const word3 = document.getElementById('verifyWord3').value.trim().toLowerCase();
  const errorEl = document.getElementById('verifyError');
  
  // Verify words
  const correct = 
    word1 === seedPhraseWords[verifyIndices[0]] &&
    word2 === seedPhraseWords[verifyIndices[1]] &&
    word3 === seedPhraseWords[verifyIndices[2]];
  
  if (!correct) {
    errorEl.classList.remove('hidden');
    return;
  }
  
  errorEl.classList.add('hidden');
  
  try {
    DinariUtils.showLoading('Creating wallet...');
    
    // Derive private key from mnemonic
    const mnemonic = seedPhraseWords.join(' ');
    const privateKey = DinariCrypto.mnemonicToPrivateKey(mnemonic);
    
    // Generate wallet from private key
    const wallet = DinariCrypto.importWallet(privateKey);
    
    // Get password from session storage
    const password = sessionStorage.getItem('tempPassword');
    
    // Save wallet to storage
    await DinariStorage.saveWallet({
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      address: wallet.address,
      seedPhrase: mnemonic
    }, password);
    
    // Clean up
    sessionStorage.removeItem('tempPassword');
    seedPhraseWords = [];
    verifyIndices = [];
    
    DinariUtils.hideLoading();
    DinariUtils.showToast('Wallet created successfully!', 'success');
    
    // Initialize and show main wallet
    await initializeWallet();
    
  } catch (error) {
    DinariUtils.hideLoading();
    console.error('Error creating wallet:', error);
    DinariUtils.showToast('Failed to create wallet: ' + error.message, 'error');
  }
});

// ============================================================================
// IMPORT WALLET FLOW
// ============================================================================

document.getElementById('importWalletForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const privateKey = document.getElementById('importPrivateKey').value.trim();
  const password = document.getElementById('importPassword').value;
  const confirmPassword = document.getElementById('importConfirmPassword').value;
  const errorEl = document.getElementById('importError');
  
  // Validate private key format
  if (!DinariUtils.validateHex(privateKey, 64)) {
    errorEl.textContent = 'Invalid private key format (must be 64 hex characters)';
    errorEl.classList.remove('hidden');
    return;
  }
  
  // Validate passwords match
  if (password !== confirmPassword) {
    errorEl.textContent = 'Passwords do not match';
    errorEl.classList.remove('hidden');
    return;
  }
  
  // Check password strength
  const strength = DinariUtils.validatePasswordStrength(password);
  if (!strength.strong) {
    errorEl.textContent = 'Password too weak. ' + strength.suggestions.join(', ');
    errorEl.classList.remove('hidden');
    return;
  }
  
  errorEl.classList.add('hidden');
  
  try {
    DinariUtils.showLoading('Importing wallet...');
    
    // Import wallet from private key
    const wallet = DinariCrypto.importWallet(privateKey);
    
    // Save to storage
    await DinariStorage.saveWallet({
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      address: wallet.address,
      seedPhrase: null // No seed phrase for imported wallets
    }, password);
    
    DinariUtils.hideLoading();
    DinariUtils.showToast('Wallet imported successfully!', 'success');
    
    // Initialize and show main wallet
    await initializeWallet();
    
  } catch (error) {
    DinariUtils.hideLoading();
    console.error('Error importing wallet:', error);
    DinariUtils.showToast('Failed to import wallet: ' + error.message, 'error');
  }
});

document.getElementById('btnBackToWelcomeFromImport').addEventListener('click', () => {
  document.getElementById('importWalletForm').reset();
  showScreen('welcomeScreen');
});

// ============================================================================
// LOGIN FLOW
// ============================================================================

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  
  try {
    DinariUtils.showLoading('Unlocking wallet...');
    
    // Verify password
    const valid = await DinariStorage.verifyPassword(password);
    
    if (!valid) {
      DinariUtils.hideLoading();
      errorEl.textContent = 'Incorrect password';
      errorEl.classList.remove('hidden');
      return;
    }
    
    errorEl.classList.add('hidden');
    
    // Load wallet
    const wallet = await DinariStorage.loadWallet(password);
    currentWallet = wallet;
    
    // Update session
    await DinariStorage.setSession(true);
    
    DinariUtils.hideLoading();
    
    // Show main wallet
    await initializeWallet();
    
  } catch (error) {
    DinariUtils.hideLoading();
    console.error('Login error:', error);
    errorEl.textContent = 'Failed to unlock wallet';
    errorEl.classList.remove('hidden');
  }
});

// ============================================================================
// INITIALIZE WALLET (UPDATED)
// ============================================================================

async function initializeWallet() {
  try {
    // Get wallet address from storage
    const address = await DinariStorage.getWalletAddress();
    
    if (!address) {
      throw new Error('Wallet address not found');
    }
    
    // Show main wallet screen
    showScreen('mainWalletScreen');
    
    // Ensure wallet tab is active by default
    showWalletTab();
    
    // Load wallet data
    await refreshWalletData();
    
    // Set up activity tracking
    setupActivityTracking();
    
  } catch (error) {
    console.error('Failed to initialize wallet:', error);
    DinariUtils.showToast('Failed to load wallet data', 'error');
    showScreen('loginScreen');
  }
}

// ============================================================================
// ACTIVITY TRACKING (AUTO-LOCK)
// ============================================================================

function setupActivityTracking() {
  // Update activity on any user interaction
  const events = ['click', 'keypress', 'mousemove', 'scroll'];
  
  const updateActivity = DinariUtils.debounce(async () => {
    await DinariStorage.updateActivity();
  }, 1000);
  
  events.forEach(event => {
    document.addEventListener(event, updateActivity);
  });
  
  // Check session validity periodically
  setInterval(async () => {
    const valid = await DinariStorage.isSessionValid();
    if (!valid && currentScreen !== 'loginScreen') {
      // Session expired - lock wallet
      await lockWallet();
    }
  }, 10000); // Check every 10 seconds
}

async function lockWallet() {
  await DinariStorage.lockWallet();
  currentWallet = null;
  DinariUtils.showToast('Wallet locked due to inactivity', 'info');
  showScreen('loginScreen');
}

// ============================================================================
// MAIN WALLET SCREEN
// ============================================================================

let currentBalance = { dnt: 0, afc: 0, nonce: 0 };
let recentTransactions = [];

/**
 * Refresh all wallet data
 */
async function refreshWalletData() {
  try {
    const address = await DinariStorage.getWalletAddress();
    
    // Update address display
    document.getElementById('walletAddress').textContent = DinariRPC.truncateAddress(address);
    document.getElementById('receiveAddress').value = address;
    
    // Load balance
    await updateBalance();
    
    // Load block height
    await updateBlockHeight();
    
    // Load recent transactions
    await updateRecentTransactions();
    
  } catch (error) {
    console.error('Failed to refresh wallet data:', error);
    DinariUtils.showToast('Failed to load wallet data', 'error');
  }
}

/**
 * Update balance display
 */
async function updateBalance() {
  try {
    const address = await DinariStorage.getWalletAddress();
    const balanceData = await DinariRPC.getBalance(address);
    currentBalance = DinariRPC.formatBalance(balanceData);
    
    // Update individual token balances
    document.getElementById('dntBalance').textContent = DinariUtils.formatNumber(currentBalance.dnt, 2);
    document.getElementById('afcBalance').textContent = DinariUtils.formatNumber(currentBalance.afc, 2);
    
    // Calculate total value
    const totalValue = currentBalance.dnt + currentBalance.afc;
    document.getElementById('totalBalance').textContent = DinariUtils.formatNumber(totalValue, 2);
    
    // Estimate USD value
    const usdValue = DinariUtils.estimateUSDValue(currentBalance.dnt, currentBalance.afc);
    document.getElementById('totalBalanceUSD').textContent = '≈ $' + DinariUtils.formatNumber(usdValue, 2);
    
  } catch (error) {
    console.error('Failed to update balance:', error);
    document.getElementById('dntBalance').textContent = 'Error';
    document.getElementById('afcBalance').textContent = 'Error';
  }
}

/**
 * Update block height
 */
async function updateBlockHeight() {
  try {
    const height = await DinariRPC.getBlockHeight();
    document.getElementById('blockHeight').textContent = DinariUtils.formatNumber(height, 0);
  } catch (error) {
    console.error('Failed to update block height:', error);
    document.getElementById('blockHeight').textContent = 'Offline';
  }
}

/**
 * Update recent transactions list
 */
async function updateRecentTransactions() {
  try {
    const address = await DinariStorage.getWalletAddress();

    // Get both pending (mempool) and confirmed (blockchain) transactions
    const [pendingData, historyData] = await Promise.all([
      DinariRPC.getTransactionsByWallet(address, 10).catch(() => ({ transactions: [] })),
      DinariRPC.getTransactionHistory(address, 10).catch(() => ({ transactions: [] }))
    ]);

    const pendingTxs = pendingData.transactions || [];
    const confirmedTxs = historyData.transactions || [];

    // Merge and sort by timestamp (newest first)
    const allTxs = [...pendingTxs, ...confirmedTxs];
    allTxs.sort((a, b) => b.timestamp - a.timestamp);

    // Take only the 5 most recent
    recentTransactions = allTxs.slice(0, 5);

    const listEl = document.getElementById('recentTxList');
    listEl.innerHTML = '';

    if (recentTransactions.length === 0) {
      listEl.innerHTML = '<div class="text-center text-muted" style="padding: 32px;">No transactions yet</div>';
      return;
    }

    recentTransactions.forEach(tx => {
      const txEl = createTransactionElement(tx, address);
      listEl.appendChild(txEl);
    });

  } catch (error) {
    console.error('Failed to load transactions:', error);
    const listEl = document.getElementById('recentTxList');
    listEl.innerHTML = '<div class="text-center text-muted" style="padding: 32px;">Failed to load transactions</div>';
  }
}

/**
 * Create transaction list item element
 */
function createTransactionElement(tx, userAddress) {
  const type = DinariRPC.getTransactionType(tx, userAddress);
  const formattedTx = DinariRPC.formatTransaction(tx);
  
  const txEl = document.createElement('div');
  txEl.className = 'tx-item';
  txEl.onclick = () => showTransactionDetail(tx);
  
  // Icon
  const iconEl = document.createElement('div');
  iconEl.className = `tx-icon ${type}`;
  
  if (type === 'sent') {
    iconEl.textContent = '↗';
  } else if (type === 'received') {
    iconEl.textContent = '↙';
  } else {
    iconEl.textContent = '⛏';
  }
  
  // Details
  const detailsEl = document.createElement('div');
  detailsEl.className = 'tx-details';
  
  const addressToShow = type === 'sent' ? tx.to : tx.from;
  const addressEl = document.createElement('div');
  addressEl.className = 'tx-address';
  addressEl.textContent = type === 'mined' ? 'Block Reward' : DinariRPC.truncateAddress(addressToShow);
  
  const timestampEl = document.createElement('div');
  timestampEl.className = 'tx-timestamp';
  timestampEl.textContent = DinariRPC.formatTimestamp(tx.timestamp);
  
  detailsEl.appendChild(addressEl);
  detailsEl.appendChild(timestampEl);
  
  // Amount
  const amountEl = document.createElement('div');
  amountEl.className = 'tx-amount';
  
  const sign = type === 'sent' ? '-' : '+';
  const amountText = document.createElement('div');
  amountText.textContent = `${sign}${DinariUtils.formatNumber(formattedTx.amount, 2)} ${tx.tokenType}`;
  amountText.style.color = type === 'sent' ? 'hsl(var(--destructive))' : 'hsl(var(--african-green))';
  
  amountEl.appendChild(amountText);
  
  txEl.appendChild(iconEl);
  txEl.appendChild(detailsEl);
  txEl.appendChild(amountEl);
  
  return txEl;
}

/**
 * Show transaction detail modal
 */
async function showTransactionDetail(tx) {
  const userAddress = await DinariStorage.getWalletAddress();
  const type = DinariRPC.getTransactionType(tx, userAddress);
  const formattedTx = DinariRPC.formatTransaction(tx);
  
  // Create transaction detail modal
  const modalHTML = `
    <div class="modal-overlay" id="txDetailModal" style="display: flex;">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">Transaction Details</h3>
          <button class="modal-close" data-close-modal="txDetailModal">&times;</button>
        </div>
        <div>
          <div class="glass-card" style="font-size: 13px; margin-bottom: 16px;">
            <div style="margin-bottom: 12px;">
              <div class="text-muted text-xs">Type</div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <span class="tx-icon ${type}" style="width: 24px; height: 24px; font-size: 12px;">
                  ${type === 'sent' ? '↗' : type === 'received' ? '↙' : '⛏'}
                </span>
                <span style="text-transform: capitalize; font-weight: 600;">${type}</span>
              </div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div class="text-muted text-xs">Hash</div>
              <div style="font-family: monospace; font-size: 11px; word-break: break-all; margin-top: 4px;">${tx.hash}</div>
              <button data-copy-text="${tx.hash}" class="btn btn-ghost copy-btn" style="padding: 4px 8px; font-size: 11px; margin-top: 4px;">Copy Hash</button>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div class="text-muted text-xs">From</div>
              <div style="font-family: monospace; font-size: 11px; word-break: break-all; margin-top: 4px;">${tx.from}</div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div class="text-muted text-xs">To</div>
              <div style="font-family: monospace; font-size: 11px; word-break: break-all; margin-top: 4px;">${tx.to}</div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div class="text-muted text-xs">Amount</div>
              <div style="font-size: 20px; font-weight: 700; margin-top: 4px; color: ${type === 'sent' ? 'hsl(var(--destructive))' : 'hsl(var(--african-green))'};">
                ${type === 'sent' ? '-' : '+'}${DinariUtils.formatNumber(formattedTx.amount, 2)} ${tx.tokenType}
              </div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div class="text-muted text-xs">Fee</div>
              <div style="margin-top: 4px;">${DinariUtils.formatNumber(formattedTx.fee, 8)} DNT</div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div class="text-muted text-xs">Timestamp</div>
              <div style="margin-top: 4px;">${new Date(tx.timestamp * 1000).toLocaleString()}</div>
              <div class="text-muted text-xs">${DinariRPC.formatTimestamp(tx.timestamp)}</div>
            </div>
            
            ${tx.nonce !== undefined ? `
            <div>
              <div class="text-muted text-xs">Nonce</div>
              <div style="margin-top: 4px;">${tx.nonce}</div>
            </div>
            ` : ''}
          </div>
          
          <button data-close-modal="txDetailModal" class="btn btn-secondary w-full">Close</button>
        </div>
      </div>
    </div>
  `;
  
  // Append to body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Add event listeners for this specific modal
  const modal = document.getElementById('txDetailModal');
  
  // Close buttons
  modal.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.remove();
    });
  });
  
  // Copy buttons
  modal.querySelectorAll('[data-copy-text]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy-text');
      await navigator.clipboard.writeText(text);
      DinariUtils.showToast('Hash copied', 'success');
    });
  });
  
  // Click overlay to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Event Listeners for Main Wallet Screen

document.getElementById('btnRefreshBalance').addEventListener('click', async () => {
  DinariUtils.showLoading('Refreshing...');
  await refreshWalletData();
  DinariUtils.hideLoading();
  DinariUtils.showToast('Wallet refreshed', 'success');
});

document.getElementById('btnSettings').addEventListener('click', () => {
  showScreen('settingsScreen');
  loadSettings();
});

document.getElementById('btnSend').addEventListener('click', () => {
  showScreen('sendScreen');
  initializeSendScreen();
});

document.getElementById('btnReceive').addEventListener('click', () => {
  showScreen('receiveScreen');
  initializeReceiveScreen();
});

document.getElementById('btnViewAllTx').addEventListener('click', () => {
  showScreen('transactionHistoryScreen');
  loadTransactionHistory();
});

document.getElementById('btnCopyAddress').addEventListener('click', async () => {
  const address = await DinariStorage.getWalletAddress();
  const success = await DinariUtils.copyToClipboard(address);
  
  if (success) {
    DinariUtils.showToast('Address copied', 'success');
  } else {
    DinariUtils.showToast('Failed to copy', 'error');
  }
});

// Auto-refresh wallet data every 30 seconds
setInterval(async () => {
  if (currentScreen === 'mainWalletScreen') {
    await updateBalance();
    await updateBlockHeight();
    await updateRecentTransactions();
  }
}, 30000);

// ============================================================================
// BOTTOM NAVIGATION (NEW)
// ============================================================================

// Bottom Navigation Tab Switching
document.getElementById('btnNavWallet').addEventListener('click', () => {
  showWalletTab();
});

document.getElementById('btnNavDapps').addEventListener('click', () => {
  showDappsTab();
});

function showWalletTab() {
  document.getElementById('walletTabContent').style.display = 'block';
  document.getElementById('dappsTabContent').style.display = 'none';
  
  // Update tab styles
  const walletTab = document.getElementById('btnNavWallet');
  const dappsTab = document.getElementById('btnNavDapps');
  
  walletTab.classList.add('active');
  walletTab.style.opacity = '1';
  dappsTab.classList.remove('active');
  dappsTab.style.opacity = '0.5';
}

function showDappsTab() {
  document.getElementById('walletTabContent').style.display = 'none';
  document.getElementById('dappsTabContent').style.display = 'block';
  
  // Update tab styles
  const walletTab = document.getElementById('btnNavWallet');
  const dappsTab = document.getElementById('btnNavDapps');
  
  walletTab.classList.remove('active');
  walletTab.style.opacity = '0.5';
  dappsTab.classList.add('active');
  dappsTab.style.opacity = '1';
}

// ============================================================================
// RECEIVE SCREEN
// ============================================================================

async function initializeReceiveScreen() {
  const address = await DinariStorage.getWalletAddress();
  const qrContainer = document.getElementById('qrCodeContainer');
  
  // Clear previous QR code
  qrContainer.innerHTML = '';
  
  // Generate QR code
  try {
    new QRCode(qrContainer, {
      text: address,
      width: 200,
      height: 200,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    // Fallback to text display
    qrContainer.innerHTML = `
      <div style="width: 200px; height: 200px; background: white; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; color: #000; font-size: 12px; padding: 20px; word-break: break-all;">
        ${address}
      </div>
    `;
  }
}

document.getElementById('btnBackToMainFromReceive').addEventListener('click', () => {
  showScreen('mainWalletScreen');
});

document.getElementById('btnBackToMainFromReceiveBtn').addEventListener('click', () => {
  showScreen('mainWalletScreen');
});

document.getElementById('btnCopyReceiveAddress').addEventListener('click', async () => {
  const address = document.getElementById('receiveAddress').value;
  const success = await DinariUtils.copyToClipboard(address);
  
  if (success) {
    DinariUtils.showToast('Address copied', 'success');
  } else {
    DinariUtils.showToast('Failed to copy', 'error');
  }
});

// ============================================================================
// TRANSACTION HISTORY SCREEN
// ============================================================================

let currentPage = 1;
let totalPages = 1;
let allTransactions = [];

async function loadTransactionHistory(page = 1) {
  try {
    DinariUtils.showLoading('Loading transactions...');
    
    const address = await DinariStorage.getWalletAddress();
    const txData = await DinariRPC.getTransactionsByWallet(address, page, 10);
    
    allTransactions = txData.transactions || [];
    currentPage = txData.page;
    totalPages = Math.ceil(txData.total / 10);
    
    const listEl = document.getElementById('txHistoryList');
    listEl.innerHTML = '';
    
    if (allTransactions.length === 0) {
      listEl.innerHTML = '<div class="text-center text-muted" style="padding: 32px;">No transactions found</div>';
      DinariUtils.hideLoading();
      return;
    }
    
    allTransactions.forEach(tx => {
      const txEl = createTransactionElement(tx, address);
      listEl.appendChild(txEl);
    });
    
    // Update pagination
    updatePagination(txData);
    
    DinariUtils.hideLoading();
    
  } catch (error) {
    console.error('Failed to load transaction history:', error);
    DinariUtils.hideLoading();
    DinariUtils.showToast('Failed to load transactions', 'error');
  }
}

function updatePagination(txData) {
  const paginationEl = document.getElementById('txPagination');
  const currentPageEl = document.getElementById('currentPage');
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');
  
  if (txData.total <= 10) {
    paginationEl.classList.add('hidden');
    return;
  }
  
  paginationEl.classList.remove('hidden');
  currentPageEl.textContent = txData.page;
  
  prevBtn.disabled = txData.page === 1;
  nextBtn.disabled = !txData.hasMore;
}

document.getElementById('btnBackToMainFromHistory').addEventListener('click', () => {
  showScreen('mainWalletScreen');
});

document.getElementById('btnPrevPage').addEventListener('click', () => {
  if (currentPage > 1) {
    loadTransactionHistory(currentPage - 1);
  }
});

document.getElementById('btnNextPage').addEventListener('click', () => {
  loadTransactionHistory(currentPage + 1);
});

// ============================================================================
// SETTINGS SCREEN
// ============================================================================

async function loadSettings() {
  try {
    const settings = await DinariStorage.getSettings();
    document.getElementById('rpcEndpoint').value = settings.rpc_endpoint;
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

document.getElementById('btnBackToMainFromSettings').addEventListener('click', () => {
  showScreen('mainWalletScreen');
});

// ============================================================================
// VIEW FULL ADDRESS SCREEN (NEW - REPLACES OLD ALERT)
// ============================================================================

document.getElementById('btnViewAddress').addEventListener('click', async () => {
  const address = await DinariStorage.getWalletAddress();
  document.getElementById('fullAddressDisplay').textContent = address;
  showScreen('viewAddressScreen');
});

document.getElementById('btnBackToSettingsFromAddress').addEventListener('click', () => {
  showScreen('settingsScreen');
});

document.getElementById('btnBackToSettingsFromAddressBtn').addEventListener('click', () => {
  showScreen('settingsScreen');
});

document.getElementById('btnCopyFullAddress').addEventListener('click', async () => {
  const address = document.getElementById('fullAddressDisplay').textContent;
  const success = await DinariUtils.copyToClipboard(address);
  
  if (success) {
    DinariUtils.showToast('Address copied', 'success');
  } else {
    DinariUtils.showToast('Failed to copy', 'error');
  }
});

// ============================================================================
// EXPORT PRIVATE KEY SCREENS (NEW - REPLACES OLD PROMPT/ALERT)
// ============================================================================

document.getElementById('btnExportKey').addEventListener('click', () => {
  showScreen('exportKeyPasswordScreen');
  document.getElementById('exportKeyPasswordForm').reset();
  document.getElementById('exportKeyPasswordError').classList.add('hidden');
});

document.getElementById('btnBackToSettingsFromExport').addEventListener('click', () => {
  showScreen('settingsScreen');
});

document.getElementById('btnCancelExportKey').addEventListener('click', () => {
  showScreen('settingsScreen');
});

// Export Key Password Form Submission
document.getElementById('exportKeyPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const password = document.getElementById('exportKeyPassword').value;
  const errorEl = document.getElementById('exportKeyPasswordError');
  
  try {
    DinariUtils.showLoading('Decrypting wallet...');
    
    const wallet = await DinariStorage.loadWallet(password);
    
    DinariUtils.hideLoading();
    
    // Show private key on display screen
    document.getElementById('privateKeyDisplay').textContent = wallet.privateKey;
    showScreen('exportKeyDisplayScreen');
    
  } catch (error) {
    DinariUtils.hideLoading();
    console.error('Failed to decrypt wallet:', error);
    errorEl.textContent = 'Incorrect password';
    errorEl.classList.remove('hidden');
  }
});

document.getElementById('btnBackToSettingsFromKeyDisplay').addEventListener('click', () => {
  // Clear private key from display for security
  document.getElementById('privateKeyDisplay').textContent = '';
  showScreen('settingsScreen');
});

document.getElementById('btnDoneExportKey').addEventListener('click', () => {
  // Clear private key from display for security
  document.getElementById('privateKeyDisplay').textContent = '';
  showScreen('settingsScreen');
});

document.getElementById('btnCopyPrivateKey').addEventListener('click', async () => {
  const privateKey = document.getElementById('privateKeyDisplay').textContent;
  const success = await DinariUtils.copyToClipboard(privateKey);
  
  if (success) {
    DinariUtils.showToast('Private key copied - Keep it safe!', 'success');
  } else {
    DinariUtils.showToast('Failed to copy', 'error');
  }
});

// ============================================================================
// OTHER SETTINGS HANDLERS
// ============================================================================

document.getElementById('btnSaveRPC').addEventListener('click', async () => {
  const endpoint = document.getElementById('rpcEndpoint').value.trim();
  
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    DinariUtils.showToast('Invalid RPC endpoint', 'error');
    return;
  }
  
  try {
    await DinariStorage.saveSettings({ rpc_endpoint: endpoint });
    DinariRPC.setEndpoint(endpoint);
    
    // Test connection
    const connected = await DinariRPC.testConnection();
    
    if (connected) {
      DinariUtils.showToast('RPC endpoint updated and connected', 'success');
    } else {
      DinariUtils.showToast('RPC endpoint saved but cannot connect', 'error');
    }
  } catch (error) {
    DinariUtils.showToast('Failed to save settings', 'error');
  }
});

document.getElementById('btnLockWallet').addEventListener('click', async () => {
  await lockWallet();
});

document.getElementById('btnClearWallet').addEventListener('click', async () => {
  const confirm1 = window.confirm(
    '⚠️ WARNING ⚠️\n\n' +
    'This will delete all wallet data from this browser.\n' +
    'Make sure you have backed up your seed phrase or private key.\n\n' +
    'Continue?'
  );
  
  if (!confirm1) return;
  
  const confirm2 = window.confirm(
    'Are you absolutely sure?\n\n' +
    'This action CANNOT be undone.\n' +
    'You will lose access to your funds if you haven\'t backed up your wallet.'
  );
  
  if (!confirm2) return;
  
  try {
    await DinariStorage.clearWallet();
    currentWallet = null;
    DinariUtils.showToast('Wallet data cleared', 'info');
    showScreen('welcomeScreen');
  } catch (error) {
    DinariUtils.showToast('Failed to clear wallet', 'error');
  }
});

// ============================================================================
// SEND TRANSACTION SCREEN
// ============================================================================

let pendingTransaction = null;

function initializeSendScreen() {
  // Reset form
  document.getElementById('sendForm').reset();
  
  // Set default values
  document.getElementById('sendTokenType').value = 'DNT';
  document.getElementById('sendFee').value = '0.001';
  
  // Update available balance
  updateAvailableBalance();
  
  // Hide errors
  document.getElementById('recipientError').classList.add('hidden');
}

/**
 * Update available balance display based on selected token
 */
function updateAvailableBalance() {
  const tokenType = document.getElementById('sendTokenType').value;
  const availableBalanceEl = document.getElementById('availableBalance');
  const availableTokenEl = document.getElementById('availableToken');
  
  if (tokenType === 'DNT') {
    availableBalanceEl.textContent = DinariUtils.formatNumber(currentBalance.dnt, 8);
  } else {
    availableBalanceEl.textContent = DinariUtils.formatNumber(currentBalance.afc, 8);
  }
  
  availableTokenEl.textContent = tokenType;
  updateTransactionCost();
}

/**
 * Update total cost calculation
 */
function updateTransactionCost() {
  const amount = parseFloat(document.getElementById('sendAmount').value) || 0;
  const fee = parseFloat(document.getElementById('sendFee').value) || 0;
  const tokenType = document.getElementById('sendTokenType').value;
  
  const cost = DinariRPC.calculateTransactionCost(amount, fee, tokenType);
  
  document.getElementById('totalCost').textContent = 
    DinariUtils.formatTokenAmount(cost.total, tokenType);
  document.getElementById('networkFee').textContent = 
    DinariUtils.formatTokenAmount(fee, 'DNT');
}

// Event listeners for send screen

document.getElementById('sendTokenType').addEventListener('change', () => {
  updateAvailableBalance();
});

document.getElementById('sendAmount').addEventListener('input', () => {
  updateTransactionCost();
});

document.getElementById('sendFee').addEventListener('input', () => {
  updateTransactionCost();
});

document.getElementById('btnMaxAmount').addEventListener('click', () => {
  const tokenType = document.getElementById('sendTokenType').value;
  const fee = parseFloat(document.getElementById('sendFee').value) || 0;
  
  let maxAmount;
  if (tokenType === 'DNT') {
    // For DNT, subtract the fee
    maxAmount = Math.max(0, currentBalance.dnt - fee);
  } else {
    // For AFC, can send all (fee is in DNT)
    maxAmount = currentBalance.afc;
  }
  
  document.getElementById('sendAmount').value = maxAmount.toFixed(8);
  updateTransactionCost();
});

document.getElementById('btnBackToMain').addEventListener('click', () => {
  showScreen('mainWalletScreen');
});

document.getElementById('btnCancelSend').addEventListener('click', () => {
  showScreen('mainWalletScreen');
});

// Send form submission
document.getElementById('sendForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const recipient = document.getElementById('sendRecipient').value.trim();
  const amount = parseFloat(document.getElementById('sendAmount').value);
  const tokenType = document.getElementById('sendTokenType').value;
  const fee = parseFloat(document.getElementById('sendFee').value);
  
  const recipientError = document.getElementById('recipientError');
  recipientError.classList.add('hidden');
  
  // Validate recipient address
  if (!DinariCrypto.validateAddress(recipient)) {
    recipientError.textContent = 'Invalid recipient address format';
    recipientError.classList.remove('hidden');
    return;
  }
  
  // Validate amount
  const amountValidation = DinariUtils.validateAmount(amount);
  if (!amountValidation.valid) {
    recipientError.textContent = amountValidation.error;
    recipientError.classList.remove('hidden');
    return;
  }
  
  // Validate fee
  const feeValidation = DinariUtils.validateAmount(fee);
  if (!feeValidation.valid) {
    recipientError.textContent = 'Invalid fee: ' + feeValidation.error;
    recipientError.classList.remove('hidden');
    return;
  }
  
  // Validate sufficient balance
  const validation = DinariRPC.validateTransaction(
    recipient,
    amount,
    fee,
    currentBalance,
    tokenType
  );
  
  if (!validation.valid) {
    recipientError.textContent = validation.error;
    recipientError.classList.remove('hidden');
    return;
  }
  
  // Store pending transaction
  const address = await DinariStorage.getWalletAddress();
  pendingTransaction = {
    from: address,
    to: recipient,
    amount: amount,
    tokenType: tokenType,
    fee: fee
  };
  
  // Show confirmation modal
  showTransactionConfirmation();
});

// ============================================================================
// TRANSACTION CONFIRMATION MODAL
// ============================================================================

function showTransactionConfirmation() {
  const modal = document.getElementById('txConfirmModal');
  
  // Populate confirmation details
  document.getElementById('confirmFrom').textContent = 
    DinariRPC.truncateAddress(pendingTransaction.from, 8, 8);
  document.getElementById('confirmTo').textContent = 
    DinariRPC.truncateAddress(pendingTransaction.to, 8, 8);
  document.getElementById('confirmAmount').textContent = 
    DinariUtils.formatTokenAmount(pendingTransaction.amount, pendingTransaction.tokenType);
  document.getElementById('confirmFee').textContent = 
    DinariUtils.formatTokenAmount(pendingTransaction.fee, 'DNT');
  
  const cost = DinariRPC.calculateTransactionCost(
    pendingTransaction.amount,
    pendingTransaction.fee,
    pendingTransaction.tokenType
  );
  
  document.getElementById('confirmTotal').textContent = 
    DinariUtils.formatTokenAmount(cost.total, pendingTransaction.tokenType) + 
    (pendingTransaction.tokenType === 'AFC' ? ' + ' + DinariUtils.formatTokenAmount(cost.totalDNT, 'DNT') : '');
  
  modal.classList.remove('hidden');
}

document.getElementById('btnCloseTxConfirm').addEventListener('click', () => {
  document.getElementById('txConfirmModal').classList.add('hidden');
});

document.getElementById('btnCancelTxConfirm').addEventListener('click', () => {
  document.getElementById('txConfirmModal').classList.add('hidden');
  pendingTransaction = null;
});

document.getElementById('btnConfirmSend').addEventListener('click', async () => {
  if (!pendingTransaction) return;
  
  try {
    // Hide confirmation modal
    document.getElementById('txConfirmModal').classList.add('hidden');
    
    DinariUtils.showLoading('Signing and sending transaction...');
    
    // Load wallet to get private key
    const password = prompt('Enter your password to sign the transaction:');
    if (!password) {
      DinariUtils.hideLoading();
      return;
    }
    
    const wallet = await DinariStorage.loadWallet(password);
    
    // Convert amounts to satoshis
    const amountSatoshis = DinariRPC.tokensToSatoshis(pendingTransaction.amount);
    const feeSatoshis = DinariRPC.tokensToSatoshis(pendingTransaction.fee);
    
    // Send transaction
    const txHash = await DinariRPC.buildAndSendTransaction(
      pendingTransaction.from,
      pendingTransaction.to,
      amountSatoshis,
      pendingTransaction.tokenType,
      feeSatoshis,
      wallet.privateKey
    );
    
    DinariUtils.hideLoading();
    
    // Show success modal
    showTransactionSuccess(txHash);
    
    // Refresh balance after a short delay
    setTimeout(async () => {
      await updateBalance();
    }, 2000);
    
  } catch (error) {
    DinariUtils.hideLoading();
    console.error('Transaction error:', error);
    
    if (error.message.includes('Decryption failed')) {
      DinariUtils.showToast('Incorrect password', 'error');
    } else {
      DinariUtils.showToast('Transaction failed: ' + error.message, 'error');
    }
  }
});

// ============================================================================
// TRANSACTION SUCCESS MODAL
// ============================================================================

function showTransactionSuccess(txHash) {
  const modal = document.getElementById('txSuccessModal');
  document.getElementById('txHash').textContent = txHash;
  modal.classList.remove('hidden');
  
  // Clear pending transaction
  pendingTransaction = null;
}

document.getElementById('btnCloseTxSuccess').addEventListener('click', () => {
  document.getElementById('txSuccessModal').classList.add('hidden');
  showScreen('mainWalletScreen');
});

document.getElementById('btnCopyTxHash').addEventListener('click', async () => {
  const txHash = document.getElementById('txHash').textContent;
  const success = await DinariUtils.copyToClipboard(txHash);
  
  if (success) {
    DinariUtils.showToast('Transaction hash copied', 'success');
  } else {
    DinariUtils.showToast('Failed to copy', 'error');
  }
});

document.getElementById('btnViewInHistory').addEventListener('click', () => {
  document.getElementById('txSuccessModal').classList.add('hidden');
  showScreen('transactionHistoryScreen');
  loadTransactionHistory();
});

// ============================================================================
// KEYBOARD SHORTCUTS & ERROR HANDLING
// ============================================================================

document.addEventListener('keydown', (e) => {
  // ESC key to close modals
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.classList.add('hidden');
    });
  }
});

// Fix modal close buttons
document.addEventListener('click', function(e) {
  // Close modals when clicking X button or overlay
  if (e.target.classList.contains('modal-close') || e.target.classList.contains('modal-overlay')) {
    const modal = e.target.closest('.modal-overlay');
    if (modal) {
      modal.classList.add('hidden');
    }
  }
});

window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  DinariUtils.showToast('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
  DinariUtils.showToast('An unexpected error occurred', 'error');
});

console.log('Dinari Wallet initialized successfully');