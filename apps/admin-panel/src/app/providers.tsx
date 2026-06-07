'use client';

import { ThemeProvider } from 'next-themes';
import { SidebarProvider } from '@/context/SidebarContext';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <SidebarProvider>
          {children}
          <Toaster position="top-right" />
        </SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
