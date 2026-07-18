import { useCallback, useState } from "react";

// Wraps the common "send a transaction, wait for it, show status"
// pattern used by every write form in the app, so each form only has
// to describe what call to make, not how to track its lifecycle.
export function useTxRunner() {
  const [status, setStatus] = useState("idle"); // idle | pending | success | error
  const [message, setMessage] = useState("");

  const run = useCallback(async (fn, { successMessage = "Transaction confirmed" } = {}) => {
    setStatus("pending");
    setMessage("Waiting for confirmation in your wallet...");
    try {
      const tx = await fn();
      setMessage("Transaction sent, waiting for it to be mined...");
      await tx.wait();
      setStatus("success");
      setMessage(successMessage);
      return true;
    } catch (err) {
      setStatus("error");
      setMessage(extractErrorMessage(err));
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setMessage("");
  }, []);

  return { status, message, run, reset };
}

function extractErrorMessage(err) {
  if (err?.reason) return err.reason;
  if (err?.shortMessage) return err.shortMessage;
  if (err?.info?.error?.message) return err.info.error.message;
  if (err?.message) return err.message;
  return "Something went wrong sending that transaction.";
}
