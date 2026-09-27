import { Activity, Cpu, RadioTower, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Navbar({ connected, dispatchId }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-auto flex flex-col gap-4 rounded-b-2xl border-b border-cyan-300/20 bg-slate-950/72 px-5 py-3 shadow-neon backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-300/40 bg-emerald-400/10 shadow-green">
          <ShieldCheck className="h-6 w-6 text-emerald-300" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/70">AI-Powered Emergency Green Corridor</p>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">IntelliWave AI</h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="hidden items-center gap-3 md:flex">
          <StatusPill icon={Cpu} label="Optimization" value="SIMULATION" />
          <StatusPill icon={RadioTower} label="WebSocket" value={connected ? 'LIVE' : 'OFFLINE'} hot={connected} />
          <StatusPill icon={Activity} label="Dispatch" value={dispatchId || 'STANDBY'} />
        </div>
      </div>
    </motion.header>
  )
}

function StatusPill({ icon: Icon, label, value, hot }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-slate-200">
      <Icon className={hot ? 'h-4 w-4 text-emerald-300' : 'h-4 w-4 text-cyan-200'} />
      <span className="text-slate-400">{label}</span>
      <span className={hot ? 'font-semibold text-emerald-200' : 'font-semibold text-white'}>{value}</span>
    </div>
  )
}
