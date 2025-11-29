/**
 * Paywall Module
 *
 * Exports for the Stellar paywall UI.
 */

export { getPaywallHtml, type PaywallConfig, type GetPaywallHtmlOptions } from "./template.js";
export {
  isStellarNetwork,
  isTestnetNetwork,
  getNetworkDisplayName,
  formatStroopsToXLM,
  formatAmount,
  chooseStellarPaymentRequirement,
} from "./paywallUtils.js";

