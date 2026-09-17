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
        {/* Toasts positioned well below the iOS notch/status bar.
            On PWA with black-translucent, the notch is ~47px; we add 44px
            minimum clearance so toasts don't get blurred behind the notch. */}
        <Toaster
          position="top-center"
          richColors
          closeButton
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 44px)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
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
