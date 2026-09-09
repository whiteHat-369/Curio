import { useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";
const KEY = "curio-theme";

export const ACCENTS = [
  { id: "blue", label: "Blue", hue: 258 },
  { id: "indigo", label: "Indigo", hue: 275 },
  { id: "teal", label: "Teal", hue: 200 },
  { id: "emerald", label: "Emerald", hue: 155 },
  { id: "slate", label: "Slate", hue: 240, chroma: 0.03 },
  { id: "amber", label: "Amber", hue: 80, chroma: 0.13 },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

const ACCENT_KEY = "curio-accent";
const ACCENT_STYLE_ID = "curio-accent-style";

function applyAccent(accentId: string) {
  const accent = ACCENTS.find((a) => a.id === accentId) ?? ACCENTS[0];
  const chroma = "chroma" in accent ? accent.chroma : 0.19;
  const light = `oklch(0.62 ${chroma} ${accent.hue})`;
  const dark = `oklch(0.68 ${chroma} ${accent.hue})`;
  let styleEl = document.getElementById(ACCENT_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = ACCENT_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    :root { --primary: ${light}; --ring: ${light}; --sidebar-primary: ${light}; --sidebar-ring: ${light}; }
    .dark { --primary: ${dark}; --ring: ${dark}; --sidebar-primary: ${dark}; --sidebar-ring: ${dark}; }
  `;
}

export function useAccent() {
  const [accent, setAccentState] = useState<string>("blue");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(ACCENT_KEY);
    } catch {}
    const initial = stored ?? "blue";
    setAccentState(initial);
    applyAccent(initial);
  }, []);

  const setAccent = useCallback((id: string) => {
    setAccentState(id);
    applyAccent(id);
    try {
      localStorage.setItem(ACCENT_KEY, id);
    } catch {}
  }, []);

  return { accent, setAccent, accents: ACCENTS };
}

function apply(t: Theme) {
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    let stored: Theme | null = null;
    try {
      stored = (localStorage.getItem(KEY) as Theme | null) ?? null;
    } catch {}
    const initial: Theme = stored ?? "dark";
    setThemeState(initial);
    apply(initial);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    apply(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
