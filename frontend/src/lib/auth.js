import { verifyMessage } from "ethers";

// A lightweight "Sign-In with Ethereum" style flow. There is no
// backend to issue sessions here, so a "session" is really just proof
// that the connected address actually signed a message (not just that
// someone typed an address into a form), kept in the browser's
// sessionStorage. The real access control still happens on chain,
// every privileged contract call is independently checked by
// GovRegistry. This layer exists purely so the UI can gate the
// Official Portal behind a deliberate sign-in step instead of quietly
// unlocking privileged screens as soon as a wallet connects.

const SESSION_KEY_PREFIX = "govledger.session.";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sessionKey(chainId) {
  return `${SESSION_KEY_PREFIX}${chainId}`;
}

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildSignInMessage({ address, chainId, nonce, issuedAt }) {
  return [
    "GovLedger wants you to sign in as a government official.",
    "",
    `Address: ${address}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt}`,
    "",
    "This signature only proves you control this wallet. It does not send a transaction and costs no gas.",
  ].join("\n");
}

/// Asks the connected signer to sign a fresh sign-in message, then
/// stores the result in sessionStorage for this tab. Throws if the
/// user rejects the signature request.
export async function signIn(signer, address, chainId) {
  const nonce = randomNonce();
  const issuedAt = new Date().toISOString();
  const message = buildSignInMessage({ address, chainId, nonce, issuedAt });

  const signature = await signer.signMessage(message);

  const session = { address, chainId, nonce, issuedAt, signature };
  sessionStorage.setItem(sessionKey(chainId), JSON.stringify(session));
  return session;
}

export function signOut(chainId) {
  sessionStorage.removeItem(sessionKey(chainId));
}

/// Reads back whatever session is stored for this chain and checks it
/// still recovers to `address` and hasn't expired. Returns null if
/// there is no valid session, so callers can just check truthiness.
export function getValidSession(address, chainId) {
  const raw = sessionStorage.getItem(sessionKey(chainId));
  if (!raw) return null;

  let session;
  try {
    session = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!address || session.address?.toLowerCase() !== address.toLowerCase()) return null;

  const issuedAtMs = new Date(session.issuedAt).getTime();
  if (!issuedAtMs || Date.now() - issuedAtMs > SESSION_TTL_MS) {
    sessionStorage.removeItem(sessionKey(chainId));
    return null;
  }

  const message = buildSignInMessage(session);
  try {
    const recovered = verifyMessage(message, session.signature);
    if (recovered.toLowerCase() !== session.address.toLowerCase()) return null;
  } catch {
    return null;
  }

  return session;
}
