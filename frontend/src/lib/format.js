import { formatEther } from "ethers";
import { formatCurrencyValue } from "./currency.js";

export function shortAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

export function formatBudget(value) {
  // Delegates to lib/currency.js, which shows the same underlying
  // on-chain value either as NRS (default, friendlier for a Nepal
  // audience) or as the raw on-chain unit, based on the user's
  // toggle (see components/CurrencyToggle.jsx).
  return formatCurrencyValue(value);
}

export function formatTimestamp(unixSeconds) {
  const n = Number(unixSeconds);
  if (!n) return "-";
  return new Date(n * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(unixSeconds) {
  const n = Number(unixSeconds);
  if (!n) return "-";
  return new Date(n * 1000).toLocaleString();
}