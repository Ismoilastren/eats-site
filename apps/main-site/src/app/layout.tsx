import type { Metadata, Viewport } from "next";
import "./globals.css";
import 'leaflet/dist/leaflet.css';
import { CartProvider } from "@/context/CartContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { MarketplaceProvider } from "@/context/MarketplaceContext";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "2(13) Delivery - Food delivery in Tashkent",
  description: "Order meals, groceries, coffee, and desserts from local restaurants in Tashkent.",
};

export const viewport: Viewport = {
  themeColor: "#21201f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[120] -translate-y-24 rounded-full bg-[var(--accent)] px-5 py-3 font-black text-[var(--accent-text)] transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <SettingsProvider>
          <CartProvider>
            <MarketplaceProvider>
              <main className="flex-1">{children}</main>
            </MarketplaceProvider>
          </CartProvider>
        </SettingsProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
