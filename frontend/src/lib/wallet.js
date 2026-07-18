import { BrowserProvider } from "ethers";
import { CHAIN_ID, CHAIN_ID_HEX, RPC_URL, NETWORK_NAME } from "./config.js";

// All MetaMask interaction is isolated in this file. If you later want
// to support WalletConnect or another provider, this is the only file
// that needs a new implementation behind the same functions.

export function hasInjectedWallet() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export async function requestAccounts() {
  if (!hasInjectedWallet()) {
    throw new Error("No wallet found. Install MetaMask to continue.");
  }
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts;
}

export async function getProvider() {
  if (!hasInjectedWallet()) {
    throw new Error("No wallet found. Install MetaMask to continue.");
  }
  return new BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = await getProvider();
  return provider.getSigner();
}

/// Ensures MetaMask is pointed at the local anvil chain used by this
/// prototype. Adds the network if MetaMask does not know it yet, then
/// asks the user to switch to it.
export async function ensureCorrectNetwork() {
  if (!hasInjectedWallet()) {
    throw new Error("No wallet found. Install MetaMask to continue.");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (switchError) {
    // 4902 = chain not added yet in MetaMask.
    if (switchError && switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN_ID_HEX,
            chainName: NETWORK_NAME,
            rpcUrls: [RPC_URL],
            nativeCurrency: { name: "Test ETH", symbol: "ETH", decimals: 18 },
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

export function subscribeToWalletEvents({ onAccountsChanged, onChainChanged }) {
  if (!hasInjectedWallet()) return () => {};

  if (onAccountsChanged) window.ethereum.on("accountsChanged", onAccountsChanged);
  if (onChainChanged) window.ethereum.on("chainChanged", onChainChanged);

  return () => {
    if (onAccountsChanged) window.ethereum.removeListener("accountsChanged", onAccountsChanged);
    if (onChainChanged) window.ethereum.removeListener("chainChanged", onChainChanged);
  };
}

export { CHAIN_ID };
