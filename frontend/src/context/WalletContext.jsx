import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  hasInjectedWallet,
  requestAccounts,
  getSigner,
  ensureCorrectNetwork,
  subscribeToWalletEvents,
} from "../lib/wallet.js";
import { CHAIN_ID } from "../lib/config.js";
import { getReadRegistry } from "../lib/contracts.js";
import { signIn as siweSignIn, signOut as siweSignOut, getValidSession } from "../lib/auth.js";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [signer, setSigner] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [myDepartments, setMyDepartments] = useState([]); // [{ id, name, role }]
  const [rolesLoading, setRolesLoading] = useState(false);

  const [session, setSession] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  const canAccessPortal = isSuperAdmin || myDepartments.length > 0;
  const isSignedIn = Boolean(session);

  const refreshRoleInfo = useCallback(async (account) => {
    if (!account) {
      setIsSuperAdmin(false);
      setMyDepartments([]);
      return;
    }
    setRolesLoading(true);
    try {
      const registry = getReadRegistry();
      const adminRole = await registry.DEFAULT_ADMIN_ROLE();
      const isAdmin = await registry.hasRole(adminRole, account);
      setIsSuperAdmin(isAdmin);

      const count = await registry.getDepartmentCount();
      const ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
      const results = await Promise.all(
        ids.map(async (id) => {
          const [isHead, isOfficial] = await Promise.all([
            registry.isDepartmentHead(account, id),
            registry.isOfficialOfDepartment(account, id),
          ]);
          if (!isHead && !isOfficial) return null;
          const dept = await registry.getDepartment(id);
          return { id, name: dept.name, role: isHead ? "head" : "official" };
        })
      );
      setMyDepartments(results.filter(Boolean));
    } catch (err) {
      setIsSuperAdmin(false);
      setMyDepartments([]);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      if (!hasInjectedWallet()) {
        throw new Error("No wallet detected. Install MetaMask and reload the page.");
      }
      await ensureCorrectNetwork();
      const accounts = await requestAccounts();
      const newSigner = await getSigner();
      const network = await newSigner.provider.getNetwork();
      const newChainId = Number(network.chainId);

      setAddress(accounts[0]);
      setChainId(newChainId);
      setSigner(newSigner);
      setSession(getValidSession(accounts[0], newChainId));
      await refreshRoleInfo(accounts[0]);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setConnecting(false);
    }
  }, [refreshRoleInfo]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setIsSuperAdmin(false);
    setMyDepartments([]);
    setSession(null);
  }, []);

  const signIn = useCallback(async () => {
    if (!signer || !address || chainId === null) return false;
    setError(null);
    setSigningIn(true);
    try {
      const newSession = await siweSignIn(signer, address, chainId);
      setSession(newSession);
      return true;
    } catch (err) {
      setError(err.message || String(err));
      return false;
    } finally {
      setSigningIn(false);
    }
  }, [signer, address, chainId]);

  const signOut = useCallback(() => {
    if (chainId !== null) siweSignOut(chainId);
    setSession(null);
  }, [chainId]);

  useEffect(() => {
    const unsubscribe = subscribeToWalletEvents({
      onAccountsChanged: async (accounts) => {
        if (!accounts || accounts.length === 0) {
          disconnect();
          return;
        }
        const newSigner = await getSigner();
        const network = await newSigner.provider.getNetwork();
        const newChainId = Number(network.chainId);
        setAddress(accounts[0]);
        setChainId(newChainId);
        setSigner(newSigner);
        setSession(getValidSession(accounts[0], newChainId));
        await refreshRoleInfo(accounts[0]);
      },
      onChainChanged: () => {
        // Simplest safe reaction to a chain switch in a prototype: just
        // reload so every piece of state (including any session, which
        // is chain scoped) is consistent again.
        window.location.reload();
      },
    });
    return unsubscribe;
  }, [disconnect, refreshRoleInfo]);

  const value = useMemo(
    () => ({
      address,
      chainId,
      signer,
      connecting,
      error,
      isSuperAdmin,
      myDepartments,
      rolesLoading,
      canAccessPortal,
      isSignedIn,
      signingIn,
      isCorrectNetwork: chainId === null || chainId === CHAIN_ID,
      connect,
      disconnect,
      signIn,
      signOut,
      refreshRoleInfo: () => refreshRoleInfo(address),
    }),
    [
      address,
      chainId,
      signer,
      connecting,
      error,
      isSuperAdmin,
      myDepartments,
      rolesLoading,
      canAccessPortal,
      isSignedIn,
      signingIn,
      connect,
      disconnect,
      signIn,
      signOut,
      refreshRoleInfo,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside a WalletProvider");
  return ctx;
}
