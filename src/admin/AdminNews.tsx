import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../api";
import { Btn, Card, Label, Title } from "../ui";

export function AdminNews() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewAnnouncement, setPreviewAnnouncement] = useState<any | null>(null);
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
      return alert("Please fill all fields");
    try {
      const newsData = {
        title: newsTitle,
        content: newsContent,
        createdAt: new Date(),
      };
      if (editingId) {
        await apiPut(`/announcements/${editingId}`, newsData);
        alert("Announcement updated!");
      } else {
        await apiPost("/announcements", newsData);
        alert("Announcement posted!");
      }
      setNewsTitle("");
      setNewsContent("");
      setEditingId(null);
      setIsPreview(false);
      void fetchNews();
    } catch (err) {
      alert("Error saving announcement.");
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this announcement?"))
      return;
    try {
      await apiDelete(`/announcements/${id}`);
      setAnnouncements(announcements.filter((a) => a.id !== id));
      alert("Announcement deleted!");
    } catch (err) {
      alert("Error deleting announcement.");
    }
  };

  const handleEditClick = (news: any) => {
    setNewsTitle(news.title);
    setNewsContent(news.content);
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
        <Card>
          <Label>
            {editingId ? "Edit Announcement" : "Create New Announcement"}
          </Label>
          <div className="mt-4 flex flex-col gap-4">
            <input
              type="text"
              placeholder="Announcement Title"
              className="w-full rounded-lg border border-line p-3"
              value={newsTitle}
              onChange={(e) => setNewsTitle(e.target.value)}
            />
            <textarea
              placeholder="Write your announcement here..."
              className="w-full rounded-lg border border-line p-3 min-h-[150px]"
              value={newsContent}
              onChange={(e) => setNewsContent(e.target.value)}
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
              <h4 className="text-xl font-bold">
                {newsTitle || "Untitled Announcement"}
              </h4>
              <p className="mt-2 text-gray-700 whitespace-pre-wrap">
                {newsContent || "No content written yet."}
              </p>
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
              <div className="text-sm text-gray-500">No announcements posted.</div>
            ) : (
              announcements.map((a) => (
                <div
                  key={a.id}
                  className="p-4 border border-line rounded-lg flex justify-between items-start"
                >
                  <div>
                    <h4 className="font-bold">{a.title}</h4>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {a.content}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
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
            className="w-full max-w-xl rounded-2xl border border-line bg-white p-6 shadow-2xl"
          >
            <Label>Announcement preview</Label>
            <h2
              id="announcement-preview-title"
              className="mt-2 font-display text-2xl font-bold"
            >
              {previewAnnouncement.title}
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-ink">
              {previewAnnouncement.content}
            </p>
            <div className="mt-6 flex justify-end">
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