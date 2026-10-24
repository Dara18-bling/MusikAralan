import { useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { watchApi } from "../api";

const BIBLE_VERSION = "en-kjv";

interface GospelVerseReference {
  id: number;
  book: string;
  chapter: number;
  verse: number;
}

function getUtcDayNumber(date: Date) {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
      86_400_000,
  );
}

function displayBookName(book: string) {
  return book
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getVerseText(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const result = payload as { text?: unknown; verse?: { text?: unknown } };
    const text = result.text ?? result.verse?.text;
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  throw new Error("The Bible verse service returned an invalid response.");
}

export function Gospel() {
  const [references, setReferences] = useState<GospelVerseReference[]>([]);
  const [today, setToday] = useState(() => new Date());
  const [verseText, setVerseText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(
    () =>
      watchApi<{ data: GospelVerseReference[] }>(
        "/gospel-verses",
        ({ data }) => {
          setReferences(data);
          setError("");
        },
        (requestError) => {
          console.error(
            "Could not load Gospel verse references:",
            requestError,
          );
          setError("The verse rotation is unavailable.");
          setLoading(false);
        },
      ),
    [],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const verse = useMemo(() => {
    if (references.length === 0) return null;
    return references[getUtcDayNumber(today) % references.length];
  }, [references, today]);

  useEffect(() => {
    if (!verse) {
      if (references.length === 0) setLoading(true);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setVerseText("");

    const url = `https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/${BIBLE_VERSION}/books/${verse.book}/chapters/${verse.chapter}/verses/${verse.verse}.json`;
    void fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Bible verse request failed with status ${response.status}.`,
          );
        }
        return getVerseText(await response.json());
      })
      .then(setVerseText)
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Could not load Bible verse:", requestError);
        setError("Verse text could not be loaded right now.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [verse?.book, verse?.chapter, verse?.verse, references.length]);

  return (
    <section className="mt-5 rounded-2xl border border-line bg-p1-soft/60 p-4">
      <div className="flex items-center gap-2 text-p1">
        <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
        <h2 className="font-display text-lg">Gospel of the day</h2>
      </div>
      <p className="mt-3 text-sm leading-relaxed" aria-live="polite">
        {loading
          ? "Loading today's verse…"
          : error ||
            (verseText
              ? `“${verseText}”`
              : "No verses have been added to the rotation yet.")}
      </p>
      {verse && (
        <p className="mt-3 text-xs font-semibold text-p1">
          {displayBookName(verse.book)} {verse.chapter}:{verse.verse} ·{" "}
          {BIBLE_VERSION.toUpperCase()}
        </p>
      )}
    </section>
  );
}
