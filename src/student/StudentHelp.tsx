import { useEffect, useState } from "react";
import { Download, MessageCircle, Smartphone, Type, Video, X } from "lucide-react";
import { Card, Title } from "../ui";

type Guide = {
  icon: typeof Video;
  title: string;
  summary: string;
  steps: string[];
  note?: string;
};

const GUIDES: Guide[] = [
  {
    icon: Smartphone,
    title: "Student profile and account",
    summary: "All about your account and information.",
    steps: [
      "Instant access once your account is activated.",
      "Just enter your email address and password connected to your account, then continue by clicking Login.",
      "Congratulations! You can now use the menu on the left to access all the features for students.",
    ],
    note: "If you wish to change your information, go to your student profile, submit a request to the admin, and fill up the inforrmation you want to change.",
  },
  {
    icon: Video,
    title: "Joining a Google Meet class",
    summary: "Attend live sessions and learn more virtually!",
    steps: [
      "Open Classes from the student menu.",
      "In My Classes, select Open on the class you are attending.",
      "Choose the Live Sessions tab to see scheduled sessions for that class.",
      "Select Join session beside the session. Meet opens in a new browser tab; allow your camera or microphone only if you want to use them.",
    ],
    note: "If there is no Join session button or link, contact your teacher for the meeting details.",
  },
  {
    icon: Download,
    title: "Downloading a learning material",
    summary: "Find a class resource and save a copy to your device.",
    steps: [
      "Open Classes, then select Open on the class with the learning material.",
      "Choose Materials and select View material on the resource you need.",
      "If the material is on Google Drive, select Download from Drive. If it is an attached file, choose Open file or Download file when shown.",
      "Follow your browser’s prompt to save the file, then check your device’s Downloads folder.",
    ],
    note: "Some documents open in the browser first. Use the viewer’s download control to save a copy.",
  },
  {
    icon: Type,
    title: "Making text bigger",
    summary: "Use the A+ control in the top bar to enlarge the interface text.",
    steps: [
      "Find the A+ button in the top bar, beside the dark mode control.",
      "Select A+ once to enlarge text across the portal.",
      "Select A+ again to return to the standard text size.",
    ],
  },
  {
    icon: MessageCircle,
    title: "Using the Chatbot",
    summary: "Ask the Music Helper a question in English or Tagalog.",
    steps: [
      "Select the Help button in the lower-right corner of the screen.",
      "Type a question about classes, materials, assessments, or your account in the message box.",
      "Select Send and read the reply in the chat. Ask a more specific follow-up if you need extra steps.",
      "Select the chat button again to close the helper.",
    ],
    note: "For account access or a missing class/session link, contact your school coordinator or teacher if the helper cannot resolve it.",
  },
];

export function StudentHelp() {
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);

  useEffect(() => {
    if (!selectedGuide) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedGuide(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedGuide]);

  return (
    <>
      <Title
        kicker="Tulong · Help"
        title="Help Guides & Tutorials"
        sub="Choose a guide to see step-by-step instructions."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {GUIDES.map((guide) => {
          const Icon = guide.icon;
          return (
            <button
              key={guide.title}
              type="button"
              onClick={() => setSelectedGuide(guide)}
              className="flex min-w-0 items-center gap-4 rounded-2xl border border-line bg-white p-5 text-left transition hover:border-[var(--p1)] hover:bg-p1-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p1)]"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-p1-soft text-p1 sm:h-16 sm:w-16">
                <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-semibold sm:text-xl">{guide.title}</span>
                <span className="mt-1 block text-sm text-mute">{guide.summary}</span>
                <span className="mt-3 block text-sm font-semibold text-p1">Open guide →</span>
              </span>
            </button>
          );
        })}
      </div>

      {selectedGuide && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedGuide(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-guide-title"
            className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-line bg-white p-4 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-p1-soft text-p1">
                  <selectedGuide.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-p1">Student guide</p>
                  <h2 id="student-guide-title" className="mt-1 font-display text-xl font-bold sm:text-2xl">
                    {selectedGuide.title}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGuide(null)}
                className="rounded-full border border-line p-2 transition hover:bg-p1-soft"
                aria-label="Close guide"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ol className="mt-6 grid gap-4">
              {selectedGuide.steps.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-p1-soft text-sm font-bold text-p1">
                    {index + 1}
                  </span>
                  <p className="min-w-0 pt-0.5 text-sm leading-relaxed text-ink sm:text-base">{step}</p>
                </li>
              ))}
            </ol>
            {selectedGuide.note && (
              <Card className="mt-6 bg-p1-soft/50 text-sm leading-relaxed text-ink">
                <span className="font-semibold">Helpful note: </span>{selectedGuide.note}
              </Card>
            )}
          </section>
        </div>
      )}
    </>
  );
}
