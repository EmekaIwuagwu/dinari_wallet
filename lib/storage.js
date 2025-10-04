/**
 * Dinari Wallet - Storage Library
 * Handles encryption and Chrome storage operations
 */

const DinariStorage = (function() {
  'use strict';

  // Storage keys
  const STORAGE_KEYS = {
    WALLET: 'dinari_wallet',
    SETTINGS: 'dinari_settings',
    SESSION: 'dinari_session'
  };

  // Default settings
  const DEFAULT_SETTINGS = {
    rpc_endpoint: 'https://rpctiger-testnet.dinariblockchain.network:8545',
    auto_lock_minutes: 5
  };

  /**
   * Generate random bytes
   * @param {number} length
   * @returns {Uint8Array}
   */
  function getRandomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  /**
   * Derive encryption key from password using PBKDF2
   * @param {string} password
   * @param {Uint8Array} salt
   * @returns {Promise<CryptoKey>}
   */
  async function deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive AES-GCM key
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {string} plaintext
   * @param {string} password
   * @returns {Promise<Object>} {encrypted, salt, iv}
   */
  async function encrypt(plaintext, password) {
    try {
      const salt = getRandomBytes(32);
      const iv = getRandomBytes(12);
      const key = await deriveKey(password, salt);

      const encoder = new TextEncoder();
      const plaintextBuffer = encoder.encode(plaintext);

      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        plaintextBuffer
      );

      return {
        encrypted: arrayBufferToBase64(encryptedBuffer),
        salt: arrayBufferToBase64(salt),
        iv: arrayBufferToBase64(iv)
      };
    } catch (error) {
      throw new Error('Encryption failed: ' + error.message);
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param {string} encryptedBase64
   * @param {string} saltBase64
   * @param {string} ivBase64
   * @param {string} password
   * @returns {Promise<string>} Decrypted plaintext
   */
  async function decrypt(encryptedBase64, saltBase64, ivBase64, password) {
    try {
      const salt = base64ToArrayBuffer(saltBase64);
      const iv = base64ToArrayBuffer(ivBase64);
      const encrypted = base64ToArrayBuffer(encryptedBase64);

      const key = await deriveKey(password, new Uint8Array(salt));

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      throw new Error('Decryption failed - incorrect password or corrupted data');
    }
  }

  /**
   * Convert ArrayBuffer to Base64
   * @param {ArrayBuffer} buffer
   * @returns {string}
   */
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 to ArrayBuffer
   * @param {string} base64
   * @returns {ArrayBuffer}
   */
  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Save wallet data to Chrome storage (encrypted)
   * @param {Object} walletData - {privateKey, seedPhrase, address, publicKey}
   * @param {string} password
   * @returns {Promise<void>}
   */
  async function saveWallet(walletData, password) {
    try {
      // Create sensitive data object
      const sensitiveData = {
        privateKey: walletData.privateKey,
        seedPhrase: walletData.seedPhrase || null
      };

      // Encrypt sensitive data
      const encryptedData = await encrypt(JSON.stringify(sensitiveData), password);

      // Store in Chrome storage
      const storageData = {
        encrypted_data: encryptedData.encrypted,
        salt: encryptedData.salt,
        iv: encryptedData.iv,
        address: walletData.address,
        public_key: walletData.publicKey
      };

      await chrome.storage.local.set({ [STORAGE_KEYS.WALLET]: storageData });
      
      // Initialize session
      await setSession(true);
    } catch (error) {
      throw new Error('Failed to save wallet: ' + error.message);
    }
  }

  /**
   * Load wallet data from Chrome storage
   * @param {string} password
   * @returns {Promise<Object>} {privateKey, seedPhrase, address, publicKey}
   */
  async function loadWallet(password) {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.WALLET);
      const walletData = result[STORAGE_KEYS.WALLET];

      if (!walletData) {
        throw new Error('No wallet found');
      }

      // Decrypt sensitive data
      const decryptedJson = await decrypt(
        walletData.encrypted_data,
        walletData.salt,
        walletData.iv,
        password
      );

      const sensitiveData = JSON.parse(decryptedJson);

      return {
        privateKey: sensitiveData.privateKey,
        seedPhrase: sensitiveData.seedPhrase,
        address: walletData.address,
        publicKey: walletData.public_key
      };
    } catch (error) {
      throw new Error('Failed to load wallet: ' + error.message);
    }
  }

  /**
   * Check if wallet exists
   * @returns {Promise<boolean>}
   */
  async function walletExists() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.WALLET);
      return !!result[STORAGE_KEYS.WALLET];
    } catch (error) {
      return false;
    }
  }

  /**
   * Get wallet address without decryption
   * @returns {Promise<string|null>}
   */
  async function getWalletAddress() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.WALLET);
      const walletData = result[STORAGE_KEYS.WALLET];
      return walletData ? walletData.address : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get wallet public key without decryption
   * @returns {Promise<string|null>}
   */
  async function getWalletPublicKey() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.WALLET);
      const walletData = result[STORAGE_KEYS.WALLET];
      return walletData ? walletData.public_key : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear all wallet data (factory reset)
   * @returns {Promise<void>}
   */
  async function clearWallet() {
    try {
      await chrome.storage.local.remove([
        STORAGE_KEYS.WALLET,
        STORAGE_KEYS.SESSION
      ]);
    } catch (error) {
      throw new Error('Failed to clear wallet: ' + error.message);
    }
  }

  /**
   * Save settings
   * @param {Object} settings
   * @returns {Promise<void>}
   */
  async function saveSettings(settings) {
    try {
      const currentSettings = await getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updatedSettings });
    } catch (error) {
      throw new Error('Failed to save settings: ' + error.message);
    }
  }

  /**
   * Get settings
   * @returns {Promise<Object>}
   */
  async function getSettings() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      return result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
    } catch (error) {
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Get RPC endpoint
   * @returns {Promise<string>}
   */
  async function getRPCEndpoint() {
    const settings = await getSettings();
    return settings.rpc_endpoint || DEFAULT_SETTINGS.rpc_endpoint;
  }

  /**
   * Set session state (locked/unlocked)
   * @param {boolean} unlocked
   * @returns {Promise<void>}
   */
  async function setSession(unlocked) {
    try {
      const sessionData = {
        unlocked: unlocked,
        last_activity: Date.now()
      };
      await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: sessionData });
    } catch (error) {
      throw new Error('Failed to set session: ' + error.message);
    }
  }

  /**
   * Get session state
   * @returns {Promise<Object>} {unlocked, last_activity}
   */
  async function getSession() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SESSION);
      return result[STORAGE_KEYS.SESSION] || { unlocked: false, last_activity: 0 };
    } catch (error) {
      return { unlocked: false, last_activity: 0 };
    }
  }

  /**
   * Check if session is valid (not timed out)
   * @returns {Promise<boolean>}
   */
  async function isSessionValid() {
    try {
      const session = await getSession();
      if (!session.unlocked) return false;

      const settings = await getSettings();
      const autoLockMs = settings.auto_lock_minutes * 60 * 1000;
      const timeSinceActivity = Date.now() - session.last_activity;

      return timeSinceActivity < autoLockMs;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update last activity timestamp
   * @returns {Promise<void>}
   */
  async function updateActivity() {
    try {
      const session = await getSession();
      if (session.unlocked) {
        session.last_activity = Date.now();
        await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: session });
      }
    } catch (error) {
      // Silent fail - not critical
    }
  }

  /**
   * Lock wallet (clear session)
   * @returns {Promise<void>}
   */
  async function lockWallet() {
    await setSession(false);
  }

  /**
   * Verify password without loading full wallet
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  async function verifyPassword(password) {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.WALLET);
      const walletData = result[STORAGE_KEYS.WALLET];

      if (!walletData) {
        return false;
      }

      // Try to decrypt - if successful, password is correct
      await decrypt(
        walletData.encrypted_data,
        walletData.salt,
        walletData.iv,
        password
      );

      return true;
    } catch (error) {
      return false;
    }
  }

  // Public API
  return {
    // Encryption
    encrypt,
    decrypt,
    
    // Wallet operations
    saveWallet,
    loadWallet,
    walletExists,
    getWalletAddress,
    getWalletPublicKey,
    clearWallet,
    verifyPassword,
    
    // Settings
    saveSettings,
    getSettings,
    getRPCEndpoint,
    
    // Session management
    setSession,
    getSession,
    isSessionValid,
    updateActivity,
    lockWallet
  };
})();

// Make available globally
window.DinariStorage = DinariStorage;