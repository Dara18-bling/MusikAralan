import { useState } from "react";
import {
  ChevronDown,
  Download,
  MessageCircle,
  Smartphone,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Title } from "../ui";

type Guide = {
  title: string;
  summary: string;
  icon: LucideIcon;
  instructions: string[];
};

const categories: { title: string; guides: Guide[] }[] = [
  {
    title: "Getting started",
    guides: [
      {
        title: "How to log in",
        summary: "Access your MusikAralan account.",
        icon: Smartphone,
        instructions: [
          "Open the MusikAralan sign-in page.",
          "Enter the email address and password associated with your account.",
          "If you cannot remember your password, choose the password reset option on the sign-in page.",
        ],
      },
    ],
  },
  {
    title: "Classes and learning materials",
    guides: [
      {
        title: "Joining a Google Meet class",
        summary: "Find and join a scheduled live session.",
        icon: Video,
        instructions: [
          "Open Classes and select the class with the scheduled session.",
          "Go to Live Sessions and select Join session.",
          "If no join option is available, contact your teacher for the meeting link.",
        ],
      },
      {
        title: "Downloading a song sheet",
        summary: "Open a class resource and save it to your device.",
        icon: Download,
        instructions: [
          "Open Classes, choose your class, and select the material.",
          "Use the download control when one is available. If the file opens in a new tab, use your browser's download or save option.",
          "Choose a location on your device where you can find the file later.",
        ],
      },
    ],
  },
  {
    title: "Accessibility",
    guides: [
      {
        title: "Making text bigger",
        summary: "Increase text size for easier reading.",
        icon: Type,
        instructions: [
          "Select the A+ text-size control at the top of the page.",
          "Select it again as needed until the text is comfortable to read.",
        ],
      },
    ],
  },
  {
    title: "Getting help",
    guides: [
      {
        title: "Using the Chatbot",
        summary: "Ask Music Helper a question.",
        icon: MessageCircle,
        instructions: [
          "Open the Music Helper chatbot.",
          "Type a short question about using MusikAralan, then send it.",
          "If you still need help, contact your teacher or class administrator.",
        ],
      },
    ],
  },
];

function toId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function StudentHelp() {
  const [openGuide, setOpenGuide] = useState<string | null>(null);

  return (
    <>
      <Title
        kicker="Tulong · Help"
        title="Help Guides & Tutorials"
        sub="Choose a topic to see step-by-step instructions."
      />
      <div className="grid gap-5">
        {categories.map((category) => {
          const categoryId = `help-category-${toId(category.title)}`;

          return (
            <section
              key={category.title}
              aria-labelledby={categoryId}
              className="overflow-hidden rounded-2xl border border-line bg-white/85"
            >
              <header className="border-b border-line bg-p1-soft/40 px-5 py-4">
                <h2
                  id={categoryId}
                  className="font-display text-lg font-semibold text-ink"
                >
                  {category.title}
                </h2>
              </header>
              <div className="divide-y divide-line px-5">
                {category.guides.map((guide) => {
                  const isOpen = openGuide === guide.title;
                  const panelId = `help-guide-${toId(guide.title)}`;
                  const Icon = guide.icon;

                  return (
                    <div key={guide.title}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() =>
                          setOpenGuide(isOpen ? null : guide.title)
                        }
                        className="flex w-full items-center gap-3 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p1)]"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-p1-soft text-p1">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-ink">
                            {guide.title}
                          </span>
                          <span className="mt-0.5 block text-sm text-mute">
                            {guide.summary}
                          </span>
                        </span>
                        <ChevronDown
                          className={`h-5 w-5 shrink-0 text-mute transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                      {isOpen && (
                        <div
                          id={panelId}
                          className="pb-5 pl-13 text-sm text-mute"
                        >
                          <ol className="grid list-decimal gap-2 pl-5">
                            {guide.instructions.map((instruction) => (
                              <li key={instruction}>{instruction}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}