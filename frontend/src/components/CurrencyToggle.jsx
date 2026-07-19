import { useCurrencyDisplay } from "../hooks/useCurrencyDisplay.js";

// Drop this anywhere in the chrome (Header.jsx is the natural spot,
// next to ConnectButton) to let visitors pick how amounts are shown
// across the whole site. Defaults to NRS, since that's the currency
// most visitors to a Nepal government transparency site actually
// think in. "On-chain unit" is kept available for anyone who wants
// the raw ledger-scale number (developers, auditors comparing against
// contract state directly).
export function CurrencyToggle() {
  const [display, setDisplay] = useCurrencyDisplay();

  return (
    <div className="currency-toggle" role="group" aria-label="Currency display">
      <button
        type="button"
        className={display === "npr" ? "currency-toggle-btn currency-toggle-btn-active" : "currency-toggle-btn"}
        onClick={() => setDisplay("npr")}
      >
        NRS
      </button>
      <button
        type="button"
        className={display === "unit" ? "currency-toggle-btn currency-toggle-btn-active" : "currency-toggle-btn"}
        onClick={() => setDisplay("unit")}
      >
        On-chain unit
      </button>
    </div>
  );
}