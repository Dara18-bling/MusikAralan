import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiDelete, apiGet, apiPost } from "../api";
import { Card, Input, Label, Title } from "../ui";

interface GospelVerseReference {
  id: number;
  book: string;
  chapter: number;
  verse: number;
}

export function AdminGospel() {
  const [references, setReferences] = useState<GospelVerseReference[]>([]);
  const [book, setBook] = useState("");
  const [chapter, setChapter] = useState("");
  const [verse, setVerse] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiGet<{ data: GospelVerseReference[] }>("/gospel-verses")
      .then(({ data }) => setReferences(data))
      .catch((error: unknown) => {
        console.error("Could not load Gospel verse rotation:", error);
        toast.error("Could not load the Gospel verse rotation.");
      });
  }, []);

  const addReference = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const bookSlug = book.trim().toLowerCase().replace(/\s+/g, "-");
    const chapterNumber = Number(chapter);
    const verseNumber = Number(verse);
    if (!/^[a-z]+(?:-[a-z]+)*$/.test(bookSlug)) {
      toast.warning("Enter a valid book name, such as `1-corinthians`.");
      return;
    }
    if (!Number.isInteger(chapterNumber) || !Number.isInteger(verseNumber) || chapterNumber < 1 || verseNumber < 1) {
      toast.warning("Chapter and verse must be positive whole numbers.");
      return;
    }

    setSaving(true);
    try {
      const { verse: created } = await apiPost<{ verse: GospelVerseReference }>(
        "/gospel-verses",
        {
        book: bookSlug,
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
              Book slug
              <Input
                value={book}
                onChange={(event) => setBook(event.target.value)}
                placeholder="e.g. john, 1-corinthians"
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm font-semibold">
                Chapter
                <Input
                  type="number"
                  min="1"
                  max="150"
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
              Use the Bible API book slug, for example `psalms` or `1-john`.
            </p>
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
                  {item.book
                    .split("-")
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(" ")}{" "}
                  {item.chapter}:{item.verse}
                </span>
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
    </>
  );
}
