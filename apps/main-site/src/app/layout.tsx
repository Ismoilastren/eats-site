import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import 'leaflet/dist/leaflet.css';
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { CartProvider } from "@/context/CartContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "2(13) - Food Delivery",
  description: "Order food from the best restaurants in town",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <SettingsProvider>
          <CartProvider>
            <Suspense fallback={<div className="h-20 bg-white border-b border-gray-200 w-full animate-pulse"></div>}>
              <Navbar />
            </Suspense>
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </CartProvider>
        </SettingsProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
