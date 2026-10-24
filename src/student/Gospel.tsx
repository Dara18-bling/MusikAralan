import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { Card, Label } from "../ui";

const VERSE_VERSION = "en-kjv";
const VERSES = [
  { book: "john", bookName: "John", chapter: 3, verse: 16 },
  { book: "psalms", bookName: "Psalms", chapter: 23, verse: 1 },
  { book: "proverbs", bookName: "Proverbs", chapter: 3, verse: 5 },
  { book: "philippians", bookName: "Philippians", chapter: 4, verse: 13 },
  { book: "romans", bookName: "Romans", chapter: 8, verse: 28 },
  { book: "matthew", bookName: "Matthew", chapter: 5, verse: 16 },
] as const;

function getDailyVerseIndex() {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(today / 86_400_000) % VERSES.length;
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
  const [verseIndex, setVerseIndex] = useState(getDailyVerseIndex);
  const [verseText, setVerseText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const verse = VERSES[verseIndex];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setVerseText("");

    const url = `https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/${VERSE_VERSION}/books/${verse.book}/chapters/${verse.chapter}/verses/${verse.verse}.json`;
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
        setError(
          "The verse could not be loaded right now. Please try another verse.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [verse]);

  const moveVerse = (direction: number) => {
    setVerseIndex(
      (current) => (current + direction + VERSES.length) % VERSES.length,
    );
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label>Gospel</Label>
          <h2 className="mt-2 font-display text-2xl">A verse for today</h2>
        </div>
        <BookOpen className="h-7 w-7 shrink-0 text-p1" aria-hidden="true" />
      </div>
      <p className="mt-4 min-h-12 text-base leading-relaxed" aria-live="polite">
        {loading ? "Loading verse…" : error || `“${verseText}”`}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-p1">
          {verse.bookName} {verse.chapter}:{verse.verse} · {VERSE_VERSION}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => moveVerse(-1)}
            aria-label="Previous Bible verse"
            className="rounded-full border border-line p-2 text-p1 transition hover:bg-p1-soft"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => moveVerse(1)}
            aria-label="Next Bible verse"
            className="rounded-full border border-line p-2 text-p1 transition hover:bg-p1-soft"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Card>
  );
}
