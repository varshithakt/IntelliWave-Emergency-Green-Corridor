import { motion } from 'framer-motion'
import { ClipboardCheck, Timer, Waves, Zap } from 'lucide-react'

export default function AfterActionPanel({ summary, onDismiss }) {
  if (!summary) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4 shadow-green backdrop-blur-xl"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-emerald-300" />
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/70">After-action</p>
            <h2 className="text-lg font-semibold text-white">{summary.dispatch_id} complete</h2>
          </div>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300 hover:bg-white/[0.06]"
          >
            Dismiss
          </button>
        ) : null}
      </div>
      <p className="text-sm text-slate-200">{summary.narrative}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={Timer} label="Time saved" value={`${summary.eta_saved_min} min`} />
        <Stat icon={Zap} label="ETA cut" value={`${summary.eta_reduction_pct}%`} />
        <Stat icon={Waves} label="Signals" value={summary.signals_used} />
        <Stat icon={Waves} label="Civilians cleared" value={summary.vehicles_cleared} />
      </div>
    </motion.section>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
      <div className="mb-1 flex items-center gap-2 text-slate-400">
        <Icon className="h-3.5 w-3.5 text-emerald-300" />
        <span className="text-[10px] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
