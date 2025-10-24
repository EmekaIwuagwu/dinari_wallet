/**
 * Dinari Wallet - Cryptography Library
 * Handles key generation, signing, and address derivation
 * Compatible with secp256k1 curve (Bitcoin/Ethereum standard)
 */

// Import elliptic for secp256k1
// Note: In production, load this via CDN in HTML or bundle with webpack
// <script src="https://cdn.jsdelivr.net/npm/elliptic@6.5.4/dist/elliptic.min.js"></script>

const DinariCrypto = (function() {
  'use strict';

  // Constants
  const ADDRESS_VERSION = 0x1e; // 30 in decimal - produces addresses starting with 'D'
  const EC = new elliptic.ec('secp256k1');

  /**
   * Generate a random private key
   * @returns {string} 64-character hex string
   */
  function generatePrivateKey() {
    const keyPair = EC.genKeyPair();
    return keyPair.getPrivate('hex').padStart(64, '0');
  }

  /**
   * Derive public key from private key
   * @param {string} privateKeyHex - 64-character hex string
   * @returns {string} Compressed public key (66 chars hex, starts with 02 or 03)
   */
  function getPublicKeyFromPrivate(privateKeyHex) {
    try {
      const keyPair = EC.keyFromPrivate(privateKeyHex, 'hex');
      const publicKey = keyPair.getPublic();
      return publicKey.encodeCompressed('hex');
    } catch (error) {
      throw new Error('Invalid private key: ' + error.message);
    }
  }

  /**
   * SHA-256 hash function
   * @param {Uint8Array|string} data
   * @returns {Uint8Array} 32-byte hash
   */
  function sha256(data) {
    if (typeof data === 'string') {
      data = new TextEncoder().encode(data);
    }
    return crypto.subtle.digest('SHA-256', data).then(hash => new Uint8Array(hash));
  }

  /**
   * Synchronous SHA-256 (using SubtleCrypto in sync manner for address generation)
   * Note: This is a workaround - in production use async sha256 where possible
   */
  function sha256Sync(data) {
    if (typeof data === 'string') {
      data = new TextEncoder().encode(data);
    }
    // Use CryptoJS for synchronous hashing
    const wordArray = CryptoJS.lib.WordArray.create(data);
    const hash = CryptoJS.SHA256(wordArray);
    return hexToBytes(hash.toString(CryptoJS.enc.Hex));
  }

  /**
   * RIPEMD-160 hash function (using CryptoJS)
   * @param {Uint8Array} data
   * @returns {Uint8Array} 20-byte hash
   */
  function ripemd160(data) {
    const wordArray = CryptoJS.lib.WordArray.create(data);
    const hash = CryptoJS.RIPEMD160(wordArray);
    return hexToBytes(hash.toString(CryptoJS.enc.Hex));
  }

  /**
   * Convert hex string to Uint8Array
   * @param {string} hex
   * @returns {Uint8Array}
   */
  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  /**
   * Convert Uint8Array to hex string
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  function bytesToHex(bytes) {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Base58 encoding
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  function base58Encode(bytes) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const base = BigInt(58);
    let num = BigInt('0x' + bytesToHex(bytes));
    let encoded = '';

    while (num > 0n) {
      const remainder = Number(num % base);
      encoded = ALPHABET[remainder] + encoded;
      num = num / base;
    }

    // Handle leading zeros
    for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
      encoded = ALPHABET[0] + encoded;
    }

    return encoded;
  }

  /**
   * Base58 decoding
   * @param {string} str
   * @returns {Uint8Array}
   */
  function base58Decode(str) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const base = BigInt(58);
    let num = BigInt(0);

    for (let i = 0; i < str.length; i++) {
      const digit = ALPHABET.indexOf(str[i]);
      if (digit < 0) throw new Error('Invalid Base58 character');
      num = num * base + BigInt(digit);
    }

    let hex = num.toString(16);
    if (hex.length % 2) hex = '0' + hex;

    const bytes = hexToBytes(hex);

    // Handle leading zeros (1s in Base58)
    const leadingZeros = str.match(/^1*/)[0].length;
    const result = new Uint8Array(leadingZeros + bytes.length);
    result.set(bytes, leadingZeros);

    return result;
  }

  /**
   * Derive Dinari address from public key
   * @param {string} publicKeyHex - Compressed public key (66 chars)
   * @returns {string} Dinari address starting with 'D'
   */
  function publicKeyToAddress(publicKeyHex) {
    try {
      // 1. SHA-256 hash of public key
      const publicKeyBytes = hexToBytes(publicKeyHex);
      const sha256Hash = sha256Sync(publicKeyBytes);

      // 2. RIPEMD-160 hash of SHA-256 hash
      const ripemd160Hash = ripemd160(sha256Hash);

      // 3. Add version byte
      const versionedPayload = new Uint8Array(21);
      versionedPayload[0] = ADDRESS_VERSION;
      versionedPayload.set(ripemd160Hash, 1);

      // 4. Calculate checksum (double SHA-256, first 4 bytes)
      const checksum1 = sha256Sync(versionedPayload);
      const checksum2 = sha256Sync(checksum1);
      const checksum = checksum2.slice(0, 4);

      // 5. Concatenate versioned payload and checksum
      const addressBytes = new Uint8Array(25);
      addressBytes.set(versionedPayload);
      addressBytes.set(checksum, 21);

      // 6. Base58 encode
      return base58Encode(addressBytes);
    } catch (error) {
      throw new Error('Failed to generate address: ' + error.message);
    }
  }

  /**
   * Validate Dinari address format
   * @param {string} address
   * @returns {boolean}
   */
  function validateAddress(address) {
    try {
      // Must start with 'D'
      if (!address.startsWith('D')) return false;

      // Decode Base58
      const decoded = base58Decode(address);

      // Should be 25 bytes (1 version + 20 hash + 4 checksum)
      if (decoded.length !== 25) return false;

      // Check version byte
      if (decoded[0] !== ADDRESS_VERSION) return false;

      // Verify checksum
      const payload = decoded.slice(0, 21);
      const checksum = decoded.slice(21, 25);

      const hash1 = sha256Sync(payload);
      const hash2 = sha256Sync(hash1);
      const expectedChecksum = hash2.slice(0, 4);

      // Compare checksums
      for (let i = 0; i < 4; i++) {
        if (checksum[i] !== expectedChecksum[i]) return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate new wallet (private key, public key, address)
   * @returns {Object} {privateKey, publicKey, address}
   */
  function generateWallet() {
    const privateKey = generatePrivateKey();
    const publicKey = getPublicKeyFromPrivate(privateKey);
    const address = publicKeyToAddress(publicKey);

    return {
      privateKey,
      publicKey,
      address
    };
  }

  /**
   * Import wallet from private key
   * @param {string} privateKeyHex
   * @returns {Object} {privateKey, publicKey, address}
   */
  function importWallet(privateKeyHex) {
    // Validate hex format
    if (!/^[a-fA-F0-9]{64}$/.test(privateKeyHex)) {
      throw new Error('Invalid private key format. Must be 64 hexadecimal characters.');
    }

    const publicKey = getPublicKeyFromPrivate(privateKeyHex);
    const address = publicKeyToAddress(publicKey);

    return {
      privateKey: privateKeyHex.toLowerCase(),
      publicKey,
      address
    };
  }

  /**
   * Sign a message/transaction hash
   * @param {string} messageHashHex - 32-byte hash as hex string
   * @param {string} privateKeyHex
   * @returns {string} DER-encoded signature as hex
   */
  function signMessage(messageHashHex, privateKeyHex) {
    try {
      const keyPair = EC.keyFromPrivate(privateKeyHex, 'hex');
      const messageBytes = hexToBytes(messageHashHex);
      const signature = keyPair.sign(messageBytes);
      return signature.toDER('hex');
    } catch (error) {
      throw new Error('Failed to sign message: ' + error.message);
    }
  }

  /**
   * Verify signature
   * @param {string} messageHashHex
   * @param {string} signatureHex - DER-encoded
   * @param {string} publicKeyHex
   * @returns {boolean}
   */
  function verifySignature(messageHashHex, signatureHex, publicKeyHex) {
    try {
      const keyPair = EC.keyFromPublic(publicKeyHex, 'hex');
      const messageBytes = hexToBytes(messageHashHex);
      return keyPair.verify(messageBytes, signatureHex);
    } catch (error) {
      return false;
    }
  }

  /**
   * Hash transaction data for signing
   * @param {Object} tx - Transaction object
   * @returns {string} SHA-256 hash as hex
   */
  function hashTransaction(tx) {
    // Create deterministic JSON string (field order matters!)
    const txData = JSON.stringify({
      from: tx.from,
      to: tx.to,
      amount: tx.amount,
      tokenType: tx.tokenType,
      fee: tx.fee || tx.feeDNT,  // ✅ Support both for backward compatibility
      nonce: tx.nonce
    });

    const dataBytes = new TextEncoder().encode(txData);
    const hash = sha256Sync(dataBytes);
    return bytesToHex(hash);
  }

  /**
   * Sign a transaction
   * @param {Object} tx - Transaction object (without signature)
   * @param {string} privateKeyHex
   * @returns {Object} Signed transaction
   */
  function signTransaction(tx, privateKeyHex) {
    const txHash = hashTransaction(tx);
    const signature = signMessage(txHash, privateKeyHex);
    const publicKey = getPublicKeyFromPrivate(privateKeyHex);

    return {
      ...tx,
      signature,
      publicKey
    };
  }

  // Simple word list for seed phrases (200 common words)
  const WORDLIST = ['abandon','ability','able','about','above','absent','absorb','abstract','absurd','abuse','access','accident','account','accuse','achieve','acid','acoustic','acquire','across','act','action','actor','actress','actual','adapt','add','addict','address','adjust','admit','adult','advance','advice','aerobic','afford','afraid','again','age','agent','agree','ahead','aim','air','airport','aisle','alarm','album','alcohol','alert','alien','all','alley','allow','almost','alone','alpha','already','also','alter','always','amateur','amazing','among','amount','amused','analyst','anchor','ancient','anger','angle','angry','animal','ankle','announce','annual','another','answer','antenna','antique','anxiety','any','apart','apology','appear','apple','approve','april','arch','arctic','area','arena','argue','arm','armed','armor','army','around','arrange','arrest','arrive','arrow','art','artefact','artist','artwork','ask','aspect','assault','asset','assist','assume','asthma','athlete','atom','attack','attend','attitude','attract','auction','audit','august','aunt','author','auto','autumn','average','avocado','avoid','awake','aware','away','awesome','awful','awkward','axis','baby','bachelor','bacon','badge','bag','balance','balcony','ball','bamboo','banana','banner','bar','barely','bargain','barrel','base','basic','basket','battle','beach','bean','beauty','because','become','beef','before','begin','behave','behind','believe','below','belt','bench','benefit','best','betray','better','between','beyond','bicycle','bid','bike','bind','biology','bird','birth','bitter','black','blade','blame','blanket','blast','bleak','bless','blind','blood','blossom','blouse','blue','blur','blush','board','boat','body','boil','bomb','bone','bonus','book','boost','border','boring','borrow','boss','bottom','bounce','box','boy','bracket','brain','brand','brass','brave','bread','breeze','brick','bridge','brief','bright','bring','brisk','broccoli','broken','bronze','broom','brother','brown','brush','bubble'];

  /**
   * Generate simple 12-word mnemonic (simplified, not BIP39 compatible)
   * Note: This is for wallet backup only, not BIP39 standard
   */
  function generateMnemonic() {
    const words = [];
    for (let i = 0; i < 12; i++) {
      const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % WORDLIST.length;
      words.push(WORDLIST[randomIndex]);
    }
    return words.join(' ');
  }

  /**
   * Derive private key from mnemonic (simplified)
   * Uses SHA-256 hash of mnemonic as seed
   */
  function mnemonicToPrivateKey(mnemonic) {
    // Validate word count
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 12) {
      throw new Error('Mnemonic must be exactly 12 words');
    }
    
    // Hash the mnemonic to create deterministic seed
    const mnemonicBytes = new TextEncoder().encode(mnemonic);
    const seedHash = sha256Sync(mnemonicBytes);
    
    // Use the hash as private key (32 bytes = 64 hex chars)
    return bytesToHex(seedHash);
  }

  // Public API
  return {
    generatePrivateKey,
    getPublicKeyFromPrivate,
    publicKeyToAddress,
    validateAddress,
    generateWallet,
    importWallet,
    signMessage,
    verifySignature,
    hashTransaction,
    signTransaction,
    generateMnemonic,
    mnemonicToPrivateKey,
    
    // Utility functions
    hexToBytes,
    bytesToHex,
    sha256Sync
  };
})();

// Make available globally for popup.js
window.DinariCrypto = DinariCrypto;