"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={client}>
        {children}
        {/* Toasts: push down just enough to clear the notch. The safe-area
            margin on the root wrapper already shifts the app down; toasts
            just need a small extra gap so they don't touch the status bar. */}
        <style>{`
          [data-sonner-toaster] {
            top: calc(env(safe-area-inset-top, 0px) + 8px) !important;
          }
        `}</style>
        <Toaster
          position="top-center"
          richColors
          closeButton
          style={{
            zIndex: 9999,
          }}
          toastOptions={{
            style: {
              maxWidth: "calc(100vw - 1rem)",
              zIndex: 9999,
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
