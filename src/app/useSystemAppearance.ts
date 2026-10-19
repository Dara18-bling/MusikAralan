import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export function useSystemAppearance(darkMode: boolean) {
  const [primaryColor, setPrimaryColor] = useState("#e88faf");
  const [secondaryColor, setSecondaryColor] = useState("#7ea9d2");

  useEffect(() => {
    return onSnapshot(
      doc(db, "settings", "appearance"),
      (snapshot) => {
        const color = snapshot.data()?.primaryColor;
        if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) setPrimaryColor(color);
        const secondary = snapshot.data()?.secondaryColor;
        if (typeof secondary === "string" && /^#[0-9a-f]{6}$/i.test(secondary)) setSecondaryColor(secondary);
      },
      (error) => console.error("Could not load system appearance:", error)
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