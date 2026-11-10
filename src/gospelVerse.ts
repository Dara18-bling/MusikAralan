export const BIBLE_VERSION = "tgl_bib";
export const BIBLE_TRANSLATION_NAME = "Ang Salita ng Diyos";
export const BIBLE_ATTRIBUTION = "Biblica, Inc.";
export const BIBLE_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";
const BIBLE_API_URL = "https://bible.helloao.org/api";

export interface BibleBook {
  id: string;
  name: string;
  commonName: string;
  numberOfChapters: number;
}

interface BibleChapterPayload {
  chapter?: {
    content?: unknown;
  };
}

const chapterCache = new Map<string, Promise<Map<number, string>>>();

function assertResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`Bible verse request failed with status ${response.status}.`);
  }
}

export async function fetchBibleBooks(signal: AbortSignal): Promise<BibleBook[]> {
  const response = await fetch(
    `${BIBLE_API_URL}/${BIBLE_VERSION}/books.json`,
    { signal },
  );
  assertResponse(response);

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("books" in payload)) {
    throw new Error("The Bible service returned an invalid book list.");
  }

  const books = (payload as { books: unknown }).books;
  if (
    !Array.isArray(books) ||
    !books.every(
      (book) =>
        book &&
        typeof book === "object" &&
        typeof book.id === "string" &&
        typeof book.name === "string" &&
        typeof book.commonName === "string" &&
        Number.isInteger(book.numberOfChapters),
    )
  ) {
    throw new Error("The Bible service returned an invalid book list.");
  }

  return books as BibleBook[];
}

function verseContentText(content: unknown): string {
  if (!Array.isArray(content)) {
    throw new Error("The Bible service returned an invalid verse.");
  }

  const text = content
    .map((part: unknown) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const item = part as { text?: unknown; lineBreak?: unknown };
      if (typeof item.text === "string") return item.text;
      return item.lineBreak === true ? "\n" : "";
    })
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  if (!text) throw new Error("The Bible service returned an empty verse.");
  return text;
}

function loadChapter(book: string, chapter: number): Promise<Map<number, string>> {
  const cacheKey = `${book}/${chapter}`;
  const cached = chapterCache.get(cacheKey);
  if (cached) return cached;

  const request = fetch(`${BIBLE_API_URL}/${BIBLE_VERSION}/${book}/${chapter}.json`)
    .then((response) => {
      assertResponse(response);
      return response.json() as Promise<BibleChapterPayload>;
    })
    .then((payload) => {
      const content = payload.chapter?.content;
      if (!Array.isArray(content)) {
        throw new Error("The Bible service returned an invalid chapter.");
      }

      const verses = new Map<number, string>();
      for (const item of content) {
        if (
          item &&
          typeof item === "object" &&
          (item as { type?: unknown }).type === "verse"
        ) {
          const verse = item as { number?: unknown; content?: unknown };
          if (Number.isInteger(verse.number)) {
            verses.set(
              verse.number as number,
              verseContentText(verse.content),
            );
          }
        }
      }
      return verses;
    })
    .catch((error: unknown) => {
      chapterCache.delete(cacheKey);
      throw error;
    });

  chapterCache.set(cacheKey, request);
  return request;
}

export async function fetchBibleVerseText(
  book: string,
  chapter: number,
  verse: number,
  signal: AbortSignal,
): Promise<string> {
  if (signal.aborted) {
    throw new DOMException("The verse request was cancelled.", "AbortError");
  }

  const chapterRequest = loadChapter(book, chapter);
  const verses = await new Promise<Map<number, string>>((resolve, reject) => {
    const handleAbort = () => {
      signal.removeEventListener("abort", handleAbort);
      reject(new DOMException("The verse request was cancelled.", "AbortError"));
    };
    signal.addEventListener("abort", handleAbort, { once: true });
    chapterRequest.then(
      (result) => {
        signal.removeEventListener("abort", handleAbort);
        resolve(result);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", handleAbort);
        reject(error);
      },
    );
  });

  if (signal.aborted) {
    throw new DOMException("The verse request was cancelled.", "AbortError");
  }

  const text = verses.get(verse);
  if (!text) {
    throw new Error(`Verse ${verse} is not available in ${book} ${chapter}.`);
  }
  return text;
}
