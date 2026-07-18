import { formatEther } from "ethers";

export function shortAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

export function formatBudget(value) {
  // Budgets are stored as wei-scale numbers on chain purely so we can
  // reuse ether's 18 decimal formatting as a stand in for a generic
  // currency amount in this prototype. Swap this for your real
  // currency's decimals when you move past the demo stage.
  return Number(formatEther(value)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
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
