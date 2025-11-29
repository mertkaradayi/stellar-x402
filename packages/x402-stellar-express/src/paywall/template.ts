/**
 * Paywall HTML Template
 *
 * Generates a server-rendered HTML page for the Stellar paywall.
 * Uses vanilla JavaScript with dynamic import for Freighter API.
 */

import type { PaymentRequirements } from "x402-stellar";
import { paywallStyles } from "./styles.js";
import { formatStroopsToXLM, getNetworkDisplayName, isTestnetNetwork } from "./paywallUtils.js";

export interface PaywallConfig {
  /** Application name to display */
  appName?: string;
  /** Application logo URL */
  appLogo?: string;
}

export interface GetPaywallHtmlOptions {
  /** Payment requirements from the 402 response */
  paymentRequirements: PaymentRequirements;
  /** The current URL being accessed */
  currentUrl: string;
  /** Optional paywall configuration */
  config?: PaywallConfig;
}

/**
 * Generate the paywall HTML page
 */
export function getPaywallHtml(options: GetPaywallHtmlOptions): string {
  const { paymentRequirements, currentUrl, config } = options;

  const amount = formatStroopsToXLM(paymentRequirements.maxAmountRequired);
  const assetDisplay = paymentRequirements.asset === "native" ? "XLM" : paymentRequirements.asset.slice(0, 8) + "...";
  const networkDisplay = getNetworkDisplayName(paymentRequirements.network);
  const isTestnet = isTestnetNetwork(paymentRequirements.network);
  const appName = config?.appName || "Protected Content";

  // Stellar logo SVG (inline)
  const stellarLogoSvg = `<svg viewBox="0 0 100 100" class="paywall-logo"><circle cx="50" cy="50" r="48" fill="url(#stellarGradient)"/><defs><linearGradient id="stellarGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#7c3aed"/><stop offset="100%" style="stop-color:#3b82f6"/></linearGradient></defs><text x="50" y="62" text-anchor="middle" fill="white" font-size="32" font-weight="bold">✦</text></svg>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Required - ${appName}</title>
  <style>${paywallStyles}</style>
</head>
<body>
  <div class="paywall-container">
    <div class="paywall-header">
      ${config?.appLogo ? `<img src="${config.appLogo}" alt="${appName}" class="paywall-logo">` : stellarLogoSvg}
      <h1 class="paywall-title">Payment Required</h1>
      <p class="paywall-subtitle">${paymentRequirements.description || `Access to ${appName}`}</p>
    </div>

    <div class="paywall-amount-section">
      <div class="paywall-amount">${amount}</div>
      <div class="paywall-asset">${assetDisplay}</div>
      <div class="paywall-network">
        <span class="paywall-network-dot"></span>
        ${networkDisplay}${isTestnet ? ' (Testnet)' : ''}
      </div>
    </div>

    <div id="status" class="paywall-status hidden"></div>

    <div class="paywall-details">
      <div class="paywall-detail-row">
        <span class="paywall-detail-label">Resource</span>
        <span class="paywall-detail-value" title="${paymentRequirements.resource}">${new URL(paymentRequirements.resource).pathname}</span>
      </div>
      <div class="paywall-detail-row">
        <span class="paywall-detail-label">Recipient</span>
        <span class="paywall-detail-value" title="${paymentRequirements.payTo}">${paymentRequirements.payTo.slice(0, 8)}...${paymentRequirements.payTo.slice(-4)}</span>
      </div>
    </div>

    <button id="connectBtn" class="paywall-button paywall-button-primary">
      <svg class="wallet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/>
        <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>
      </svg>
      <span id="connectBtnText">Connect Freighter Wallet</span>
    </button>

    <button id="payBtn" class="paywall-button paywall-button-primary hidden">
      <span id="payBtnText">Pay ${amount} ${assetDisplay}</span>
    </button>

    <div id="balance" class="paywall-balance hidden"></div>

    <button id="cancelBtn" class="paywall-button paywall-button-secondary">
      Cancel
    </button>

    <div class="paywall-footer">
      <a href="https://www.freighter.app/" target="_blank" rel="noopener">Get Freighter Wallet</a>
      <span style="margin: 0 8px; color: var(--border-color);">•</span>
      <a href="https://github.com/coinbase/x402" target="_blank" rel="noopener">Powered by x402</a>
    </div>
  </div>

  <script type="module">
    // Payment requirements from server
    const paymentRequirements = ${JSON.stringify(paymentRequirements)};
    const currentUrl = ${JSON.stringify(currentUrl)};
    const networkPassphrase = ${JSON.stringify(
      isTestnet 
        ? "Test SDF Network ; September 2015" 
        : "Public Global Stellar Network ; September 2015"
    )};
    const horizonUrl = ${JSON.stringify(
      isTestnet 
        ? "https://horizon-testnet.stellar.org" 
        : "https://horizon.stellar.org"
    )};

    // DOM elements
    const connectBtn = document.getElementById('connectBtn');
    const connectBtnText = document.getElementById('connectBtnText');
    const payBtn = document.getElementById('payBtn');
    const payBtnText = document.getElementById('payBtnText');
    const cancelBtn = document.getElementById('cancelBtn');
    const statusEl = document.getElementById('status');
    const balanceEl = document.getElementById('balance');

    // State
    let freighterApi = null;
    let publicKey = null;

    // Utility functions
    function showStatus(message, type = 'loading') {
      statusEl.textContent = message;
      statusEl.className = 'paywall-status paywall-status-' + type;
      statusEl.classList.remove('hidden');
    }

    function hideStatus() {
      statusEl.classList.add('hidden');
    }

    function formatBalance(balance) {
      return parseFloat(balance).toFixed(2);
    }

    // Load Freighter API dynamically
    async function loadFreighter() {
      try {
        freighterApi = await import('https://cdn.jsdelivr.net/npm/@stellar/freighter-api@2.0.0/+esm');
        return true;
      } catch (e) {
        console.error('Failed to load Freighter API:', e);
        return false;
      }
    }

    // Check Freighter connection
    async function checkFreighter() {
      if (!freighterApi) {
        const loaded = await loadFreighter();
        if (!loaded) {
          showStatus('Failed to load wallet library', 'error');
          return false;
        }
      }

      const connected = await freighterApi.isConnected();
      if (!connected) {
        return false;
      }

      // Check network
      const networkResult = await freighterApi.getNetwork();
      if (networkResult.error) {
        return false;
      }

      return true;
    }

    // Connect wallet
    async function connectWallet() {
      connectBtn.disabled = true;
      connectBtnText.textContent = 'Connecting...';

      try {
        if (!freighterApi) {
          const loaded = await loadFreighter();
          if (!loaded) {
            throw new Error('Freighter not available. Please install the extension.');
          }
        }

        // Request access
        const accessResult = await freighterApi.requestAccess();
        if (accessResult.error) {
          throw new Error(accessResult.error);
        }

        // Get address
        const addressResult = await freighterApi.getAddress();
        if (addressResult.error) {
          throw new Error(addressResult.error);
        }

        publicKey = addressResult.address;

        // Show pay button
        connectBtn.classList.add('hidden');
        payBtn.classList.remove('hidden');

        // Fetch and show balance
        await updateBalance();

        showStatus('Wallet connected: ' + publicKey.slice(0, 8) + '...' + publicKey.slice(-4), 'success');
        setTimeout(hideStatus, 2000);

      } catch (error) {
        showStatus(error.message || 'Failed to connect wallet', 'error');
        connectBtn.disabled = false;
        connectBtnText.textContent = 'Connect Freighter Wallet';
      }
    }

    // Update balance display
    async function updateBalance() {
      try {
        const response = await fetch(horizonUrl + '/accounts/' + publicKey);
        if (response.ok) {
          const account = await response.json();
          const xlmBalance = account.balances.find(b => b.asset_type === 'native');
          if (xlmBalance) {
            balanceEl.textContent = 'Balance: ' + formatBalance(xlmBalance.balance) + ' XLM';
            balanceEl.classList.remove('hidden');
          }
        }
      } catch (e) {
        console.error('Failed to fetch balance:', e);
      }
    }

    // Create and sign payment transaction
    async function makePayment() {
      payBtn.disabled = true;
      payBtnText.innerHTML = '<span class="spinner"></span> Processing...';

      try {
        showStatus('Building transaction...', 'loading');

        // Import Stellar SDK
        const StellarSdk = await import('https://cdn.jsdelivr.net/npm/@stellar/stellar-sdk@12.0.1/+esm');

        // Load source account
        const server = new StellarSdk.Horizon.Server(horizonUrl);
        const sourceAccount = await server.loadAccount(publicKey);

        // Build transaction
        const amount = (parseInt(paymentRequirements.maxAmountRequired) / 10000000).toFixed(7);
        
        let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: networkPassphrase,
        });

        // Add payment operation
        if (paymentRequirements.asset === 'native') {
          transaction = transaction.addOperation(
            StellarSdk.Operation.payment({
              destination: paymentRequirements.payTo,
              asset: StellarSdk.Asset.native(),
              amount: amount,
            })
          );
        } else {
          // For Soroban tokens, we'd need different handling
          throw new Error('Custom token payments not yet supported in paywall');
        }

        // Set timeout
        transaction = transaction.setTimeout(paymentRequirements.maxTimeoutSeconds || 300);
        
        // Build
        const builtTx = transaction.build();

        showStatus('Please sign the transaction in Freighter...', 'loading');

        // Sign with Freighter
        const signResult = await freighterApi.signTransaction(builtTx.toXDR(), {
          networkPassphrase: networkPassphrase,
        });

        if (signResult.error) {
          throw new Error(signResult.error);
        }

        showStatus('Submitting payment...', 'loading');

        // Build payment header
        const paymentPayload = {
          x402Version: 1,
          scheme: 'exact',
          network: paymentRequirements.network,
          payload: {
            signedTxXdr: signResult.signedTxXdr,
            sourceAccount: publicKey,
            amount: paymentRequirements.maxAmountRequired,
            destination: paymentRequirements.payTo,
            asset: paymentRequirements.asset,
            validUntilLedger: parseInt(builtTx.timeBounds?.maxTime || '0'),
            nonce: Date.now().toString(),
          },
        };

        const paymentHeader = btoa(JSON.stringify(paymentPayload));

        // Retry request with payment
        const response = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'X-PAYMENT': paymentHeader,
          },
        });

        if (response.ok) {
          showStatus('Payment successful! Redirecting...', 'success');
          
          // Handle response content
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            document.documentElement.innerHTML = await response.text();
          } else {
            // For non-HTML, redirect to the URL
            window.location.reload();
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Payment failed: ' + response.status);
        }

      } catch (error) {
        console.error('Payment error:', error);
        showStatus(error.message || 'Payment failed', 'error');
        payBtn.disabled = false;
        payBtnText.textContent = 'Pay ${amount} ${assetDisplay}';
      }
    }

    // Cancel and go back
    function cancel() {
      window.history.back();
    }

    // Event listeners
    connectBtn.addEventListener('click', connectWallet);
    payBtn.addEventListener('click', makePayment);
    cancelBtn.addEventListener('click', cancel);

    // Check if already connected on load
    (async () => {
      await loadFreighter();
      if (await checkFreighter()) {
        try {
          const addressResult = await freighterApi.getAddress();
          if (!addressResult.error && addressResult.address) {
            publicKey = addressResult.address;
            connectBtn.classList.add('hidden');
            payBtn.classList.remove('hidden');
            await updateBalance();
          }
        } catch (e) {
          // Not connected, show connect button
        }
      }
    })();
  </script>
</body>
</html>`;
}

