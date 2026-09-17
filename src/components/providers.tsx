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
        {/* Sonner's `offset` prop adds margin from the viewport edge.
            We use a CSS calc with env(safe-area-inset-top) + 56px so toasts
            appear well below the iOS notch + status bar on PWAs.
            On desktop (no safe-area), this resolves to 56px which is fine. */}
        <style>{`
          [data-sonner-toaster] {
            top: calc(env(safe-area-inset-top, 0px) + 56px) !important;
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
