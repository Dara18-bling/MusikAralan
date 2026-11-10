import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Music2, Volume2 } from "lucide-react";

const pitchClasses = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const targetNotes = Array.from({ length: 12 }, (_, index) => {
  const midi = 60 + index;
  return { midi, name: `${pitchClasses[index]}4`, frequency: 440 * 2 ** ((midi - 69) / 12) };
});

function estimatePitch(samples: Float32Array, sampleRate: number) {
  const downsample = sampleRate > 30000 ? 2 : 1;
  const workingRate = sampleRate / downsample;
  const data = new Float32Array(Math.floor(samples.length / downsample));
  let mean = 0;
  for (let i = 0; i < data.length; i += 1) {
    data[i] = samples[i * downsample];
    mean += data[i];
  }
  mean /= data.length;
  let energy = 0;
  for (let i = 0; i < data.length; i += 1) {
    data[i] -= mean;
    energy += data[i] ** 2;
  }
  const rms = Math.sqrt(energy / data.length);
  if (rms < 0.006) return null;

  const minLag = Math.floor(workingRate / 700);
  const maxLag = Math.min(Math.floor(workingRate / 70), Math.floor(data.length / 2));
  const difference = new Float64Array(maxLag + 1);
  const compareLength = data.length - maxLag;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i < compareLength; i += 1) {
      const delta = data[i] - data[i + lag];
      sum += delta * delta;
    }
    difference[lag] = sum;
  }

  let runningSum = 0;
  const normalized = new Float64Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag += 1) {
    runningSum += difference[lag];
    normalized[lag] = runningSum === 0 ? 1 : difference[lag] * lag / runningSum;
  }
  let selectedLag = -1;
  for (let lag = minLag; lag < maxLag; lag += 1) {
    if (normalized[lag] < 0.22) {
      while (lag + 1 <= maxLag && normalized[lag + 1] < normalized[lag]) lag += 1;
      selectedLag = lag;
      break;
    }
  }
  if (selectedLag < 0) {
    let bestValue = 0.38;
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      if (normalized[lag] < bestValue) {
        bestValue = normalized[lag];
        selectedLag = lag;
      }
    }
  }
  if (selectedLag < 0) return null;
  const left = normalized[selectedLag - 1] ?? normalized[selectedLag];
  const center = normalized[selectedLag];
  const right = normalized[selectedLag + 1] ?? normalized[selectedLag];
  const curvature = left - 2 * center + right;
  const correction = Math.abs(curvature) < 1e-8 ? 0 : 0.5 * (left - right) / curvature;
  return workingRate / (selectedLag + Math.max(-0.5, Math.min(0.5, correction)));
}

