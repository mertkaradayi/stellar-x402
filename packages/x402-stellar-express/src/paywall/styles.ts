/**
 * Paywall CSS Styles
 *
 * Embedded styles for the Stellar paywall UI.
 */

export const paywallStyles = `
:root {
  --stellar-purple: #7c3aed;
  --stellar-purple-dark: #5b21b6;
  --stellar-blue: #3b82f6;
  --bg-dark: #0f0f1a;
  --bg-card: #1a1a2e;
  --text-primary: #ffffff;
  --text-secondary: #a0aec0;
  --border-color: #2d2d44;
  --success-green: #10b981;
  --error-red: #ef4444;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: linear-gradient(135deg, var(--bg-dark) 0%, #1a1a2e 50%, #16213e 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  padding: 20px;
}

.paywall-container {
  max-width: 420px;
  width: 100%;
  background: var(--bg-card);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  padding: 32px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.paywall-header {
  text-align: center;
  margin-bottom: 24px;
}

.paywall-logo {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
}

.paywall-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  background: linear-gradient(135deg, var(--stellar-purple), var(--stellar-blue));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.paywall-subtitle {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
}

.paywall-amount-section {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(59, 130, 246, 0.1));
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  margin-bottom: 24px;
}

.paywall-amount {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 4px;
}

.paywall-asset {
  color: var(--text-secondary);
  font-size: 14px;
}

.paywall-network {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(124, 58, 237, 0.2);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  color: var(--stellar-purple);
  margin-top: 12px;
}

.paywall-network-dot {
  width: 6px;
  height: 6px;
  background: var(--stellar-purple);
  border-radius: 50%;
}

.paywall-details {
  margin-bottom: 24px;
}

.paywall-detail-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.paywall-detail-row:last-child {
  border-bottom: none;
}

.paywall-detail-label {
  color: var(--text-secondary);
  font-size: 14px;
}

.paywall-detail-value {
  font-size: 14px;
  text-align: right;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.paywall-button {
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.paywall-button-primary {
  background: linear-gradient(135deg, var(--stellar-purple), var(--stellar-blue));
  color: white;
}

.paywall-button-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(124, 58, 237, 0.3);
}

.paywall-button-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.paywall-button-secondary {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  margin-top: 12px;
}

.paywall-button-secondary:hover {
  background: rgba(255, 255, 255, 0.05);
}

.paywall-status {
  text-align: center;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.paywall-status-loading {
  background: rgba(59, 130, 246, 0.1);
  color: var(--stellar-blue);
}

.paywall-status-success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success-green);
}

.paywall-status-error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error-red);
}

.paywall-balance {
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  margin-top: 16px;
}

.paywall-footer {
  text-align: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.paywall-footer a {
  color: var(--stellar-purple);
  text-decoration: none;
  font-size: 13px;
}

.paywall-footer a:hover {
  text-decoration: underline;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Freighter wallet icon */
.wallet-icon {
  width: 20px;
  height: 20px;
}

/* Hidden class */
.hidden {
  display: none !important;
}
`;

