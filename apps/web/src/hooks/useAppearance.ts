import { useEffect } from "react";
import { useSettings } from "./useSettings";

const DEFAULT_FONT_STACK =
  '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const SYSTEM_FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const MONOCRAFT_FONT_STACK = '"Monocraft", "DM Sans", system-ui, sans-serif';

function resolveFontFamily(input: {
  font: "default" | "monocraft" | "system" | "custom";
  customFontFamily: string;
}) {
  if (input.font === "system") {
    return SYSTEM_FONT_STACK;
  }
  if (input.font === "monocraft") {
    return MONOCRAFT_FONT_STACK;
  }
  if (input.font === "custom" && input.customFontFamily.trim().length > 0) {
    return `${input.customFontFamily.trim()}, ${DEFAULT_FONT_STACK}`;
  }
  return DEFAULT_FONT_STACK;
}

export function useAppearance() {
  const appearance = useSettings((settings) => settings.appearance);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = appearance.accent;
    root.dataset.font = appearance.font;
    root.style.setProperty(
      "--app-font-body",
      resolveFontFamily({
        font: appearance.font,
        customFontFamily: appearance.customFontFamily,
      }),
    );
    return () => {
      delete root.dataset.accent;
      delete root.dataset.font;
      root.style.removeProperty("--app-font-body");
    };
  }, [appearance.accent, appearance.customFontFamily, appearance.font]);
}
