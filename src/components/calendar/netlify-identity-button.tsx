"use client";

import { useEffect, useState } from "react";
import { User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NetlifyUser {
  id: string;
  email: string;
  user_metadata?: { full_name?: string };
}

declare global {
  interface Window {
    netlifyIdentity?: {
      on: (event: string, cb: (user?: NetlifyUser | null) => void) => void;
      off: (event: string, cb: (user?: NetlifyUser | null) => void) => void;
      open: (tab?: string) => void;
      close: () => void;
      currentUser: () => NetlifyUser | null;
      logout: () => void;
    };
  }
}

export function NetlifyIdentityButton() {
  const [user, setUser] = useState<NetlifyUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = () => {
      if (cancelled) return;
      if (window.netlifyIdentity) {
        setReady(true);
        const current = window.netlifyIdentity.currentUser();
        setUser(current);

        const onInit = (u: NetlifyUser | null | undefined) => {
          if (!cancelled) setUser(u ?? null);
        };
        const onLogin = (u: NetlifyUser | null | undefined) => {
          if (!cancelled) {
            setUser(u ?? null);
            // Redirect to home after login to refresh server context.
            if (u) window.location.href = "/";
          }
        };
        const onLogout = () => {
          if (!cancelled) setUser(null);
        };

        window.netlifyIdentity.on("init", onInit);
        window.netlifyIdentity.on("login", onLogin);
        window.netlifyIdentity.on("logout", onLogout);
      } else {
        // Widget not loaded yet — retry.
        setTimeout(init, 300);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || !window.netlifyIdentity) return null;

  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Account">
            <User className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {user.email}
          </div>
          <DropdownMenuItem
            onClick={() => window.netlifyIdentity?.logout()}
          >
            <LogOut className="size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      onClick={() => window.netlifyIdentity?.open("login")}
    >
      <User className="size-4" />
      <span className="hidden sm:inline">Log in</span>
    </Button>
  );
}
