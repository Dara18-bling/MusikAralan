
import { useEffect, useRef, useState } from "react";
import { apiGetBlob } from "../api";

type NotationStatus =
  | "not_started"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | null;

type SheetMusicNotationProps = {
  classId: string;
  materialId: string;
  notationStatus?: NotationStatus;
};

export default function SheetMusicNotation({
  classId,
  materialId,
  notationStatus,
}: SheetMusicNotationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const osmdRef = useRef<
    import("opensheetmusicdisplay").OpenSheetMusicDisplay | null
  >(null);

  const lastStepRef = useRef(-1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    let osmd: import("opensheetmusicdisplay").OpenSheetMusicDisplay | null =
      null;

    async function loadSheetMusic() {
      if (notationStatus !== "completed") return;

      setLoading(true);
      setError(null);

      let stage = "Requesting notation file";

      try {
        stage = "Requesting notation file";

        const blob = await apiGetBlob(
          `/classes/${encodeURIComponent(classId)}/materials/${encodeURIComponent(materialId)}/notation`
        );

        if (cancelled || !containerRef.current) return;

        console.log("[SheetMusicNotation] Blob:", {
          size: blob.size,
          type: blob.type,
        });

        stage = "Importing OSMD";

        const { OpenSheetMusicDisplay } = await import(
          "opensheetmusicdisplay"
        );

        if (cancelled || !containerRef.current) return;

        osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          drawTitle: true,
        });

        stage = "Loading MusicXML";

        await osmd.load(blob);

        console.log("[SheetMusicNotation] MusicXML loaded successfully.");

        if (cancelled) return;

        stage = "Rendering sheet music";

        osmd.render();

        console.log("[SheetMusicNotation] Sheet music rendered successfully.");

        osmdRef.current = osmd;

        osmd.cursor.reset();
        osmd.cursor.hide();
      } catch (err) {
      console.error(
        `[SheetMusicNotation] Failed during: ${stage}`
      );

      console.error("Complete OSMD error:");
      console.dir(err);

      if (err instanceof Error) {
        console.error("Error name:", err.name);
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
      }

      if (err && typeof err === "object") {
        console.error(
          "Error properties:",
          Object.getOwnPropertyNames(err).map((key) => ({
            property: key,
            value: (err as Record<string, unknown>)[key],
          }))
        );
      }

      if (!cancelled) {
        setError(
          err instanceof Error
            ? `${stage}: ${err.name}: ${err.message}`
            : `${stage}: ${String(err)}`
        );
      }
    } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSheetMusic();

    return () => {
      cancelled = true;

      osmdRef.current = null;
      lastStepRef.current = -1;

      osmd?.clear();

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [classId, materialId, notationStatus]);

  // Playback synchronization
  useEffect(() => {
    const handlePlaybackStart = () => {
      const osmd = osmdRef.current;
      if (!osmd) return;

      osmd.cursor.reset();
      osmd.cursor.show();

      lastStepRef.current = -1;
    };

    const handlePlaybackStep = (event: Event) => {
      const osmd = osmdRef.current;
      if (!osmd) return;

      const customEvent = event as CustomEvent<{ index: number }>;
      const index = customEvent.detail?.index;

      if (typeof index !== "number") return;

      if (lastStepRef.current === -1) {
        lastStepRef.current = index;
        return;
      }

      while (lastStepRef.current < index) {
        osmd.cursor.next();
        lastStepRef.current++;
      }
    };

    const handlePlaybackStop = () => {
      const osmd = osmdRef.current;
      if (!osmd) return;

      osmd.cursor.reset();
      osmd.cursor.hide();

      lastStepRef.current = -1;
    };

    document.addEventListener(
      "musikAralan:playback-start",
      handlePlaybackStart
    );

    document.addEventListener(
      "musikAralan:playback-step",
      handlePlaybackStep
    );

    document.addEventListener(
      "musikAralan:playback-stop",
      handlePlaybackStop
    );

    return () => {
      document.removeEventListener(
        "musikAralan:playback-start",
        handlePlaybackStart
      );

      document.removeEventListener(
        "musikAralan:playback-step",
        handlePlaybackStep
      );

      document.removeEventListener(
        "musikAralan:playback-stop",
        handlePlaybackStop
      );
    };
  }, []);

  if (notationStatus === "failed") {
    return (
      <div className="rounded-lg border p-4 text-sm">
        Sheet music processing was unsuccessful. Please contact your teacher.
      </div>
    );
  }

  if (notationStatus !== "completed") {
    return (
      <div className="rounded-lg border p-4 text-sm">
        Sheet music is being prepared. Please check again shortly.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {loading && (
        <p className="text-sm text-gray-500">
          Loading sheet music notation...
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-300 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full overflow-x-auto rounded-lg border bg-white p-4"
      />
    </div>
  );
}
