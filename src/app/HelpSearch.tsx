import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api";
import { Btn, Input } from "../ui";
import type { ChatbotResponse } from "../chatbotResponses";

interface HelpSearchProps {
  isAdmin: boolean;
}

export function HelpSearch({ isAdmin }: HelpSearchProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [results, setResults] = useState<ChatbotResponse[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    if (!term || isSearching) return;

    setIsSearching(true);
    setSearchError(false);
    setHasSearched(true);
    setSearchedQuery(term);
    setResults([]);
    try {
      const { data } = await apiGet<{ data: ChatbotResponse[] }>(
        `/chatbot-responses/search?q=${encodeURIComponent(term)}`,
      );
      setResults(data);
    } catch (error) {
      console.error("Could not search help entries:", error);
      setSearchError(true);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-sm"
            aria-label="Close help search"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-search-title"
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-line bg-p1-soft/40 px-5 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-white p-2 text-p1 shadow-sm" aria-hidden="true">
                  <BookOpen className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="help-search-title" className="font-display text-xl font-bold">
                    Search Guides
                  </h2>
                  <p className="mt-1 text-sm text-mute">
                    Search guidance for classes, materials, assessments, and your account.
                  </p>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        navigate("/admin/bot");
                      }}
                      className="mt-2 text-xs font-semibold text-p1 underline underline-offset-2"
                    >
                      Manage help entries
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close help center"
                className="rounded-full p-2 text-mute transition hover:bg-white hover:text-p1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p1)]"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <form onSubmit={search} className="grid gap-3 border-b border-line p-5 sm:px-6">
              <label htmlFor="help-search-query" className="text-sm font-semibold">
                What are you looking for?
              </label>
              <div className="flex gap-2">
                <Input
                  id="help-search-query"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setHasSearched(false);
                    setSearchError(false);
                    setResults([]);
                  }}
                  placeholder="Enter a topic or question"
                  maxLength={200}
                  autoComplete="off"
                />
                <Btn disabled={!query.trim() || isSearching}>
                  <Search className="h-4 w-4" />
                  {isSearching ? "Searching..." : "Search"}
                </Btn>
              </div>
              <p className="text-xs text-mute">
                Submit a search to see all matching help entries.
              </p>
            </form>

            <div className="min-h-40 flex-1 overflow-y-auto p-5 sm:px-6">
              {isSearching && (
                <p role="status" className="py-8 text-center text-sm text-mute">
                  Searching help entries...
                </p>
              )}
              {searchError && (
                <p role="alert" className="py-8 text-center text-sm text-red-600">
                  Help search is unavailable. Please try again.
                </p>
              )}
              {!isSearching && !searchError && !hasSearched && (
                <p className="py-8 text-center text-sm text-mute">
                  Search by keyword or phrase to find relevant help.
                </p>
              )}
              {!isSearching && !searchError && hasSearched && results.length === 0 && (
                <p className="py-8 text-center text-sm text-mute">
                  No help entries matched. Try a different keyword or phrase.
                </p>
              )}
              {!isSearching && !searchError && results.length > 0 && (
                <section aria-live="polite" aria-label={`Help search results for ${searchedQuery}`}>
                  <p className="mb-3 text-sm text-mute">
                    {results.length} {results.length === 1 ? "match" : "matches"} for{" "}
                    <span className="font-semibold text-ink">&ldquo;{searchedQuery}&rdquo;</span>
                  </p>
                  <ul className="space-y-3">
                    {results.map((result, index) => (
                      <li
                        key={`${result.id}-${index}`}
                        className="rounded-2xl border border-line bg-white p-4 shadow-sm"
                      >
                        <h3 className="font-semibold text-p1">{result.keywords}</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                          {result.response}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </section>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close help center" : "Open help center"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="grad ml-auto flex h-14 items-center gap-2 rounded-full px-5 text-base font-semibold text-white shadow-xl transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p1)]"
      >
        {open ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        {open ? "Close" : "Search Guides"}
      </button>
    </div>
  );
}
