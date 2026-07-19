import { useEffect, useState } from "react";
import { getCurrencyDisplay, setCurrencyDisplay, subscribeToCurrencyDisplay } from "../lib/currency.js";

// Exposes the current currency display preference ("npr" | "unit")
// and keeps components subscribed so a toggle anywhere (e.g. the
// header CurrencyToggle) updates every visible amount immediately,
// without needing to lift state through the whole app or remount it.
export function useCurrencyDisplay() {
  const [display, setDisplay] = useState(getCurrencyDisplay);

  useEffect(() => {
    return subscribeToCurrencyDisplay(setDisplay);
  }, []);

  return [display, setCurrencyDisplay];
}