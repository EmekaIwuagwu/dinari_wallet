/**
 * Dinari Wallet - Background Service Worker
 * Handles background tasks, alarms, and event listeners
 */

// Service worker installation
// Service worker installation - CONSOLIDATED
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Dinari Wallet installed/updated', details.reason);
  
  if (details.reason === 'install') {
    console.log('First time installation');
  } else if (details.reason === 'update') {
    console.log('Extension updated to version', chrome.runtime.getManifest().version);
  }
  
  // Create context menu (moved here from duplicate listener)
  chrome.contextMenus.create({
    id: 'dinari-copy-address',
    title: 'Copy Wallet Address',
    contexts: ['page']
  });
});

// Service worker startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started, Dinari Wallet service worker active');
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);
  
  switch (message.type) {
    case 'GET_WALLET_STATUS':
      handleGetWalletStatus(sendResponse);
      return true; // Indicates async response
      
    case 'LOCK_WALLET':
      handleLockWallet(sendResponse);
      return true;
      
    case 'UPDATE_BADGE':
      handleUpdateBadge(message.data);
      break;
      
    default:
      console.warn('Unknown message type:', message.type);
  }
});

/**
 * Get wallet status (locked/unlocked, address)
 */
async function handleGetWalletStatus(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['dinari_wallet', 'dinari_session']);
    
    const hasWallet = !!result.dinari_wallet;
    const session = result.dinari_session || { unlocked: false, last_activity: 0 };
    
    sendResponse({
      success: true,
      hasWallet: hasWallet,
      isUnlocked: session.unlocked,
      address: hasWallet ? result.dinari_wallet.address : null
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Lock wallet
 */
async function handleLockWallet(sendResponse) {
  try {
    await chrome.storage.local.set({
      dinari_session: {
        unlocked: false,
        last_activity: 0
      }
    });
    
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update extension badge
 */
function handleUpdateBadge(data) {
  if (data.text) {
    chrome.action.setBadgeText({ text: data.text });
  }
  
  if (data.color) {
    chrome.action.setBadgeBackgroundColor({ color: data.color });
  }
}

// Auto-lock check alarm
chrome.alarms.create('autoLockCheck', {
  periodInMinutes: 1 // Check every minute
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'autoLockCheck') {
    await checkAutoLock();
  }
});

/**
 * Check if wallet should be auto-locked
 */
async function checkAutoLock() {
  try {
    const result = await chrome.storage.local.get(['dinari_session', 'dinari_settings']);
    
    const session = result.dinari_session;
    const settings = result.dinari_settings || { auto_lock_minutes: 5 };
    
    if (!session || !session.unlocked) {
      return; // Already locked
    }
    
    const autoLockMs = settings.auto_lock_minutes * 60 * 1000;
    const timeSinceActivity = Date.now() - session.last_activity;
    
    if (timeSinceActivity >= autoLockMs) {
      // Lock wallet
      await chrome.storage.local.set({
        dinari_session: {
          unlocked: false,
          last_activity: 0
        }
      });
      
      console.log('Wallet auto-locked due to inactivity');
      
      // Update badge to show locked status
      chrome.action.setBadgeText({ text: '🔒' });
      chrome.action.setBadgeBackgroundColor({ color: '#ff6b6b' });
    }
  } catch (error) {
    console.error('Auto-lock check error:', error);
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener(() => {
  // This won't trigger if default_popup is set in manifest
  // But keeping it here as fallback
  console.log('Extension icon clicked');
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    console.log('Storage changed:', Object.keys(changes));
    
    // Update badge based on session status
    if (changes.dinari_session) {
      const newSession = changes.dinari_session.newValue;
      if (newSession && newSession.unlocked) {
        chrome.action.setBadgeText({ text: '' });
      } else {
        chrome.action.setBadgeText({ text: '🔒' });
        chrome.action.setBadgeBackgroundColor({ color: '#ff6b6b' });
      }
    }
  }
});


// Keep service worker alive (Chrome sometimes terminates inactive workers)
let keepAliveInterval;

function startKeepAlive() {
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      // This query keeps the service worker alive
    });
  }, 20000); // Every 20 seconds
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
}

// Start keep-alive on installation
startKeepAlive();

// Clean up on suspension (optional)
chrome.runtime.onSuspend.addListener(() => {
  console.log('Service worker suspending...');
  stopKeepAlive();
});

// Handle external connections (for future web3 integration)
chrome.runtime.onConnectExternal.addListener((port) => {
  console.log('External connection from:', port.sender.url);
  
  port.onMessage.addListener((msg) => {
    console.log('External message:', msg);
    
    // Future: Handle web3 provider requests from dApps
    // For now, just log
    port.postMessage({ error: 'Web3 provider not implemented yet' });
  });
});

// Periodic balance update reminder (optional)
chrome.alarms.create('balanceUpdateReminder', {
  periodInMinutes: 5 // Remind every 5 minutes
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'balanceUpdateReminder') {
    // You could send a notification or update badge here
    // For now, just log
    console.log('Balance update reminder');
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'dinari-copy-address') {
    try {
      const result = await chrome.storage.local.get('dinari_wallet');
      if (result.dinari_wallet && result.dinari_wallet.address) {
        // Copy to clipboard
        await navigator.clipboard.writeText(result.dinari_wallet.address);
        
        // Show notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'assets/icons/icon48.png',
          title: 'Dinari Wallet',
          message: 'Address copied to clipboard'
        });
      }
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  }
});

// Error tracking
self.addEventListener('error', (event) => {
  console.error('Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service worker unhandled rejection:', event.reason);
});

console.log('Dinari Wallet service worker loaded successfully');