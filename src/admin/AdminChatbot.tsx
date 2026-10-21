import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../api";
import { Btn, Card, Title } from "../ui";
import type { ChatbotResponse } from "../chatbotResponses";

export function AdminChatbot() {
  const [chatbotReplies, setChatbotReplies] = useState<ChatbotResponse[]>([]);
  const [chatbotLoading, setChatbotLoading] = useState(false);
  const [chatbotSaving, setChatbotSaving] = useState<string | null>(null);
  const [chatbotSearch, setChatbotSearch] = useState("");
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [showAddReply, setShowAddReply] = useState(false);
  const [newReplyQuestion, setNewReplyQuestion] = useState("");
  const [newReplyResponse, setNewReplyResponse] = useState("");
  const [creatingReply, setCreatingReply] = useState(false);

  const fetchChatbotReplies = async () => {
    setChatbotLoading(true);
    try {
      const { data: saved } = await apiGet<{ data: ChatbotResponse[] }>("/chatbot-responses");
      setChatbotReplies(saved.filter((item) => !item.deleted));
    } catch (err) {
      console.error(err);
      alert("Could not load chatbot responses.");
    }
    setChatbotLoading(false);
  };

  useEffect(() => {
    void fetchChatbotReplies();
  }, []);

  const updateChatbotReply = (
    id: string,
    field: "keywords" | "response",
    value: string
  ) => {
    setChatbotReplies((current) =>
      current.map((reply) => (reply.id === id ? { ...reply, [field]: value } : reply))
    );
  };

  const saveChatbotReply = async (reply: ChatbotResponse) => {
    if (!reply.response.trim()) return alert("Please enter a response.");
    setChatbotSaving(reply.id);
    try {
      const data = { keywords: reply.keywords.trim(), response: reply.response.trim() };
      if (reply.id.startsWith("new-")) {
        const { response: created } = await apiPost<{ response: ChatbotResponse }>("/chatbot-responses", {
          ...data,
          deleted: false,
        });
        setChatbotReplies((current) =>
          current.map((item) =>
            item.id === reply.id ? { ...item, id: created.id } : item
          )
        );
      } else {
        await apiPut(`/chatbot-responses/${encodeURIComponent(reply.id)}`, { ...data, deleted: false });
      }
      setEditingReplyId(null);
      alert("Chatbot response saved.");
    } catch (err) {
      console.error(err);
      alert("Could not save chatbot response.");
    }
    setChatbotSaving(null);
  };

  const createChatbotReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newReplyQuestion.trim() || !newReplyResponse.trim()) return;
    setCreatingReply(true);
    try {
      const data = {
        keywords: newReplyQuestion.trim(),
        response: newReplyResponse.trim(),
        deleted: false,
      };
      const { response: created } = await apiPost<{ response: ChatbotResponse }>("/chatbot-responses", data);
      setChatbotReplies((current) => [...current, created]);
      setNewReplyQuestion("");
      setNewReplyResponse("");
      setShowAddReply(false);
    } catch (err) {
      console.error(err);
      alert("Could not add chatbot response.");
    }
    setCreatingReply(false);
  };

  const deleteChatbotReply = async (reply: ChatbotResponse) => {
    if (
      !window.confirm(
        `Delete the chatbot response for "${reply.keywords || "the default reply"}"?`
      )
    )
      return;
    try {
      if (reply.id.startsWith("new-")) {
        setChatbotReplies((current) => current.filter((item) => item.id !== reply.id));
        setEditingReplyId(null);
        return;
      }
      await apiDelete(`/chatbot-responses/${encodeURIComponent(reply.id)}`);
      setChatbotReplies((current) => current.filter((item) => item.id !== reply.id));
      if (editingReplyId === reply.id) setEditingReplyId(null);
    } catch (err) {
      console.error(err);
      alert("Could not delete chatbot response.");
    }
  };

  const filteredChatbotReplies = chatbotReplies.filter(
    (reply) =>
      reply.id === editingReplyId ||
      `${reply.keywords} ${reply.response}`
        .toLowerCase()
        .includes(chatbotSearch.trim().toLowerCase())
  );

  return (
    <>
      <Title
        kicker="Support Tools"
        title="Chatbot Replies"
        sub="View and manage the answers Music Helper gives to common questions."
      />
      <Card className="mt-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <label className="grid min-w-56 flex-1 gap-1 text-sm font-semibold">
            Search responses
            <input
              type="search"
              value={chatbotSearch}
              onChange={(e) => setChatbotSearch(e.target.value)}
              placeholder="Search keywords or response text"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
            />
          </label>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={fetchChatbotReplies}>
              {chatbotLoading ? "Refreshing..." : "Refresh"}
            </Btn>
            <Btn variant="soft" onClick={() => setShowAddReply(true)}>
              Add response
            </Btn>
          </div>
        </div>
        <p className="mb-3 text-sm text-mute">
          A single exact or partial keyword match can trigger a reply, including replies added later.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-line text-mute">
                <th className="w-1/4 pb-2 pr-3 font-medium">User question or keyword</th>
                <th className="pb-2 pr-3 font-medium">Chatbot response</th>
                <th className="w-36 pb-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredChatbotReplies.map((reply) => (
                <tr key={reply.id}>
                  <td className="py-2 pr-3 align-top">
                    <span className="break-words">
                      {reply.keywords || <span className="text-mute">Default</span>}
                    </span>
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <p className="line-clamp-2 break-words">{reply.response}</p>
                  </td>
                  <td className="py-2 text-right align-top">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingReplyId(reply.id)}
                        className="rounded-full bg-p1-soft px-4 py-1.5 font-semibold text-p1 hover:bg-[var(--p1)] hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteChatbotReply(reply)}
                        className="rounded-full border border-red-200 px-4 py-1.5 font-semibold text-red-500 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!chatbotLoading && filteredChatbotReplies.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-mute">
                    {chatbotReplies.length
                      ? "No replies match your search."
                      : "No chatbot replies available."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editingReplyId && (() => {
        const reply = chatbotReplies.find((item) => item.id === editingReplyId);
        if (!reply) return null;
        return (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget &&
                chatbotSaving !== reply.id
              ) {
                void fetchChatbotReplies();
                setEditingReplyId(null);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-chatbot-reply-title"
              className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl"
            >
              <h2 id="edit-chatbot-reply-title" className="font-display text-2xl font-bold">
                Edit chatbot response
              </h2>
              <form
                className="mt-5 grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveChatbotReply(reply);
                }}
              >
                <label className="grid gap-1.5 text-sm font-semibold">
                  User question or keyword
                  <textarea
                    value={reply.keywords}
                    onChange={(event) =>
                      updateChatbotReply(reply.id, "keywords", event.target.value)
                    }
                    placeholder="Example: How do I join a class?"
                    className="min-h-24 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Chatbot response
                  <textarea
                    required
                    value={reply.response}
                    onChange={(event) =>
                      updateChatbotReply(reply.id, "response", event.target.value)
                    }
                    className="min-h-28 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void fetchChatbotReplies();
                      setEditingReplyId(null);
                    }}
                    disabled={chatbotSaving === reply.id}
                    className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={chatbotSaving === reply.id || !reply.response.trim()}
                    className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {chatbotSaving === reply.id ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        );
      })()}

      {showAddReply && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingReply)
              setShowAddReply(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-chatbot-reply-title"
            className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl"
          >
            <h2 id="add-chatbot-reply-title" className="font-display text-2xl font-bold">
              Add chatbot response
            </h2>
            <p className="mt-1 text-sm text-mute">
              One exact or partial keyword match is enough to trigger this answer.
            </p>
            <form className="mt-5 grid gap-4" onSubmit={createChatbotReply}>
              <label className="grid gap-1.5 text-sm font-semibold">
                User question or keyword
                <textarea
                  autoFocus
                  required
                  value={newReplyQuestion}
                  onChange={(event) => setNewReplyQuestion(event.target.value)}
                  placeholder="Example: How do I join a class?"
                  className="min-h-24 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Chatbot response
                <textarea
                  required
                  value={newReplyResponse}
                  onChange={(event) => setNewReplyResponse(event.target.value)}
                  placeholder="Write the answer the chatbot should send..."
                  className="min-h-28 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddReply(false)}
                  disabled={creatingReply}
                  className="rounded-full border border-line px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingReply}
                  className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {creatingReply ? "Adding..." : "Add response"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}