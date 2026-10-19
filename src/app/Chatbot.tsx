import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Btn, Input } from "../ui";
import { DEFAULT_CHATBOT_RESPONSES, type ChatbotResponse } from "../chatbotResponses";
import { CHATBOT_STOP_WORDS, keywordDistanceIsOne } from "./chatbotUtils";

interface ChatbotProps {
  isAdmin: boolean;
}

export function Chatbot({ isAdmin }: ChatbotProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [responses, setResponses] = useState(DEFAULT_CHATBOT_RESPONSES);
  const [msgs, setMsgs] = useState([
    {
      me: false,
      t: 'Kumusta po! I am your Music Helper. Ask me anything — like "How do I join class?"',
    },
  ]);
  const [v, setV] = useState("");

  useEffect(() => {
    return onSnapshot(
      collection(db, "chatbotResponses"),
      (snapshot) => {
        if (snapshot.empty) {
          setResponses(DEFAULT_CHATBOT_RESPONSES);
          return;
        }
        const saved = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<ChatbotResponse, "id">),
        }));
        setResponses([
          ...DEFAULT_CHATBOT_RESPONSES.flatMap((fallback) => {
            const override = saved.find((item) => item.id === fallback.id);
            return override?.deleted ? [] : [override ?? fallback];
          }),
          ...saved.filter((item) => !item.deleted && !DEFAULT_CHATBOT_RESPONSES.some((fallback) => fallback.id === item.id)),
        ]);
      },
      (error) => console.error("Could not load chatbot responses:", error)
    );
  }, []);

  const send = (t: string) => {
    if (!t) return;
    const inputWords = (t.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter(
      (word) => !CHATBOT_STOP_WORDS.has(word)
    );
    const matched = responses
      .map((item) => {
        const keywords = (item.keywords.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter(
          (word) => !CHATBOT_STOP_WORDS.has(word)
        );
        const score = keywords.reduce((total, keyword) => {
          const bestWordScore = inputWords.reduce((best, word) => {
            if (word === keyword) return Math.max(best, 3);
            if (
              Math.min(word.length, keyword.length) >= 3 &&
              (word.includes(keyword) || keyword.includes(word))
            ) {
              return Math.max(best, 2);
            }
            if (
              Math.min(word.length, keyword.length) >= 4 &&
              keywordDistanceIsOne(word, keyword)
            ) {
              return Math.max(best, 1);
            }
            return best;
          }, 0);
          return total + bestWordScore;
        }, 0);
        return { item, score };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)[0]?.item;

    const a =
      matched?.response ??
      responses.find((item) => !item.keywords.trim())?.response ??
      "I don't have an answer for that yet. Please contact your coordinator.";

    setMsgs((m) => [...m, { me: true, t }, { me: false, t: a }]);
    setV("");
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="mb-3 flex h-[28rem] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-2xl">
          <div className="grad px-5 py-4 text-white flex justify-between items-center">
            <div>
              <p className="font-display text-lg">Music Helper</p>
              <p className="text-xs text-white/80">Always here · Tagalog or English</p>
            </div>
            {isAdmin && (
              <button onClick={() => navigate("/admin/bot")} className="text-xs underline">
                Manage Replies
              </button>
            )}
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <p
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[15px] ${
                  m.me ? "ml-auto grad text-white" : "bg-p1-soft"
                }`}
              >
                {m.t}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 px-3">
            {["How do I join class?", "Download a PDF"].map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full border border-line px-3 py-1 text-xs"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(v);
            }}
            className="flex gap-2 p-3"
          >
            <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Type here…" />
            <Btn>Send</Btn>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Open help chat"
        className="grad ml-auto flex h-16 items-center gap-2 rounded-full px-6 text-lg font-semibold text-white shadow-xl"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6" /> {isAdmin ? "Edit Bot" : "Help"}
          </>
        )}
      </button>
    </div>
  );
}