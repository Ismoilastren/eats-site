"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { db, doc, onSnapshot } from "@repo/firebase-config";

export const SettingsContext = createContext<any>(null);

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState({
    baseDeliveryFee: 0,
    feePerKm: 0,
    taxRate: 0,
  });

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "global"),
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings(prev => ({ ...prev, ...docSnap.data() }));
        }
      },
      () => {
        // Keep the zero-fee fallback when production rules are not deployed yet.
      },
    );
    return () => unsub();
  }, []);

  return <SettingsContext.Provider value={{ settings }}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);