function getNoteName(midi: number) {
  const rounded = Math.round(midi);
  return `${pitchClasses[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
}

export default function NoteMatcher() {
  const [targetIndex, setTargetIndex] = useState(() => Math.floor(Math.random() * targetNotes.length));
  const [detected, setDetected] = useState<{ frequency: number; note: string; cents: number } | null>(null);
  const [monitoring, setMonitoring] = useState(false);
  const [error, setError] = useState("");
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef(0);
  const pitchHistoryRef = useRef<number[]>([]);
  const lastPitchAtRef = useRef(0);
  const target = targetNotes[targetIndex];
  const targetMidiRef = useRef(target.midi);
  targetMidiRef.current = target.midi;

  const playTarget = useCallback(() => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = contextRef.current ?? new AudioContextClass();
    contextRef.current = context;
    if (context.state === "suspended") void context.resume();
    const harmonics = [1, 0.24, 0.48, 0.18, 0.25, 0.1, 0.08];
    const voices = [{ detune: -7, level: 0.28 }, { detune: 0, level: 0.44 }, { detune: 7, level: 0.28 }];
    voices.forEach((voice) => harmonics.forEach((amplitude, index) => {
      const harmonic = index + 1;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = target.frequency * harmonic;
      oscillator.detune.value = voice.detune;
      const peak = 0.2 * amplitude * voice.level;
      const end = context.currentTime + 1.8;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(peak, context.currentTime + 0.045);
      gain.gain.setValueAtTime(peak * 0.78, context.currentTime + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(end + 0.02);
    }));
  }, [target.frequency]);

  const stopMonitoring = useCallback(() => {
    window.cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setMonitoring(false);
    setDetected(null);
    pitchHistoryRef.current = [];
  }, []);

  const startMonitoring = useCallback(async () => {
    if (monitoring) {
      stopMonitoring();
      return;
    }
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access is not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
      streamRef.current = stream;
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error("Audio input is not supported in this browser.");
      const context = contextRef.current ?? new AudioContextClass();
      contextRef.current = context;
      if (context.state === "suspended") await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0;
      const highPass = context.createBiquadFilter();
      highPass.type = "highpass";
      highPass.frequency.value = 65;
      const lowPass = context.createBiquadFilter();
      lowPass.type = "lowpass";
      lowPass.frequency.value = 3000;
      context.createMediaStreamSource(stream).connect(highPass).connect(lowPass).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      setMonitoring(true);
      let lastUpdate = 0;
      const monitor = (time: number) => {
        frameRef.current = window.requestAnimationFrame(monitor);
        if (time - lastUpdate < 40) return;
        lastUpdate = time;
        analyser.getFloatTimeDomainData(samples);
        const frequency = estimatePitch(samples, context.sampleRate);
        if (!frequency) {
          if (time - lastPitchAtRef.current > 180) {
            pitchHistoryRef.current = [];
            setDetected(null);
          }
          return;
        }
        lastPitchAtRef.current = time;
        const midi = 69 + 12 * Math.log2(frequency / 440);
        pitchHistoryRef.current = [...pitchHistoryRef.current.slice(-2), midi];
        const ordered = [...pitchHistoryRef.current].sort((a, b) => a - b);
        const stableMidi = ordered[Math.floor(ordered.length / 2)];
        const stableFrequency = 440 * 2 ** ((stableMidi - 69) / 12);
        setDetected({ frequency: stableFrequency, note: getNoteName(stableMidi), cents: Math.round(100 * (stableMidi - targetMidiRef.current)) });
      };
      frameRef.current = window.requestAnimationFrame(monitor);
    } catch (cause) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setMonitoring(false);
      setError(cause instanceof Error && cause.name === "NotAllowedError" ? "Allow microphone access to use the pitch monitor." : "Could not start the microphone. Check your browser and device permissions.");
    }
  }, [monitoring, stopMonitoring]);

  useEffect(() => () => {
    window.cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void contextRef.current?.close();
  }, []);

  const isMatched = detected !== null && Math.abs(detected.cents) <= 25;

  return (
    <section className="mx-auto max-w-2xl rounded-3xl border border-line bg-white p-6 shadow-xl sm:p-8" aria-label="Note Matcher">
      <header className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-p1-soft text-p1"><Music2 size={26} /></div>
        <h2 className="mt-4 font-display text-2xl font-bold text-ink">Note Matcher</h2>
        <p className="mt-2 text-mute">Listen to the chorus-style note, then sing or play it. The pitch monitor shows how close you are.</p>
      </header>

      <div className="my-6 rounded-2xl bg-p1-soft p-6 text-center">
        <p className="text-sm font-semibold text-mute">TARGET NOTE</p>
        <p className="my-2 text-5xl font-bold text-p1">{target.name}</p>
        <p className="text-sm text-mute">{target.frequency.toFixed(1)} Hz</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={playTarget} className="inline-flex items-center gap-2 rounded-full bg-[var(--p1)] px-5 py-2.5 font-semibold text-white transition hover:opacity-90"><Volume2 size={18} /> Play target</button>
          <button type="button" onClick={() => { setTargetIndex((index) => (index + 1 + Math.floor(Math.random() * 11)) % 12); setDetected(null); }} className="rounded-full border border-line bg-white px-5 py-2.5 font-semibold text-p1 transition hover:bg-p1-soft">New note</button>
        </div>
      </div>

      <div className="rounded-2xl border border-line p-5 text-center" aria-live="polite">
        <p className="text-sm font-semibold text-mute">PITCH MONITOR</p>
        <p className="mt-2 text-4xl font-bold text-ink">{detected?.note ?? "—"}</p>
        <p className="mt-1 text-sm text-mute">{detected ? `${detected.frequency.toFixed(1)} Hz · ${detected.cents > 0 ? "+" : ""}${detected.cents} cents` : monitoring ? "Sing or play a steady note…" : "Start the microphone to begin"}</p>
        <div className="relative mx-auto mt-6 h-3 max-w-md rounded-full bg-gray-200">
          <span className="absolute left-1/2 top-[-4px] h-5 w-0.5 -translate-x-1/2 bg-ink" />
          {detected && <span className={`absolute top-[-3px] h-[18px] w-[18px] -translate-x-1/2 rounded-full border-2 border-white shadow ${isMatched ? "bg-green-500" : "bg-p1"}`} style={{ left: `${Math.max(3, Math.min(97, 50 + detected.cents))}%` }} />}
        </div>
        <div className="mx-auto mt-1 flex max-w-md justify-between text-xs text-mute"><span>Flat</span><span>In tune</span><span>Sharp</span></div>
        {detected && <p className={`mt-4 font-semibold ${isMatched ? "text-green-600" : "text-mute"}`}>{isMatched ? "Matched!" : detected.cents < 0 ? "A little low — raise the pitch" : "A little high — lower the pitch"}</p>}
      </div>

      <div className="mt-5 text-center">
        <button type="button" onClick={() => void startMonitoring()} className={`inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold text-white transition ${monitoring ? "bg-gray-600 hover:bg-gray-700" : "bg-[var(--p1)] hover:opacity-90"}`}>
          {monitoring ? <MicOff size={18} /> : <Mic size={18} />}{monitoring ? "Stop microphone" : "Start pitch monitor"}
        </button>
        {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
      </div>
    </section>
  );
}
