
import { unzipSync, strFromU8 } from "fflate";

export type PianoNote = {
  pitch: string;
  midi: number;
  start: number;
  duration: number;
  velocity: number;
};

export type MusicSequence = {
  notes: PianoNote[];
  duration: number;
  tempo: number;
};

function getText(
  parent: Element,
  selector: string
): string | null {
  return parent.querySelector(selector)?.textContent?.trim() ?? null;
}

function pitchToMidi(
  step: string,
  octave: number,
  alter: number
): number {
  const semitones: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };

  return (
    (octave + 1) * 12 +
    semitones[step] +
    alter
  );
}

function midiToPitch(midi: number): string {
  const names = [
    "C", "C#", "D", "D#", "E", "F",
    "F#", "G", "G#", "A", "A#", "B",
  ];

  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function readMusicXML(blob: Blob): Promise<MusicSequence> {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);

    let xmlText: string;

    // Audiveris normally exports compressed .mxl files.
    if (
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b
    ) {
      const files = unzipSync(bytes);

      const containerFile = files["META-INF/container.xml"];

      if (!containerFile) {
        throw new Error("Invalid MXL file: container.xml is missing.");
      }

      const containerXml = new DOMParser().parseFromString(
        strFromU8(containerFile),
        "application/xml"
      );

      const rootFile = containerXml.querySelector("rootfile");

      const rootPath = rootFile?.getAttribute("full-path");

      if (!rootPath || !files[rootPath]) {
        throw new Error("Could not locate MusicXML inside the MXL file.");
      }

      xmlText = strFromU8(files[rootPath]);
    } else {
      // Also support ordinary, uncompressed MusicXML.
      xmlText = new TextDecoder().decode(bytes);
    }

    const xml = new DOMParser().parseFromString(
      xmlText,
      "application/xml"
    );

    if (xml.querySelector("parsererror")) {
      throw new Error("The MusicXML file could not be parsed.");
    }

    const divisions = Math.max(
      1,
      Number(getText(xml.documentElement, "divisions")) || 1
    );

    const tempo = Math.max(
      1,
      Number(
        xml.querySelector("sound[tempo]")?.getAttribute("tempo")
      ) || 100
    );

    const notes: PianoNote[] = [];

    let currentTime = 0;
    let measureTime = 0;

    const measures = Array.from(
      xml.querySelectorAll("measure")
    );

    for (const measure of measures) {
      currentTime = measureTime;

      const attributes = measure.querySelector("attributes");
      const currentDivisions = Math.max(
        1,
        Number(getText(attributes ?? measure, "divisions")) ||
          divisions
      );

      const quarterDuration = 60 / tempo;

      for (const child of Array.from(measure.children)) {
        if (child.tagName === "attributes") {
          continue;
        }

        if (child.tagName === "direction") {
          const directionTempo = Number(
            child.querySelector("sound")?.getAttribute("tempo")
          );

          if (directionTempo > 0) {
            // Tempo changes are handled in a later playback enhancement.
          }

          continue;
        }

        if (child.tagName === "backup") {
          const amount = Number(getText(child, "duration")) || 0;
          currentTime -= amount / currentDivisions * quarterDuration;
          continue;
        }

        if (child.tagName === "forward") {
          const amount = Number(getText(child, "duration")) || 0;
          currentTime += amount / currentDivisions * quarterDuration;
          continue;
        }

        if (child.tagName !== "note") {
          continue;
        }

        const durationValue = Number(getText(child, "duration")) || 0;

        const duration =
          durationValue / currentDivisions * quarterDuration;

        const isChord = child.querySelector("chord") !== null;
        const isGrace = child.querySelector("grace") !== null;
        const isRest = child.querySelector("rest") !== null;

        if (!isRest && !isGrace) {
          const step = getText(child, "pitch step");
          const octave = Number(getText(child, "pitch octave"));
          const alter = Number(getText(child, "pitch alter")) || 0;

          if (step && Number.isFinite(octave)) {
            const midi = pitchToMidi(step, octave, alter);

            notes.push({
              pitch: midiToPitch(midi),
              midi,
              start: currentTime,
              duration: Math.max(duration, 0.05),
              velocity: 0.8,
            });
          }
        }

        if (!isChord && !isGrace) {
          currentTime += duration;
        }
      }

      measureTime = Math.max(measureTime, currentTime);
    }

    if (notes.length === 0) {
      throw new Error("No playable musical notes were found.");
    }

    return {
      notes,
      duration: Math.max(
        ...notes.map((note) => note.start + note.duration)
      ),
      tempo,
    };
  });
}
