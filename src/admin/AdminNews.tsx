import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiDelete, apiGet, apiPost, apiPut, refreshApi } from "../api";
import { Btn, Card, Label, Title } from "../ui";

export function AdminNews() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [newsWhere, setNewsWhere] = useState("");
  const [newsWhen, setNewsWhen] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewAnnouncement, setPreviewAnnouncement] = useState<any | null>(
    null,
  );
  const [newsLoading, setNewsLoading] = useState(false);

  const fetchNews = async () => {
    setNewsLoading(true);
    try {
      const { data: news } = await apiGet<{ data: any[] }>("/announcements");
      setAnnouncements(news);
    } catch (err) {
      console.error(err);
    }
    setNewsLoading(false);
  };

  useEffect(() => {
    void fetchNews();
  }, []);

  const handleSaveAnnouncement = async () => {
    if (!newsTitle.trim() || !newsContent.trim())
      return toast.warning("Please fill all fields");
    try {
      const newsData = {
        title: newsTitle,
        content: newsContent,
        whereText: newsWhere,
        whenText: newsWhen,
        createdAt: new Date(),
      };
      if (editingId) {
        await apiPut(`/announcements/${editingId}`, newsData);
        toast.success("Announcement updated!");
      } else {
        await apiPost("/announcements", newsData);
        toast.success("Announcement posted!");
      }
      setNewsTitle("");
      setNewsContent("");
      setNewsWhere("");
      setNewsWhen("");
      setEditingId(null);
      setIsPreview(false);
      void fetchNews();
      refreshApi("/announcements");
    } catch (err) {
      toast.error("Error saving announcement.");
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this announcement?"))
      return;
    try {
      await apiDelete(`/announcements/${id}`);
      setAnnouncements((current) => current.filter((a) => a.id !== id));
      refreshApi("/announcements");
      toast.success("Announcement deleted!");
    } catch (err) {
      toast.error("Error deleting announcement.");
    }
  };

  const handleEditClick = (news: any) => {
    setNewsTitle(news.title);
    setNewsContent(news.content);
    setNewsWhere(news.whereText || "");
    setNewsWhen(news.whenText || "");
    setEditingId(news.id);
    setIsPreview(false);
  };

  return (
    <>
      <Title
        kicker="Announcements"
        title="Manage Announcements"
        sub="Create, edit, or delete announcements."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <Card className="min-w-0">
          <Label>
            {editingId ? "Edit Announcement" : "Create New Announcement"}
          </Label>
          <div className="mt-4 flex flex-col gap-4">
            <input
              type="text"
              placeholder="Announcement Title"
              className="w-full rounded-lg border border-line p-3 break-all"
              value={newsTitle}
              onChange={(e) => setNewsTitle(e.target.value)}
            />
            <label className="grid gap-1 text-sm font-semibold">
              What
            </label>
            <textarea
              placeholder="Write what the announcement is about..."
              className="w-full rounded-lg border border-line p-3 min-h-[150px] break-all"
              value={newsContent}
              onChange={(e) => setNewsContent(e.target.value)}
            />
            <input
              type="text"
              placeholder="Where (optional)"
              className="w-full rounded-lg border border-line p-3"
              value={newsWhere}
              onChange={(e) => setNewsWhere(e.target.value)}
              maxLength={255}
            />
            <input
              type="text"
              placeholder="When (optional)"
              className="w-full rounded-lg border border-line p-3"
              value={newsWhen}
              onChange={(e) => setNewsWhen(e.target.value)}
              maxLength={255}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setIsPreview(!isPreview)}
                className="rounded-full border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
              >
                {isPreview ? "Edit Mode" : "Preview"}
              </button>
              <button
                onClick={handleSaveAnnouncement}
                className="rounded-full bg-p1 px-4 py-2 font-semibold text-white hover:opacity-90"
              >
                {editingId ? "Update Post" : "Post Announcement"}
              </button>
              {editingId && (
                <button
                  onClick={() => {
                    setEditingId(null);
                    setNewsTitle("");
                    setNewsContent("");
                    setNewsWhere("");
                    setNewsWhen("");
                    setIsPreview(false);
                  }}
                  className="rounded-full border border-red-300 px-4 py-2 font-semibold text-red-600 hover:bg-red-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
          {isPreview && (
            <div className="mt-5 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                Preview
              </span>
              <h4 className="text-xl font-bold break-all">
                {newsTitle || "Untitled Announcement"}
              </h4>
              <p className="mt-2 break-all text-gray-700 whitespace-pre-wrap">
                {newsContent || "No what details written yet."}
              </p>
              {newsWhere && <p className="mt-2 break-all text-sm text-gray-700"><span className="font-semibold">Where:</span> {newsWhere}</p>}
              {newsWhen && <p className="mt-1 break-all text-sm text-gray-700"><span className="font-semibold">When:</span> {newsWhen}</p>}
            </div>
          )}
        </Card>
        <Card>
          <div className="flex justify-between items-center mb-4">
            <Label>Posted Announcements</Label>
            <Btn variant="ghost" onClick={fetchNews}>
              {newsLoading ? "Refreshing..." : "Refresh"}
            </Btn>
          </div>
          <div className="flex flex-col gap-4">
            {announcements.length === 0 ? (
              <div className="text-sm text-gray-500">
                No announcements posted.
              </div>
            ) : (
              announcements.map((a) => (
                <div
                  key={a.id}
                  className="p-4 border border-line rounded-lg flex justify-between items-start"
                >
                  <div className="min-w-0">
                    <h4 className="break-all font-bold">{a.title}</h4>
                    <p className="mt-1 break-all text-sm text-gray-600 line-clamp-2">
                      {a.content}
                    </p>
                    {a.whereText && (
                      <p className="mt-1 break-all text-xs text-gray-600">
                        <span className="font-semibold">Where:</span> {a.whereText}
                      </p>
                    )}
                    {a.whenText && (
                      <p className="mt-1 break-all text-xs text-gray-600">
                        <span className="font-semibold">When:</span> {a.whenText}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex shrink-0 flex-col gap-2">
                    <button
                      onClick={() => setPreviewAnnouncement(a)}
                      className="text-p1 hover:underline text-sm font-semibold"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleEditClick(a)}
                      className="text-blue-500 hover:underline text-sm font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteAnnouncement(a.id)}
                      className="text-red-500 hover:underline text-sm font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
      {previewAnnouncement && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setPreviewAnnouncement(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-preview-title"
            className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-line bg-white p-6 shadow-2xl"
          >
            <Label>Announcement preview</Label>
            <h2
              id="announcement-preview-title"
              className="mt-2 break-all font-display text-2xl font-bold"
            >
              {previewAnnouncement.title}
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <p className="mt-4 break-all whitespace-pre-wrap text-ink">
                <span className="font-semibold">What:</span>{" "}
                {previewAnnouncement.content}
              </p>
              {previewAnnouncement.whereText && (
                <p className="mt-3 break-all text-ink">
                  <span className="font-semibold">Where:</span>{" "}
                  {previewAnnouncement.whereText}
                </p>
              )}
              {previewAnnouncement.whenText && (
                <p className="mt-2 break-all text-ink">
                  <span className="font-semibold">When:</span>{" "}
                  {previewAnnouncement.whenText}
                </p>
              )}
            </div>
            <div className="mt-6 flex shrink-0 justify-end">
              <Btn variant="ghost" onClick={() => setPreviewAnnouncement(null)}>
                Close
              </Btn>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
