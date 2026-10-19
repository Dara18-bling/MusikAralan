import { Download, MessageCircle, Smartphone, Type, Video } from "lucide-react";
import { Title } from "../ui";

export function StudentHelp() {
  const guides: [typeof Video, string, string][] = [
    [Smartphone, "How to log in", "2-min video, step by step"],
    [Video, "Joining a Google Meet class", "One tap — we show you where"],
    [Download, "Downloading a song sheet", "Save it for offline use"],
    [Type, "Making text bigger", "Use the A+ button at the top"],
    [MessageCircle, "Using the Chatbot", "Ask our AI helper for quick answers"],
  ];
  return (
    <>
      <Title kicker="Tulong · Help" title="Help Guides & Tutorials" />
      <div className="grid gap-4 sm:grid-cols-2">
        {guides.map(([E, t, s]) => (
          <button
            key={t}
            className="flex items-center gap-4 rounded-2xl border border-line bg-white p-6 text-left transition hover:border-[var(--p1)] cursor-pointer"
          >
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-p1-soft text-p1">
              <E className="h-8 w-8" strokeWidth={1.75} />
            </span>
            <span>
              <span className="block text-xl font-semibold">{t}</span>
              <span className="text-mute">{s}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}