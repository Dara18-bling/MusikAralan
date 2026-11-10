import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-white/85 backdrop-blur p-5 ${className}`}>{children}</section>
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">{children}</p>
}

export function Title({ kicker, title, sub, right }: { kicker: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <Label>{kicker}</Label>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">{title}</h1>
        {sub && <p className="mt-1 max-w-xl text-mute">{sub}</p>}
      </div>
      {right}
    </header>
  )
}

export function Btn({ children, onClick, variant = 'solid', className = '', disabled }: { children: ReactNode; onClick?: () => void; variant?: 'solid' | 'ghost' | 'soft'; className?: string; disabled?: boolean }) {
  const v = variant === 'solid' ? 'grad text-white shadow-sm hover:brightness-110' : variant === 'soft' ? 'bg-p1-soft text-p1 hover:bg-p2-soft hover:text-p2' : 'border border-line hover:bg-p1-soft'
  return <button disabled={disabled} onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p1)] disabled:opacity-50 disabled:cursor-not-allowed ${v} ${className}`}>{children}</button>
}

export function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-p1-soft">
      <div className="grad h-full rounded-full transition-all" style={{ width: `${value}%` }} />
    </div>
  )
}

export function Pill({ children, tone = 'p1' }: { children: ReactNode; tone?: 'p1' | 'p2' | 'gray' }) {
  const t = tone === 'p1' ? 'bg-p1-soft text-p1' : tone === 'p2' ? 'bg-p2-soft text-p2' : 'bg-slate-100 text-mute'
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${t}`}>{children}</span>
}

export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={`w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--p1)] focus:ring-2 focus:ring-p1-soft ${p.className ?? ''}`} />
)
