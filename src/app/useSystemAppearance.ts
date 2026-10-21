import { useEffect, useState } from "react";
import { watchApi } from "../api";

export function useSystemAppearance(darkMode: boolean) {
  const [primaryColor, setPrimaryColor] = useState("#e88faf");
  const [secondaryColor, setSecondaryColor] = useState("#7ea9d2");

  useEffect(() => {
    const apply = (appearance: {
      primaryColor?: string;
      secondaryColor?: string;
    } | null) => {
        const color = appearance?.primaryColor;
        if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) setPrimaryColor(color);
        const secondary = appearance?.secondaryColor;
        if (typeof secondary === "string" && /^#[0-9a-f]{6}$/i.test(secondary)) setSecondaryColor(secondary);
    };
    return watchApi<{ appearance: Parameters<typeof apply>[0] }>(
      "/settings/appearance",
      ({ appearance }) => apply(appearance),
      (error) => console.error("Could not load system appearance:", error),
    );
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--p1", primaryColor);
    root.style.setProperty("--p2", secondaryColor);
    root.style.setProperty(
      "--p1-soft",
      `color-mix(in srgb, ${primaryColor} ${darkMode ? "28%" : "12%"}, ${darkMode ? "#1e293b" : "white"})`
    );
    root.style.setProperty(
      "--p2-soft",
      `color-mix(in srgb, ${secondaryColor} ${darkMode ? "25%" : "10%"}, ${darkMode ? "#1e293b" : "white"})`
    );
  }, [primaryColor, secondaryColor, darkMode]);

  return { primaryColor, secondaryColor };
}