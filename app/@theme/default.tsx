"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function ThemeSlot() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const dark = mounted && resolvedTheme === "dark";
  const label = mounted ? `Switch to ${dark ? "light" : "dark"} mode` : "Toggle color theme";

  return (
    <Button
      variant="outline"
      size="icon-lg"
      disabled={!mounted}
      aria-label={label}
      title={label}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
    </Button>
  );
}
