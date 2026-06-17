import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
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
