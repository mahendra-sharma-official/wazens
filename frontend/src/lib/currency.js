import { formatEther } from "ethers";

// ---------------------------------------------------------------------
// Currency display layer.
//
// Every amount in GovLedger's contracts (allocated budgets, spending,
// bid amounts, tender estimates) is stored on chain as a plain
// uint256, formatted with 18 decimals purely as a convenient scale to
// reuse ethers' ether-formatting helpers (see format.js / README
// "Moving beyond the prototype" -> Currency units). It is NOT real
// ETH and never touches a wallet's balance.
//
// For a Nepal-facing audience, showing that number as "120.5 ETH" is
// actively confusing: it looks like a cryptocurrency amount, invites
// people to price-check it against real ETH, and is unfamiliar to a
// citizen or official who thinks in rupees. This module lets the app
// display the exact same underlying value labelled and scaled as
// Nepalese Rupees instead, alongside the option to see the raw
// on-chain unit for anyone who wants it (developers, auditors).
//
// This file is intentionally standalone: it does not change what is
// stored on chain, does not change any existing export's behavior
// unless the user opts in, and can be deleted without breaking
// anything else in the app.
// ---------------------------------------------------------------------

const STORAGE_KEY = "govledger.currencyDisplay"; // "npr" | "unit"
const PREFERENCE_EVENT = "govledger:currency-preference-changed";

// Illustrative conversion: how many NPR one on-chain "budget unit"
// (i.e. one whole token at 18-decimal scale, same numeric scale as
// 1 ETH) represents for demo purposes. A real deployment would wire
// this to whatever the underlying settlement unit actually is (e.g.
// 1:1 if the ledger unit *is* NPR-pegged, or a live rate if it is
// wrapping an actual stablecoin). Kept as a single exported constant
// so it's obvious where to change it, and documented loudly rather
// than silently assumed.
export const DEMO_NPR_PER_UNIT = 1000;

export function getCurrencyDisplay() {
  if (typeof window === "undefined") return "npr";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "unit" ? "unit" : "npr"; // default to NPR: the friendlier option
}

export function setCurrencyDisplay(display) {
  if (typeof window === "undefined") return;
  const value = display === "unit" ? "unit" : "npr";
  window.localStorage.setItem(STORAGE_KEY, value);
  window.dispatchEvent(new CustomEvent(PREFERENCE_EVENT, { detail: value }));
}

export function subscribeToCurrencyDisplay(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = (e) => callback(e.detail);
  window.addEventListener(PREFERENCE_EVENT, handler);
  return () => window.removeEventListener(PREFERENCE_EVENT, handler);
}

function formatNpr(nprAmount) {
  return (
    "Rs " +
    nprAmount.toLocaleString("en-NP", {
      maximumFractionDigits: 0,
    })
  );
}

function formatUnit(value) {
  return Number(formatEther(value)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

/// Formats an on-chain budget-scale value (uint256, 18 decimals)
/// according to the current display preference. Safe to call from
/// anywhere; reads the current preference fresh each time so it
/// always reflects the latest toggle state without needing React
/// context wiring.
export function formatCurrencyValue(value, displayOverride) {
  const display = displayOverride || getCurrencyDisplay();
  if (display === "unit") {
    return formatUnit(value) + " units";
  }
  const units = Number(formatEther(value));
  const npr = units * DEMO_NPR_PER_UNIT;
  return formatNpr(npr);
}