import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiPut, POLL_INTERVAL_TWO_MINUTES, watchApi } from "../api";

type CommentItem = { studentName: string; body: string; updatedAt: string };

interface PrivateCommentProps {
  endpoint: string;
  readOnly?: boolean;
}

export function PrivateComment({ endpoint, readOnly = false }: PrivateCommentProps) {
  const [body, setBody] = useState("");
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return watchApi<{ comments: CommentItem[] }>(endpoint, ({ comments: items }) => {
        setComments(items);
        if (!readOnly) setBody(items[0]?.body || "");
      }, (error) => console.error("Could not load private comments:", error), POLL_INTERVAL_TWO_MINUTES);
  }, [endpoint, readOnly]);

  const save = async () => {
    setSaving(true);
    try {
      await apiPut(endpoint, { body });
      setComments([{ studentName: "You", body: body.trim(), updatedAt: new Date().toISOString() }]);
      toast.success("Private comment saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your comment.");
    } finally {
      setSaving(false);
    }
  };

  if (readOnly) return comments.length ? (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-xs font-semibold text-mute">Private student comments</p>
      <ul className="mt-2 grid gap-2">
        {comments.map((comment, index) => <li key={`${comment.studentName}-${index}`} className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-semibold">{comment.studentName}</p>
          <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
        </li>)}
      </ul>
    </div>
  ) : null;

  return <div className="mt-4 border-t border-line pt-3">
    <label className="block text-sm font-semibold" htmlFor={`private-comment-${endpoint}`}>Private comment for your teacher</label>
    <textarea id={`private-comment-${endpoint}`} maxLength={2000} rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a note or question about this item…" className="mt-2 w-full rounded-xl border border-line bg-white p-3 text-sm" />
    <button type="button" disabled={saving || !body.trim()} onClick={() => void save()} className="mt-2 rounded-full bg-p1 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save private comment"}</button>
    <p className="mt-1 text-xs text-mute">Only you and your class teacher can see this comment.</p>
  </div>;
}
