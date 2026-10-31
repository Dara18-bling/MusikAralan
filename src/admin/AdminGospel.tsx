import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiDelete, apiGet, apiPost } from "../api";
import {
  BIBLE_ATTRIBUTION,
  BIBLE_LICENSE_URL,
  BIBLE_TRANSLATION_NAME,
  fetchBibleBooks,
  fetchBibleVerseText,
  type BibleBook,
} from "../gospelVerse";
import { Card, Input, Label, Title } from "../ui";

interface GospelVerseReference {
  id: number;
  book: string;
  chapter: number;
  verse: number;
}

function VersePreview({
  reference,
  bookName,
}: {
  reference: GospelVerseReference;
  bookName: string;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setText("");
    setError("");
    setLoading(true);

    void fetchBibleVerseText(
      reference.book,
      reference.chapter,
      reference.verse,
      controller.signal,
    )
      .then(setText)
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Could not preview Bible verse:", requestError);
        setError("Verse text could not be loaded right now.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reference.book, reference.chapter, reference.verse]);

  return (
    <div className="rounded-xl bg-p1-soft/60 p-3 text-sm">
      <p className="font-semibold text-p1">
        Preview ·{" "}
        {bookName} {reference.chapter}:{reference.verse} ·{" "}
        {BIBLE_TRANSLATION_NAME}
      </p>
      <p className="mt-2 leading-relaxed" aria-live="polite">
        {loading ? "Loading verse…" : error || `“${text}”`}
      </p>
      <a
        href={BIBLE_LICENSE_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-block text-xs text-mute underline"
      >
        {BIBLE_ATTRIBUTION} · CC BY-SA 4.0
      </a>
    </div>
  );
}

export function AdminGospel() {
  const [references, setReferences] = useState<GospelVerseReference[]>([]);
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [bookCatalogError, setBookCatalogError] = useState("");
  const [book, setBook] = useState("");
  const [chapter, setChapter] = useState("");
  const [verse, setVerse] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewReference, setPreviewReference] =
    useState<GospelVerseReference | null>(null);

  const chapterNumber = Number(chapter);
  const verseNumber = Number(verse);
  const selectedBook = books.find((item) => item.id === book);
  const draftReference =
    selectedBook &&
    Number.isInteger(chapterNumber) &&
    chapterNumber > 0 &&
    chapterNumber <= selectedBook.numberOfChapters &&
    Number.isInteger(verseNumber) &&
    verseNumber > 0
      ? { id: 0, book, chapter: chapterNumber, verse: verseNumber }
      : null;

  useEffect(() => {
    const controller = new AbortController();
    void fetchBibleBooks(controller.signal)
      .then(setBooks)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Could not load Tagalog Bible book catalog:", error);
        setBookCatalogError("Bible book list is unavailable right now.");
      });
    void apiGet<{ data: GospelVerseReference[] }>("/gospel-verses")
      .then(({ data }) => setReferences(data))
      .catch((error: unknown) => {
        console.error("Could not load Gospel verse rotation:", error);
        toast.error("Could not load the Gospel verse rotation.");
      });
    return () => controller.abort();
  }, []);

  const bookName = (bookId: string) =>
    books.find((item) => item.id === bookId)?.name ?? bookId;

  const addReference = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBook) {
      toast.warning("Choose a book of the Bible.");
      return;
    }
    if (
      !Number.isInteger(chapterNumber) ||
      !Number.isInteger(verseNumber) ||
      chapterNumber < 1 ||
      chapterNumber > selectedBook.numberOfChapters ||
      verseNumber < 1
    ) {
      toast.warning("Chapter and verse must be positive whole numbers.");
      return;
    }

    setSaving(true);
    try {
      const { verse: created } = await apiPost<{ verse: GospelVerseReference }>(
        "/gospel-verses",
        {
          book,
          chapter: chapterNumber,
          verse: verseNumber,
        },
      );
      setReferences((current) => [...current, created]);
      setBook("");
      setChapter("");
      setVerse("");
      toast.success("Verse added to the daily rotation.");
    } catch (error) {
      console.error("Could not add Gospel verse:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not add this verse.",
      );
    } finally {
      setSaving(false);
    }
  };

  const removeReference = async (id: number) => {
    try {
      await apiDelete(`/gospel-verses/${id}`);
      setReferences((current) => current.filter((item) => item.id !== id));
      toast.success("Verse removed from the rotation.");
    } catch (error) {
      console.error("Could not remove Gospel verse:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not remove this verse.",
      );
    }
  };

  return (
    <>
      <Title
        kicker="Daily Gospel"
        title="Manage Verse Rotation"
        sub="Add Bible references to the daily rotation shown in every user's sidebar."
      />
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <Label>Add a Bible reference</Label>
          <form className="mt-4 grid gap-3" onSubmit={addReference}>
            <label className="grid gap-1.5 text-sm font-semibold">
              Book of the Bible
              <select
                value={book}
                onChange={(event) => {
                  setBook(event.target.value);
                  setChapter("");
                  setVerse("");
                }}
                disabled={!books.length}
                required
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--p1)] focus:ring-2 focus:ring-p1-soft"
              >
                <option value="" disabled>
                  {books.length ? "Select a book" : "Loading books…"}
                </option>
                {books.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            {bookCatalogError && (
              <p role="alert" className="text-sm text-red-700">{bookCatalogError}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm font-semibold">
                Chapter
                <Input
                  type="number"
                  min="1"
                  max={selectedBook?.numberOfChapters}
                  value={chapter}
                  onChange={(event) => setChapter(event.target.value)}
                  required
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Verse
                <Input
                  type="number"
                  min="1"
                  max="176"
                  value={verse}
                  onChange={(event) => setVerse(event.target.value)}
                  required
                />
              </label>
            </div>
            <p className="text-xs text-mute">
              {BIBLE_TRANSLATION_NAME} · Text attribution: {BIBLE_ATTRIBUTION} (
              <a className="underline" href={BIBLE_LICENSE_URL} target="_blank" rel="noreferrer">
                CC BY-SA 4.0
              </a>
              ).
            </p>
            {draftReference ? (
              <VersePreview
                reference={draftReference}
                bookName={selectedBook?.name ?? book}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-line p-3 text-sm text-mute">
                Select a book, chapter, and verse to preview the verse text.
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="grad w-fit rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add to rotation"}
            </button>
          </form>
        </Card>

        <Card>
          <Label>Current rotation ({references.length})</Label>
          <ul className="mt-3 divide-y divide-line">
            {references.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="font-medium">
                  {bookName(item.book)}{" "}
                  {item.chapter}:{item.verse}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewReference(item)}
                    className="rounded-full border border-p1/40 px-3 py-1.5 text-sm font-semibold text-p1 transition hover:border-p1 hover:bg-p1-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p1)]"
                  >
                    Preview verse
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeReference(item.id)}
                    disabled={references.length <= 1}
                    className="text-sm font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    title={
                      references.length <= 1
                        ? "At least one verse must remain in the rotation."
                        : "Remove this reference"
                    }
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
            {references.length === 0 && (
              <li className="py-4 text-sm text-mute">
                No verses in the rotation yet.
              </li>
            )}
          </ul>
        </Card>
      </div>
      {previewReference && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewReference(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="gospel-verse-preview-title"
            className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <Label>Verse preview</Label>
                <h2
                  id="gospel-verse-preview-title"
                  className="mt-1 font-display text-2xl"
                >
                  {bookName(previewReference.book)}{" "}
                  {previewReference.chapter}:{previewReference.verse}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReference(null)}
                className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-p1-soft"
              >
                Close
              </button>
            </div>
            <VersePreview
              reference={previewReference}
              bookName={bookName(previewReference.book)}
            />
          </section>
        </div>
      )}
    </>
  );
}
