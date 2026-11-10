import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { apiGetBlob } from "../api";
import { readMusicXML, type MusicSequence } from "./utils/musicXmlReader";

type PlaybackProps = {
  classId: string;
  materialId: string;
  notationStatus?: string | null;
};

function createPianoSynth() {
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      type: "triangle",
    },
    envelope: {
      attack: 0.01,
      decay: 0.25,
      sustain: 0.25,
      release: 1,
    },
  }).toDestination();
}

export default function SheetMusicPlayback({
  classId,
  materialId,
  notationStatus,
}: PlaybackProps) {
  const [sequence, setSequence] = useState<MusicSequence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState("1");

  const synthRef = useRef<ReturnType<typeof createPianoSynth> | null>(null);
  const scheduledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSequence() {
      if (notationStatus !== "completed") return;

      setLoading(true);
      setError(null);
      setSequence(null);

      try {
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        scheduledRef.current = false;

        const blob = await apiGetBlob(
          `/classes/${encodeURIComponent(classId)}/materials/${encodeURIComponent(materialId)}/notation`
        );

        const result = await readMusicXML(blob);

        if (!cancelled) {
          setSequence(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to prepare sheet music playback."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSequence();

    return () => {
      cancelled = true;
      Tone.Transport.stop();
      Tone.Transport.cancel(0);
      scheduledRef.current = false;
    };
  }, [classId, materialId, notationStatus]);

  useEffect(() => {
    return () => {
      synthRef.current?.dispose();
      synthRef.current = null;
    };
  }, []);

  
    const play = async () => {
    if (!sequence) return;

    try {
        await Tone.start();

        if (!synthRef.current) {
        synthRef.current = createPianoSynth();
        }

        // Resume without resetting the notation cursor.
        if (paused && scheduledRef.current) {
        Tone.Transport.start();
        setPaused(false);
        setPlaying(true);
        return;
        }

        if (!scheduledRef.current) {
        Tone.Transport.stop();
        Tone.Transport.cancel(0);

        const playbackSpeed = Number(speed);

        // Reset and show the notation cursor.
        document.dispatchEvent(
            new CustomEvent("musikAralan:playback-start")
        );

        // Get unique note starting positions.
        // Notes beginning together are treated as a chord.
        const onsetTimes = [
            ...new Set(sequence.notes.map((note) => note.start)),
        ].sort((a, b) => a - b);

        // Synchronize cursor movement with the audio timeline.
        onsetTimes.forEach((start, index) => {
            Tone.Transport.schedule((time) => {
            Tone.Draw.schedule(() => {
                document.dispatchEvent(
                new CustomEvent("musikAralan:playback-step", {
                    detail: { index },
                })
                );
            }, time);
            }, start / playbackSpeed);
        });

        // Schedule piano notes.
        for (const note of sequence.notes) {
            Tone.Transport.schedule((time) => {
            synthRef.current?.triggerAttackRelease(
                note.pitch,
                note.duration / playbackSpeed,
                time,
                note.velocity
            );
            }, note.start / playbackSpeed);
        }

        // Handle playback completion.
        Tone.Transport.scheduleOnce(() => {
            setPlaying(false);
            setPaused(false);
            scheduledRef.current = false;

            document.dispatchEvent(
            new CustomEvent("musikAralan:playback-stop")
            );

            Tone.Transport.stop();
        }, sequence.duration / playbackSpeed + 1);

        scheduledRef.current = true;
        }

        Tone.Transport.start();
        setPlaying(true);
        setPaused(false);
    } catch (err) {
        setError(
        err instanceof Error
            ? err.message
            : "Unable to start piano playback."
        );
    }
    };


  const pause = () => {
    Tone.Transport.pause();
    setPlaying(false);
    setPaused(true);
  };

  
    const stop = () => {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);

    scheduledRef.current = false;

    document.dispatchEvent(
        new CustomEvent("musikAralan:playback-stop")
    );

    setPlaying(false);
    setPaused(false);
    };


  if (notationStatus !== "completed") {
    return null;
  }

  return (
    <section className="rounded-xl border border-line bg-white p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-ink">
          Piano Playback
        </h3>

        <p className="text-sm text-gray-500">
          Listen to the recognized musical notes.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-gray-500">
          Preparing piano playback...
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-300 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {sequence && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={play}
              disabled={playing}
              className="rounded-lg bg-p1 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {paused ? "Resume" : "Play"}
            </button>

            <button
              type="button"
              onClick={pause}
              disabled={!playing}
              className="rounded-lg border border-line px-5 py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Pause
            </button>

            <button
              type="button"
              onClick={stop}
              disabled={!playing && !paused}
              className="rounded-lg border border-line px-5 py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Stop
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="playback-speed"
              className="text-sm font-medium text-ink"
            >
              Playback speed
            </label>

            <select
              id="playback-speed"
              value={speed}
              disabled={playing || paused}
              onChange={(event) => setSpeed(event.target.value)}
              className="rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="0.5">0.5x - Slow</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x - Normal</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x - Fast</option>
            </select>
          </div>

          <p className="text-xs text-gray-500">
            {sequence.notes.length} recognized notes
          </p>
        </>
      )}
    </section>
  );
}
