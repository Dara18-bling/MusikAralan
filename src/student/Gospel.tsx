import { useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { watchApi } from "../api";
import {
  BIBLE_ATTRIBUTION,
  BIBLE_LICENSE_URL,
  BIBLE_TRANSLATION_NAME,
  fetchBibleBooks,
  fetchBibleVerseText,
  type BibleBook,
} from "../gospelVerse";

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

export function Gospel() {
  const [references, setReferences] = useState<GospelVerseReference[]>([]);
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [today, setToday] = useState(() => new Date());
  const [verseText, setVerseText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetchBibleBooks(controller.signal)
      .then(setBooks)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          console.error(
            "Could not load Tagalog Bible book catalog:",
            requestError,
          );
        }
      });
    const stopReferences = watchApi<{ data: GospelVerseReference[] }>(
      "/gospel-verses",
      ({ data }) => {
        setReferences(data);
        setError("");
      },
      (requestError) => {
        console.error("Could not load Gospel verse references:", requestError);
        setError("The verse rotation is unavailable.");
        setLoading(false);
      },
    );
    return () => {
      controller.abort();
      stopReferences();
    };
  }, []);

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

    void fetchBibleVerseText(
      verse.book,
      verse.chapter,
      verse.verse,
      controller.signal,
    )
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
        <h2 className="font-display text-lg">Ang Salita ng Diyos</h2>
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
          {books.find((book) => book.id === verse.book)?.name ??
            displayBookName(verse.book)}{" "}
          {verse.chapter}:{verse.verse} · {BIBLE_TRANSLATION_NAME}
        </p>
      )}
      <p className="mt-2 text-xs text-mute">
        Bible text: {BIBLE_ATTRIBUTION} ·{" "}
        <a
          href={BIBLE_LICENSE_URL}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          CC BY-SA 4.0
        </a>
      </p>
      <p className="mt-3 text-xs font-semibold text-p1">
        <a
          href="https://www.awitatpapuri.com/"
          className="bg-white/50 p-2 rounded-4xl"
        >
          See more @ AwitAtPapuri.com
        </a>
      </p>
      <p className="mt-3 text-xs font-semibold italic text-right text-p1/30">
        <a href="https://bible.helloao.org/docs/">API by HelloAO</a> |
        <a href="https://helloao.org/"> Main Site</a>
      </p>
    </section>
  );
}
