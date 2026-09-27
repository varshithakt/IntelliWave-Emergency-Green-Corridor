import { motion } from 'framer-motion'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, ArrowDownRight, Gauge, GitPullRequestArrow, Route, Timer, Waves, Zap } from 'lucide-react'
import { metricPop, stagger } from '../animations/variants'

const metricConfig = [
  ['Normal ETA', 'normal_eta_min', 'min', Timer],
  ['Optimized ETA', 'optimized_eta_min', 'min', Zap],
  ['ETA Reduction', 'eta_reduction_pct', '%', Waves],
  ['Active Signals', 'active_signals', '', Activity],
  ['Vehicles Rerouted', 'vehicles_rerouted', '', GitPullRequestArrow],
  ['Congestion', 'congestion_score', '/100', Gauge],
  ['AI Efficiency', 'ai_efficiency', '%', CpuIcon],
  ['Corridor Length', 'corridor_length_km', 'km', Route],
]

function CpuIcon(props) {
  return <Gauge {...props} />
}

export default function AnalyticsSidebar({ metrics, series, dispatchEstimate }) {
  const baseline = dispatchEstimate?.normal_eta_min ?? 0
  const optimized = dispatchEstimate?.optimized_eta_min ?? 0
  const saved = Math.max(0, baseline - optimized)

  return (
    <motion.aside variants={stagger} initial="hidden" animate="show" className="pointer-events-auto space-y-3">
      <section className="rounded-2xl border border-emerald-300/25 bg-gradient-to-br from-emerald-400/10 to-slate-950/90 p-4 shadow-green">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Route & ETA comparison</p>
            <h2 className="text-lg font-semibold text-white">Dispatch estimate</h2>
          </div>
          <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-wider text-amber-100">Simulation</span>
        </div>
        {!dispatchEstimate ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-400">Dispatch an ambulance to compare the uncoordinated and green-wave ETA estimates.</p>
        ) : (
          <>
            <div className="space-y-2">
              <EtaRow label="Without corridor" value={baseline} max={baseline} detail="Baseline traffic estimate" tone="slate" />
              <EtaRow label="Coordinated route" value={optimized} max={baseline} detail="Signals + traffic model" tone="green" />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2">
              <span className="flex items-center gap-2 text-xs text-emerald-100"><ArrowDownRight className="h-4 w-4" /> Estimated time saved</span>
              <strong className="text-lg text-emerald-200">{saved.toFixed(1)} min</strong>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-slate-500">Estimates are calculated by the current simulation model; they are not live traffic predictions.</p>
          </>
        )}
      </section>
      <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/72 p-4 shadow-neon backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/60">Realtime Analytics</p>
            <h2 className="text-lg font-semibold text-white">Emergency AI Telemetry</h2>
          </div>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
            {metrics.route_confidence || 0}% confidence
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {metricConfig.map(([label, key, suffix, Icon]) => (
            <motion.div key={key} variants={metricPop} className="rounded-xl border border-white/10 bg-white/[0.055] p-3">
              <div className="mb-2 flex items-center justify-between text-slate-400">
                <span className="text-[11px] uppercase tracking-[0.16em]">{label}</span>
                <Icon className="h-4 w-4 text-cyan-200" />
              </div>
              <p className="text-2xl font-semibold text-white">
                {metrics[key] ?? 0}
                <span className="ml-1 text-xs font-medium text-slate-400">{suffix}</span>
              </p>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="h-52 rounded-2xl border border-cyan-300/20 bg-slate-950/72 p-4 shadow-neon backdrop-blur-xl">
        <p className="mb-2 text-xs uppercase tracking-[0.24em] text-cyan-200/60">Predictive Traffic Analysis</p>
        <ResponsiveContainer width="100%" height="84%">
          <AreaChart data={series}>
            <defs>
              <linearGradient id="efficiency" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="congestion" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="tick" hide />
            <YAxis hide domain={[0, 100]} />
            <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(34,211,238,.3)', color: '#fff' }} />
            <Area type="monotone" dataKey="efficiency" stroke="#22c55e" fill="url(#efficiency)" strokeWidth={2} />
            <Area type="monotone" dataKey="congestion" stroke="#22d3ee" fill="url(#congestion)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.aside>
  )
}

function EtaRow({ label, value, max, detail, tone }) {
  const color = tone === 'green' ? 'text-emerald-200' : 'text-slate-200'
  const width = tone === 'green' ? 'bg-emerald-400' : 'bg-slate-500'
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-[11px] text-slate-500">{detail}</p>
        </div>
        <p className={`text-xl font-semibold ${color}`}>{Number(value).toFixed(1)}<span className="ml-1 text-xs font-normal text-slate-400">min</span></p>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${width}`} style={{ width: `${Math.max(4, Math.min(100, Number(value) / Math.max(Number(max), 1) * 100))}%` }} />
      </div>
    </div>
  )
}
