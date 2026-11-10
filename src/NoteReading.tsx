import { useState } from 'react'
import { ChevronRight, Star, Volume2 } from 'lucide-react'
import { Btn, Card } from './ui'

// Steps above E4 (bottom staff line). Each step is half a line-gap.
const NOTES = [
  { n: 'C', s: 'Do', step: -2, hz: 261.63, half: false },
  { n: 'E', s: 'Mi', step: 0, hz: 329.63, half: true },
  { n: 'G', s: 'Sol', step: 2, hz: 392.0, half: false },
  { n: 'A', s: 'La', step: 3, hz: 440.0, half: false },
  { n: 'C', s: 'Do', step: 5, hz: 523.25, half: true },
  { n: 'F', s: 'Fa', step: 8, hz: 698.46, half: false },
]
const W = 1000, GAP = 36, BOTTOM = 250, H = 330
const y = (step: number) => BOTTOM - step * (GAP / 2)
const x = (i: number) => 260 + i * 125

function play(hz: number) {
  const ctx = new AudioContext()
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = 'triangle'; o.frequency.value = hz
  g.gain.setValueAtTime(0.0001, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1)
  o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 1.2)
}

export default function NoteReading() {
  const [active, setActive] = useState(0)
  const [heard, setHeard] = useState<Set<number>>(new Set([0, 1, 2]))
  const pick = (i: number) => { setActive(i); setHeard(new Set(heard).add(i)) }
  const note = NOTES[active]
  const pct = Math.round((heard.size / NOTES.length) * 100)

  return (
    <div className="grid gap-6">
      <header className="grad relative overflow-hidden rounded-[2rem] p-6 text-white md:p-8">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 right-32 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="flex-1">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/80">MusikAralan · Kids · Lesson 3</p>
            <h1 className="mt-1 font-display text-3xl md:text-4xl">Interactive Note Reading</h1>
            <p className="mt-1 text-lg text-white/90">Tap each note to hear its name!</p>
            <div className="mt-4 flex max-w-md items-center gap-3">
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${pct}%` }} /></div>
              <span className="font-mono text-sm font-medium">{heard.size}/{NOTES.length}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 text-ink shadow-lg">
            <div className="flex">
              {[0, 1, 2].map((i) => <Star key={i} className={`h-9 w-9 ${i === 1 ? '-mt-3' : ''} fill-amber-400 text-amber-500`} strokeWidth={1.5} />)}
            </div>
            <div><p className="font-display text-2xl leading-none">3 Stars</p><p className="text-sm text-mute">Great reading!</p></div>
          </div>
        </div>
      </header>

      <Card className="rounded-[2rem] p-4 md:p-8">
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Treble staff with notes C, E, G, A, C and F">
            <defs>
              <linearGradient id="nb" x1="0" x2="1"><stop offset="0" stopColor="var(--p1)" /><stop offset="1" stopColor="var(--p2)" /></linearGradient>
            </defs>
            {[0, 2, 4, 6, 8].map((s) => <line key={s} x1="30" x2={W - 30} y1={y(s)} y2={y(s)} stroke="#1d2340" strokeOpacity=".75" strokeWidth="3" strokeLinecap="round" />)}
            <line x1="30" x2="30" y1={y(8)} y2={y(0)} stroke="#1d2340" strokeOpacity=".75" strokeWidth="3" />
            <line x1={W - 30} x2={W - 30} y1={y(8)} y2={y(0)} stroke="#1d2340" strokeOpacity=".75" strokeWidth="6" />
            <text x="48" y={y(0) + 42} fontSize="230" fontFamily="'Noto Music', serif" fill="url(#nb)">𝄞</text>
            {NOTES.map((nt, i) => {
              const cx = x(i), cy = y(nt.step), on = i === active
              const color = i % 2 ? 'var(--p2)' : 'var(--p1)'
              const up = nt.step < 4
              return (
                <g key={i} onClick={() => pick(i)} onMouseEnter={() => setActive(i)} className="cursor-pointer" role="button" tabIndex={0} aria-label={`${nt.n}, ${nt.s}`}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pick(i)}>
                  <rect x={cx - 50} y="20" width="100" height={H - 20} fill="transparent" />
                  {on && <circle cx={cx} cy={cy} r="40" fill={color} opacity=".15" />}
                  {nt.step <= -2 && <line x1={cx - 38} x2={cx + 38} y1={y(-2)} y2={y(-2)} stroke="#1d2340" strokeOpacity=".75" strokeWidth="3" />}
                  <line x1={up ? cx + 20 : cx - 20} x2={up ? cx + 20 : cx - 20} y1={cy} y2={up ? cy - 110 : cy + 110} stroke={color} strokeWidth="5" strokeLinecap="round" />
                  <ellipse cx={cx} cy={cy} rx="23" ry="17" transform={`rotate(-22 ${cx} ${cy})`} fill={nt.half ? 'white' : color} stroke={color} strokeWidth={nt.half ? 7 : 0}
                    style={{ transformBox: 'fill-box', transformOrigin: 'center', transition: 'scale .2s', scale: on ? '1.15' : '1' }} />
                </g>
              )
            })}
          </svg>

          <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full transition-all duration-300"
            style={{ left: `${(x(active) / W) * 100}%`, top: `${((y(note.step) - (note.step < 4 ? 130 : 40)) / H) * 100}%` }}>
            <div className="pointer-events-auto relative flex items-center gap-3 rounded-3xl grad px-5 py-3 text-white shadow-xl shadow-[var(--p2)]/30">
              <div className="text-center leading-none">
                <p className="font-display text-5xl">{note.n}</p>
                <p className="mt-1 text-lg font-semibold text-white/90">{note.s}</p>
              </div>
              <button onClick={() => play(note.hz)} aria-label={`Play ${note.n}`} className="grid h-12 w-12 place-items-center rounded-full bg-white text-p1 transition hover:scale-110">
                <Volume2 className="h-6 w-6" />
              </button>
              <span className="absolute -bottom-2 left-1/2 h-5 w-5 -translate-x-1/2 rotate-45 rounded-sm bg-[var(--p2)]" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {NOTES.map((nt, i) => (
            <button key={i} onClick={() => { pick(i); play(nt.hz) }}
              className={`min-w-20 rounded-2xl border-2 px-4 py-2 text-center transition ${i === active ? 'border-transparent grad text-white' : 'border-line bg-white hover:border-[var(--p1)]'}`}>
              <span className="block font-display text-2xl leading-none">{nt.n}</span><span className="text-sm">{nt.s}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-center gap-4 rounded-3xl bg-p2-soft px-5 py-4">
          <span className="font-display text-3xl text-p2">Tip!</span>
          <p className="text-lg">Notes <b>on the lines</b> are E, G, B, D, F — "<b>E</b>very <b>G</b>ood <b>B</b>oy <b>D</b>oes <b>F</b>ine."</p>
        </div>
        <Btn className="px-8 py-4 text-lg">Next: Note Quiz <ChevronRight className="h-5 w-5" /></Btn>
      </div>
    </div>
  )
}
