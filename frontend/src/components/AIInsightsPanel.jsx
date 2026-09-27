import { motion } from 'framer-motion'
import { BrainCircuit, CheckCircle2, Sparkles } from 'lucide-react'

export default function AIInsightsPanel({ metrics, snapshot, disease }) {
  const radius = snapshot?.green_radius_m || 200
  const priority = snapshot?.priority || 0
  const decisions = [
    `${disease || 'Emergency'} priority ${priority} locked a ${radius}m green radius with ${metrics.active_signals || 0} active signals`,
    `Route confidence ${metrics.route_confidence || 0}% after congestion scan`,
    `ETA compression ${metrics.eta_reduction_pct || 0}% through adaptive green wave`,
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-auto rounded-2xl border border-cyan-300/20 bg-slate-950/72 p-4 shadow-neon backdrop-blur-xl"
    >
      <div className="mb-3 flex items-center gap-2">
        <BrainCircuit className="h-5 w-5 text-emerald-300" />
        <h2 className="text-lg font-semibold text-white">AI Optimization Layer</h2>
      </div>
      <div className="space-y-2">
        {decisions.map((decision) => (
          <div key={decision} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.055] p-3 text-sm text-slate-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            {decision}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
        <Sparkles className="h-4 w-4" />
        Lane optimization active · civilian reroutes broadcast
      </div>
    </motion.section>
  )
}
