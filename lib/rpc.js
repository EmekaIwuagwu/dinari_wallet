/**
 * Dinari Wallet - RPC Client
 * Handles all communication with the blockchain node
 */

const DinariRPC = (function() {
  'use strict';

  let rpcEndpoint = 'https://rpctiger-testnet.dinariblockchain.network';
  let requestId = 1;

  /**
   * Initialize RPC client with endpoint from storage
   * @returns {Promise<void>}
   */
  async function initialize() {
    try {
      rpcEndpoint = await DinariStorage.getRPCEndpoint();
    } catch (error) {
      console.warn('Failed to load RPC endpoint, using default:', error);
    }
  }

  /**
   * Make a JSON-RPC 2.0 request
   * @param {string} method - RPC method name
   * @param {Object} params - Method parameters
   * @returns {Promise<any>} Response result
   */
  async function request(method, params = {}) {
    const payload = {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: requestId++
    };

    try {
      const response = await fetch(rpcEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'RPC error');
      }

      return data.result;
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to blockchain node. Please check your RPC endpoint in settings.');
      }
      throw error;
    }
  }

  /**
   * Get wallet balance
   * @param {string} address
   * @returns {Promise<Object>} {balanceDNT, balanceAFC, nonce}
   */
  async function getBalance(address) {
    return await request('wallet_balance', { address });
  }

  /**
   * Send a transaction
   * @param {Object} transaction - Signed transaction object
   * @returns {Promise<string>} Transaction hash
   */
  async function sendTransaction(transaction) {
    const result = await request('tx_send', transaction);
    return result.txHash;
  }

  /**
   * Get transaction by hash
   * @param {string} txHash
   * @returns {Promise<Object>} {transaction, receipt}
   */
  async function getTransaction(txHash) {
    return await request('tx_get', { txHash });
  }

  /**
   * Get transactions by wallet address
   * @param {string} address
   * @param {number} page - Page number (default: 1)
   * @param {number} pageSize - Items per page (default: 10)
   * @returns {Promise<Object>} {transactions, total, hasMore, page, pageSize}
   */
  async function getTransactionsByWallet(address, page = 1, pageSize = 10) {
    return await request('tx_listByWallet', {
      address,
      page,
      pageSize
    });
  }

  /**
   * Get current blockchain height
   * @returns {Promise<number>}
   */
  async function getBlockHeight() {
    const result = await request('chain_getHeight', {});
    return result.height;
  }

  /**
   * Get block by number
   * @param {number} blockNumber
   * @returns {Promise<Object>}
   */
  async function getBlock(blockNumber) {
    return await request('chain_getBlock', { number: blockNumber });
  }

  /**
   * Get blockchain stats
   * @returns {Promise<Object>}
   */
  async function getChainStats() {
    return await request('chain_getStats', {});
  }

  /**
   * Get mempool stats
   * @returns {Promise<Object>}
   */
  async function getMempoolStats() {
    return await request('mempool_stats', {});
  }

  /**
   * Create new wallet on blockchain (calls wallet_create RPC)
   * @returns {Promise<Object>} {address, privateKey, publicKey}
   */
  async function createWallet() {
    return await request('wallet_create', {});
  }

  /**
   * Build and send a transaction (full flow)
   * @param {string} from - Sender address
   * @param {string} to - Recipient address
   * @param {string} amount - Amount in satoshis as string
   * @param {string} tokenType - 'DNT' or 'AFC'
   * @param {string} feeDNT - Fee in satoshis as string
   * @param {string} privateKey - Sender's private key for signing
   * @returns {Promise<string>} Transaction hash
   */
  async function buildAndSendTransaction(from, to, amount, tokenType, feeDNT, privateKey) {
    try {
      // Get current nonce
      const balance = await getBalance(from);
      const nonce = balance.nonce;

      // Build transaction object
      const tx = {
        from,
        to,
        amount,
        tokenType,
        feeDNT,
        nonce
      };

      // Sign transaction
      const signedTx = DinariCrypto.signTransaction(tx, privateKey);

      // Send to blockchain
      const txHash = await sendTransaction(signedTx);

      return txHash;
    } catch (error) {
      throw new Error('Failed to send transaction: ' + error.message);
    }
  }

  /**
   * Convert satoshis to token amount (divide by 100,000,000)
   * @param {string|number} satoshis
   * @returns {number}
   */
  function satoshisToTokens(satoshis) {
    return Number(satoshis) / 100000000;
  }

  /**
   * Convert token amount to satoshis (multiply by 100,000,000)
   * @param {string|number} tokens
   * @returns {string}
   */
  function tokensToSatoshis(tokens) {
    const satoshis = Math.floor(Number(tokens) * 100000000);
    return satoshis.toString();
  }

  /**
   * Format balance for display
   * @param {Object} balanceData - {balanceDNT, balanceAFC, nonce}
   * @returns {Object} {dnt, afc, nonce}
   */
  function formatBalance(balanceData) {
    return {
      dnt: satoshisToTokens(balanceData.balanceDNT),
      afc: satoshisToTokens(balanceData.balanceAFC),
      nonce: balanceData.nonce
    };
  }

  /**
   * Format transaction for display
   * @param {Object} tx - Raw transaction
   * @returns {Object} Formatted transaction
   */
  function formatTransaction(tx) {
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      amount: satoshisToTokens(tx.amount),
      tokenType: tx.tokenType,
      fee: satoshisToTokens(tx.fee),
      nonce: tx.nonce,
      timestamp: tx.timestamp,
      status: tx.status || 'confirmed'
    };
  }

  /**
   * Determine transaction type (sent, received, mined)
   * @param {Object} tx - Transaction object
   * @param {string} userAddress - Current wallet address
   * @returns {string} 'sent', 'received', or 'mined'
   */
  function getTransactionType(tx, userAddress) {
    if (tx.from === 'coinbase') {
      return 'mined';
    } else if (tx.from === userAddress) {
      return 'sent';
    } else {
      return 'received';
    }
  }

  /**
   * Set RPC endpoint
   * @param {string} endpoint
   */
  function setEndpoint(endpoint) {
    rpcEndpoint = endpoint;
  }

  /**
   * Get current RPC endpoint
   * @returns {string}
   */
  function getEndpoint() {
    return rpcEndpoint;
  }

  /**
   * Test connection to RPC endpoint
   * @returns {Promise<boolean>}
   */
  async function testConnection() {
    try {
      await getBlockHeight();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate transaction before sending
   * @param {string} address - Recipient address
   * @param {number} amount - Amount in tokens
   * @param {number} fee - Fee in tokens
   * @param {Object} balance - {dnt, afc}
   * @param {string} tokenType - 'DNT' or 'AFC'
   * @returns {Object} {valid, error}
   */
  function validateTransaction(address, amount, fee, balance, tokenType) {
    // Validate address format
    if (!DinariCrypto.validateAddress(address)) {
      return { valid: false, error: 'Invalid recipient address format' };
    }

    // Validate amounts
    if (amount <= 0) {
      return { valid: false, error: 'Amount must be greater than 0' };
    }

    if (fee <= 0) {
      return { valid: false, error: 'Fee must be greater than 0' };
    }

    // Check balance
    if (tokenType === 'DNT') {
      const total = amount + fee;
      if (total > balance.dnt) {
        return { valid: false, error: 'Insufficient DNT balance (including fee)' };
      }
    } else if (tokenType === 'AFC') {
      if (amount > balance.afc) {
        return { valid: false, error: 'Insufficient AFC balance' };
      }
      if (fee > balance.dnt) {
        return { valid: false, error: 'Insufficient DNT balance for fee' };
      }
    }

    return { valid: true, error: null };
  }

  /**
   * Calculate total cost of transaction
   * @param {number} amount - Amount in tokens
   * @param {number} fee - Fee in tokens
   * @param {string} tokenType - 'DNT' or 'AFC'
   * @returns {Object} {total, totalDNT}
   */
  function calculateTransactionCost(amount, fee, tokenType) {
    if (tokenType === 'DNT') {
      return {
        total: amount + fee,
        totalDNT: amount + fee
      };
    } else {
      return {
        total: amount,
        totalDNT: fee
      };
    }
  }

  /**
   * Format timestamp to readable date
   * @param {number} timestamp - Unix timestamp
   * @returns {string}
   */
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Truncate address for display
   * @param {string} address
   * @param {number} startChars - Characters to show at start (default: 6)
   * @param {number} endChars - Characters to show at end (default: 6)
   * @returns {string}
   */
  function truncateAddress(address, startChars = 6, endChars = 6) {
    if (!address || address.length <= startChars + endChars) {
      return address;
    }
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  }

  // Public API
  return {
    // Initialization
    initialize,
    
    // Core RPC methods
    getBalance,
    sendTransaction,
    getTransaction,
    getTransactionsByWallet,
    getBlockHeight,
    getBlock,
    getChainStats,
    getMempoolStats,
    createWallet,
    
    // Helper methods
    buildAndSendTransaction,
    validateTransaction,
    calculateTransactionCost,
    
    // Formatting utilities
    satoshisToTokens,
    tokensToSatoshis,
    formatBalance,
    formatTransaction,
    getTransactionType,
    formatTimestamp,
    truncateAddress,
    
    // Connection management
    setEndpoint,
    getEndpoint,
    testConnection
  };
})();

// Make available globally
window.DinariRPC = DinariRPC;