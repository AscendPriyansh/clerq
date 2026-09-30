"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";
const key = "clerq-theme";
const eventName = "clerq-theme-change";
let memory: Theme | undefined;
function preference(): Theme {
  if (memory) return memory;
  try {
    const saved = localStorage.getItem(key);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch { return "system"; }
}
function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
function subscribe(callback: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const update = () => { apply(preference()); callback(); };
  const storageUpdate = () => { memory = undefined; update(); };
  window.addEventListener("storage", storageUpdate);
  window.addEventListener(eventName, update);
  media.addEventListener("change", update);
  update();
  return () => {
    window.removeEventListener("storage", storageUpdate);
    window.removeEventListener(eventName, update);
    media.removeEventListener("change", update);
  };
}
export function ThemeControl() {
  const theme = useSyncExternalStore(subscribe, preference, () => "system" as Theme);
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return <div className="theme-control">
    <Icon size={16} aria-hidden="true" />
    <label><span className="sr-only">Colour theme</span><select aria-label="Colour theme" value={theme} onChange={event => {
      const next = event.target.value as Theme;
      memory = next;
      try { localStorage.setItem(key, next); } catch { /* Still apply for this page when storage is unavailable. */ }
      apply(next);
      window.dispatchEvent(new Event(eventName));
    }}><option value="system">System theme</option><option value="light">Light mode</option><option value="dark">Dark mode</option></select></label>
  </div>;
}
