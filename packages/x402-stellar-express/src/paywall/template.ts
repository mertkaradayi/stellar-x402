/**
 * Paywall HTML Template
 *
 * Generates a server-rendered HTML page for the Stellar paywall.
 * Uses the Freighter wallet extension for signing transactions.
 * Supports both XLM native payments and SAC token payments (USDC via Soroban).
 */

import type { PaymentRequirements } from "x402-stellar";
import type { PaywallConfig } from "../types.js";
import { paywallStyles } from "./styles.js";
import { formatStroopsToXLM, getNetworkDisplayName, isTestnetNetwork } from "./paywallUtils.js";

// Re-export PaywallConfig for convenience
export type { PaywallConfig };

// Well-known token symbols by contract address (used server-side and serialized to client)
const TOKEN_CATALOG: Record<string, { symbol: string; decimals: number }> = {
  // Testnet USDC
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA": { symbol: "USDC", decimals: 7 },
  // Mainnet USDC
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75": { symbol: "USDC", decimals: 7 },
};

/**
 * Get human-readable asset display (XLM or token symbol)
 */
function getAssetDisplay(asset: string): string {
  if (asset === "native") return "XLM";
  const token = TOKEN_CATALOG[asset];
  return token ? token.symbol : asset.slice(0, 8) + "...";
}

/**
 * Format amount for display based on asset type
 * For native XLM: amount is in stroops (7 decimals)
 * For SAC tokens: amount uses token's decimals from TOKEN_CATALOG
 */
function formatAmount(amount: string, asset: string): string {
  if (asset === "native") {
    return formatStroopsToXLM(amount);
  }
  // SAC token amount formatting
  const token = TOKEN_CATALOG[asset];
  const decimals = token?.decimals ?? 7;
  const raw = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  // Pad fractional part and remove trailing zeros for clean display
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
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

  const assetDisplay = getAssetDisplay(paymentRequirements.asset);
  const amount = formatAmount(paymentRequirements.maxAmountRequired, paymentRequirements.asset);
  const networkDisplay = getNetworkDisplayName(paymentRequirements.network);
  const isTestnet = isTestnetNetwork(paymentRequirements.network);
  const appName = config?.appName || "Protected Content";
  const debugMode = config?.debug === true;

  // Stellar logo SVG (minimal monochrome)
  const stellarLogoSvg = `<svg viewBox="0 0 100 100" class="paywall-logo"><circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="8"/><path d="M50 20 L50 80 M20 50 L80 50" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="50" r="15" fill="currentColor"/></svg>`;

  // Network configuration
  const networkPassphrase = isTestnet
    ? "Test SDF Network ; September 2015"
    : "Public Global Stellar Network ; September 2015";
  const horizonUrl = isTestnet
    ? "https://horizon-testnet.stellar.org"
    : "https://horizon.stellar.org";
  const sorobanRpcUrl = isTestnet
    ? "https://soroban-testnet.stellar.org"
    : "https://soroban.stellar.org";

  // Check if this is a SAC token payment
  const isSacToken = paymentRequirements.asset !== "native";

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
        ${networkDisplay}${isTestnet ? " (Testnet)" : ""}
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

    ${debugMode
      ? `
    <div id="debugPanel" style="margin-top: 16px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; font-size: 12px; color: #a0aec0; max-height: 200px; overflow-y: auto;">
      <strong>Debug Log:</strong>
      <div id="debugLog"></div>
    </div>
    `
      : ""
    }

    <div class="paywall-footer">
      <a href="https://www.freighter.app/" target="_blank" rel="noopener">Get Freighter Wallet</a>
      <span style="margin: 0 8px; color: var(--border-color);">•</span>
      <a href="https://github.com/coinbase/x402" target="_blank" rel="noopener">Powered by x402</a>
    </div>
  </div>

  <script type="module">
    // Configuration from server
    const paymentRequirements = ${JSON.stringify(paymentRequirements)};
    const currentUrl = ${JSON.stringify(currentUrl)};
    const networkPassphrase = ${JSON.stringify(networkPassphrase)};
    const horizonUrl = ${JSON.stringify(horizonUrl)};
    const sorobanRpcUrl = ${JSON.stringify(sorobanRpcUrl)};
    const debugMode = ${JSON.stringify(debugMode)};
    const appName = ${JSON.stringify(appName)};
    const appLogo = ${config?.appLogo ? JSON.stringify(config.appLogo) : 'null'};
    const stellarLogoSvg = ${JSON.stringify(stellarLogoSvg)};
    const tokenCatalog = ${JSON.stringify(TOKEN_CATALOG)};
    const isSacToken = ${JSON.stringify(isSacToken)};
    const formattedAmount = ${JSON.stringify(amount)};
    const assetSymbol = ${JSON.stringify(assetDisplay)};

    // DOM elements
    const connectBtn = document.getElementById('connectBtn');
    const connectBtnText = document.getElementById('connectBtnText');
    const payBtn = document.getElementById('payBtn');
    const payBtnText = document.getElementById('payBtnText');
    const cancelBtn = document.getElementById('cancelBtn');
    const statusEl = document.getElementById('status');
    const balanceEl = document.getElementById('balance');
    const debugLog = document.getElementById('debugLog');

    // State
    let publicKey = null;

    // Debug logging
    function log(message) {
      console.log('[Paywall]', message);
      if (debugMode && debugLog) {
        const time = new Date().toLocaleTimeString();
        debugLog.innerHTML += '<div>' + time + ': ' + message + '</div>';
        debugLog.parentElement.scrollTop = debugLog.parentElement.scrollHeight;
      }
    }

    // UI helpers
    function showStatus(message, type) {
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

    // Load Freighter API from CDN
    let freighterApi = null;
    async function loadFreighterApi() {
      if (freighterApi) return freighterApi;
      
      try {
        log('Loading @stellar/freighter-api from CDN...');
        const module = await import('https://cdn.jsdelivr.net/npm/@stellar/freighter-api@2.0.0/+esm');
        
        // Handle different export formats
        if (module.isConnected && module.setAllowed && module.getPublicKey) {
          freighterApi = module;
        } else if (module.default && module.default.isConnected) {
          freighterApi = module.default;
        } else {
          throw new Error('Freighter API module structure not recognized');
        }
        
        log('Freighter API loaded successfully');
        return freighterApi;
      } catch (error) {
        log('Failed to load Freighter API: ' + error.message);
        throw error;
      }
    }

    // Check if Freighter is available
    async function isFreighterAvailable() {
      try {
        const api = await loadFreighterApi();
        const connected = await api.isConnected();
        return connected === true || (connected && connected.isConnected === true);
      } catch (error) {
        log('Freighter not available: ' + error.message);
        return false;
      }
    }

    // Check HTTPS requirement
    function checkHttps() {
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        showStatus('Freighter requires HTTPS. Please access this page via HTTPS.', 'error');
        connectBtn.disabled = true;
        return false;
      }
      return true;
    }

    // Connect wallet
    async function connectWallet() {
      if (!checkHttps()) return;

      connectBtn.disabled = true;
      connectBtnText.textContent = 'Connecting...';
      log('Connecting wallet...');

      try {
        // Load Freighter API
        const api = await loadFreighterApi();
        
        // Check if connected
        const connected = await api.isConnected();
        if (!connected) {
          throw new Error('Freighter wallet not detected. Please install it from https://freighter.app and refresh.');
        }
        log('Freighter is connected');

        // Request access using setAllowed (correct method per Freighter docs)
        // Fallback to requestAccess if setAllowed doesn't exist (for compatibility)
        log('Requesting access...');
        let isAllowed = false;
        if (api.setAllowed) {
          isAllowed = await api.setAllowed();
          log('setAllowed result: ' + isAllowed);
        } else if (api.requestAccess) {
          // Fallback for older API versions
          const accessResult = await api.requestAccess();
          log('requestAccess result: ' + JSON.stringify(accessResult));
          if (accessResult.error) {
            throw new Error('Access denied: ' + accessResult.error);
          }
          isAllowed = true;
        } else {
          throw new Error('Freighter API does not support setAllowed or requestAccess');
        }

        if (!isAllowed) {
          throw new Error('Access denied by user');
        }

        // Get public key
        log('Getting public key...');
        publicKey = await api.getPublicKey();
        
        if (!publicKey || typeof publicKey !== 'string') {
          throw new Error('No valid public key returned from Freighter');
        }

        log('Connected: ' + publicKey);

        // Update UI
        connectBtn.classList.add('hidden');
        payBtn.classList.remove('hidden');

        // Fetch balance
        await updateBalance();

        showStatus('Connected: ' + publicKey.slice(0, 8) + '...' + publicKey.slice(-4), 'success');
        setTimeout(hideStatus, 2000);

      } catch (error) {
        log('Connection error: ' + error.message);
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
          const xlmBalance = account.balances.find(function(b) { return b.asset_type === 'native'; });
          if (xlmBalance) {
            balanceEl.textContent = 'Balance: ' + formatBalance(xlmBalance.balance) + ' XLM';
            balanceEl.classList.remove('hidden');
          }
        }
      } catch (e) {
        log('Failed to fetch balance: ' + e.message);
      }
    }

    // Make payment (handles both XLM and SAC tokens like USDC)
    async function makePayment() {
      payBtn.disabled = true;
      payBtnText.innerHTML = '<span class="spinner"></span> Processing...';
      log('Starting payment...');
      log('Asset type: ' + (isSacToken ? 'SAC Token (' + assetSymbol + ')' : 'Native XLM'));

      try {
        showStatus('Building transaction...', 'loading');

        // Import Stellar SDK from CDN
        const sdkModule = await import('https://cdn.jsdelivr.net/npm/@stellar/stellar-sdk@12.0.1/+esm');
        const StellarSdk = sdkModule.default || sdkModule;
        log('Stellar SDK loaded');

        // Load source account via Horizon
        let server;
        if (StellarSdk.Horizon && StellarSdk.Horizon.Server) {
          server = new StellarSdk.Horizon.Server(horizonUrl);
        } else if (StellarSdk.Server) {
          server = new StellarSdk.Server(horizonUrl);
        } else {
          throw new Error('Could not find Horizon Server in Stellar SDK');
        }

        const sourceAccount = await server.loadAccount(publicKey);
        log('Account loaded: sequence ' + sourceAccount.sequence);

        const timeout = paymentRequirements.maxTimeoutSeconds || 300;
        let signedTxXdr;
        let validUntilLedger;

        if (!isSacToken) {
          // ===== Native XLM Payment =====
          const stroops = BigInt(paymentRequirements.maxAmountRequired);
          const xlmAmount = (Number(stroops) / 10000000).toFixed(7);
          log('Payment amount: ' + xlmAmount + ' XLM');

          let txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: networkPassphrase,
          });

          txBuilder = txBuilder.addOperation(
            StellarSdk.Operation.payment({
              destination: paymentRequirements.payTo,
              asset: StellarSdk.Asset.native(),
              amount: xlmAmount,
            })
          );

          txBuilder = txBuilder.setTimeout(timeout);
          const tx = txBuilder.build();
          log('XLM transaction built');

          // Sign with Freighter
          showStatus('Please sign the transaction in Freighter...', 'loading');
          const api = await loadFreighterApi();
          
          log('Requesting signature...');
          const signResult = await api.signTransaction(tx.toXDR(), {
            networkPassphrase: networkPassphrase,
          });

          if (signResult.error) {
            throw new Error('Signing failed: ' + signResult.error);
          }

          signedTxXdr = signResult.signedTxXdr || signResult;
          if (!signedTxXdr || typeof signedTxXdr !== 'string') {
            throw new Error('No signed transaction returned from Freighter');
          }
          log('Transaction signed');

          // Get current ledger for validUntilLedger
          const ledgerResponse = await server.ledgers().order('desc').limit(1).call();
          validUntilLedger = ledgerResponse.records[0].sequence + Math.ceil(timeout / 5);

        } else {
          // ===== SAC Token Payment (USDC, etc.) via Soroban =====
          log('Building SAC token transfer via Soroban...');
          showStatus('Building Soroban contract call...', 'loading');

          // Connect to Soroban RPC
          let sorobanServer;
          if (StellarSdk.rpc && StellarSdk.rpc.Server) {
            sorobanServer = new StellarSdk.rpc.Server(sorobanRpcUrl);
          } else if (StellarSdk.SorobanRpc && StellarSdk.SorobanRpc.Server) {
            sorobanServer = new StellarSdk.SorobanRpc.Server(sorobanRpcUrl);
          } else {
            throw new Error('Soroban RPC not available in Stellar SDK');
          }

          // Build SEP-41 transfer: transfer(from, to, amount)
          const contractAddress = paymentRequirements.asset;
          const rawAmount = paymentRequirements.maxAmountRequired;

          log('Contract: ' + contractAddress);
          log('From: ' + publicKey);
          log('To: ' + paymentRequirements.payTo);
          log('Amount (raw): ' + rawAmount);

          // Helper to create ScVal for address
          function addressToScVal(address) {
            return StellarSdk.nativeToScVal(address, { type: 'address' });
          }

          // Helper to create ScVal for i128 amount using explicit XDR construction
          // This avoids any auto-conversion that nativeToScVal might apply
          function amountToI128ScVal(amountStr) {
            const amt = BigInt(amountStr);
            log('Converting amount to i128: ' + amt.toString());
            
            // i128 is stored as two 64-bit parts: lo (unsigned) and hi (signed)
            const maxU64 = BigInt('0xFFFFFFFFFFFFFFFF');
            const lo = amt & maxU64;
            const hi = amt >> BigInt(64);
            
            log('i128 lo: ' + lo.toString() + ', hi: ' + hi.toString());
            
            // Use XDR directly to construct the i128 ScVal
            return StellarSdk.xdr.ScVal.scvI128(
              new StellarSdk.xdr.Int128Parts({
                lo: StellarSdk.xdr.Uint64.fromString(lo.toString()),
                hi: StellarSdk.xdr.Int64.fromString(hi.toString())
              })
            );
          }

          // Build the contract invocation
          const contract = new StellarSdk.Contract(contractAddress);
          const transferOp = contract.call(
            'transfer',
            addressToScVal(publicKey),           // from
            addressToScVal(paymentRequirements.payTo), // to
            amountToI128ScVal(rawAmount)         // amount (explicit i128)
          );

          // Build transaction with the contract call
          let txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: '100000', // Higher fee for Soroban
            networkPassphrase: networkPassphrase,
          })
            .addOperation(transferOp)
            .setTimeout(timeout);

          const builtTx = txBuilder.build();
          log('Initial transaction built, simulating...');

          // Simulate to get footprint and auth
          showStatus('Simulating transaction...', 'loading');
          const simulation = await sorobanServer.simulateTransaction(builtTx);

          if (StellarSdk.rpc && StellarSdk.rpc.Api && StellarSdk.rpc.Api.isSimulationError && StellarSdk.rpc.Api.isSimulationError(simulation)) {
            throw new Error('Simulation failed: ' + (simulation.error || 'Unknown error'));
          }
          if (simulation.error) {
            throw new Error('Simulation failed: ' + simulation.error);
          }

          log('Simulation successful');

          // Prepare the transaction with simulation results
          let preparedTx;
          if (StellarSdk.rpc && StellarSdk.rpc.assembleTransaction) {
            preparedTx = StellarSdk.rpc.assembleTransaction(builtTx, simulation).build();
          } else if (StellarSdk.SorobanRpc && StellarSdk.SorobanRpc.assembleTransaction) {
            preparedTx = StellarSdk.SorobanRpc.assembleTransaction(builtTx, simulation).build();
          } else if (sorobanServer.prepareTransaction) {
            preparedTx = await sorobanServer.prepareTransaction(builtTx);
          } else {
            throw new Error('Could not find assembleTransaction in SDK');
          }
          
          log('Transaction prepared with footprint and auth');

          // Sign with Freighter
          showStatus('Please sign the transaction in Freighter...', 'loading');
          const api = await loadFreighterApi();

          log('Requesting signature for Soroban transaction...');
          const signResult = await api.signTransaction(preparedTx.toXDR(), {
            networkPassphrase: networkPassphrase,
          });

          if (signResult.error) {
            throw new Error('Signing failed: ' + signResult.error);
          }

          signedTxXdr = signResult.signedTxXdr || signResult;
          if (!signedTxXdr || typeof signedTxXdr !== 'string') {
            throw new Error('No signed transaction returned from Freighter');
          }
          log('Soroban transaction signed');

          // Get current ledger for validUntilLedger
          const ledgerResponse = await server.ledgers().order('desc').limit(1).call();
          validUntilLedger = ledgerResponse.records[0].sequence + Math.ceil(timeout / 5);
        }

        showStatus('Submitting payment...', 'loading');

        // Build payment payload for x402
        const paymentPayload = {
          x402Version: 1,
          scheme: 'exact',
          network: paymentRequirements.network,
          payload: {
            signedTxXdr: signedTxXdr,
            sourceAccount: publicKey,
            amount: paymentRequirements.maxAmountRequired,
            destination: paymentRequirements.payTo,
            asset: paymentRequirements.asset,
            validUntilLedger: validUntilLedger,
            nonce: crypto.randomUUID(),
          },
        };

        const paymentHeader = btoa(JSON.stringify(paymentPayload));
        log('Payment header created');

        // Submit to server with X-PAYMENT header
        const response = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'X-PAYMENT': paymentHeader,
          },
        });

        if (response.ok) {
          log('Payment successful!');
          showStatus('Payment successful!', 'success');

          // Handle response based on content type
          const contentType = response.headers.get('content-type') || '';
          
          if (contentType.includes('text/html')) {
            // HTML response - replace the page
            document.documentElement.innerHTML = await response.text();
          } else if (contentType.includes('application/json')) {
            // JSON response - display it nicely
            const data = await response.json();
            log('Received JSON response: ' + JSON.stringify(data));
            
            // Hide paywall and show content
            const container = document.querySelector('.paywall-container');
            if (container) {
              const description = paymentRequirements.description || appName;
              const logoHtml = appLogo ? '<img src="' + appLogo + '" alt="' + appName + '" class="paywall-logo">' : stellarLogoSvg;
              const jsonData = JSON.stringify(data, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;');
              
              container.innerHTML = 
                '<div class="paywall-header">' +
                  logoHtml +
                  '<h1 class="paywall-title">PAYMENT SUCCESSFUL</h1>' +
                  '<p class="paywall-subtitle">ACCESS GRANTED TO ' + description.toUpperCase() + '</p>' +
                '</div>' +
                '<div style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 24px; margin-top: 24px;">' +
                  '<h2 style="font-size: 14px; margin-bottom: 16px; color: var(--text-primary); text-transform: uppercase;">Response Data:</h2>' +
                  '<pre style="background: var(--bg-dark); padding: 16px; border: 1px dashed var(--border-color); overflow-x: auto; color: var(--text-primary); font-size: 12px; line-height: 1.6; margin: 0; font-family: monospace;">' + 
                    jsonData +
                  '</pre>' +
                '</div>' +
                '<div style="margin-top: 24px; text-align: center;">' +
                  '<a href="' + currentUrl + '" style="color: var(--text-secondary); text-decoration: none; font-size: 12px; text-transform: uppercase;">[ Return to Content ]</a>' +
                '</div>';
            }
          } else {
            // Other content types - try to display as text
            const text = await response.text();
            const container = document.querySelector('.paywall-container');
            if (container) {
              const escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
              container.innerHTML = 
                '<div class="paywall-header">' +
                  '<h1 class="paywall-title">PAYMENT SUCCESSFUL</h1>' +
                '</div>' +
                '<div style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 24px; margin-top: 24px;">' +
                  '<pre style="background: var(--bg-dark); padding: 16px; border: 1px dashed var(--border-color); overflow-x: auto; color: var(--text-primary); font-size: 12px; white-space: pre-wrap; font-family: monospace;">' + escapedText + '</pre>' +
                '</div>';
            }
          }
        } else {
          const errorData = await response.json().catch(function() { return {}; });
          throw new Error(errorData.error || 'Payment failed: ' + response.status);
        }

      } catch (error) {
        log('Payment error: ' + error.message);
        showStatus(error.message || 'Payment failed', 'error');
        payBtn.disabled = false;
        payBtnText.textContent = 'Pay ' + formattedAmount + ' ' + assetSymbol;
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

    // Check environment on load
    (async function() {
      log('Paywall initialized');

      // Check HTTPS
      if (!checkHttps()) {
        log('HTTPS check failed');
        return;
      }

      // Wait a bit for extension to be ready
      await new Promise(function(r) { setTimeout(r, 1000); });

      // Try auto-connect if already authorized
      try {
        const available = await isFreighterAvailable();
        if (available) {
          log('Checking if already connected...');
          const api = await loadFreighterApi();
          
          publicKey = await api.getPublicKey();
          
          if (publicKey && typeof publicKey === 'string') {
            log('Already connected: ' + publicKey);

            connectBtn.classList.add('hidden');
            payBtn.classList.remove('hidden');
            await updateBalance();

            showStatus('Wallet connected: ' + publicKey.slice(0, 8) + '...' + publicKey.slice(-4), 'success');
            setTimeout(hideStatus, 2000);
          }
        }
      } catch (e) {
        // Not connected yet, that's fine
        log('Not yet authorized or Freighter not available: ' + e.message);
      }
    })();
  </script>
</body>
</html>`;
}
