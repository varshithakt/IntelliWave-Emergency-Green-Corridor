import { Ambulance, ArrowRight, GitBranch, Loader2, MapPin, MousePointerClick, Pause, Play, Square, Gauge } from 'lucide-react'
import { motion } from 'framer-motion'

export default function DispatchControl({
  onDispatch,
  onReroute,
  onPause,
  onResume,
  onAbort,
  onSpeed,
  loading,
  active,
  simStatus,
  playbackSpeed,
  clickMode,
  setClickMode,
  startPoint,
  destinationPoint,
  setStartPoint,
  setDestinationPoint,
  startLocations,
  destinationLocations,
  activeDisease,
  priorityScore,
}) {
  const paused = simStatus === 'paused'
  const live = simStatus === 'running' || paused

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="pointer-events-auto rounded-2xl border border-cyan-300/20 bg-slate-950/72 p-4 shadow-neon backdrop-blur-xl"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/70">Route Select</p>
          <h2 className="text-lg font-semibold text-white">Target Locations</h2>
        </div>
        <ArrowRight className="h-5 w-5 text-cyan-200" />
      </div>
      <div className="grid gap-3">
        <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.22em] text-rose-100/70">Disease / Emergency Priority</p>
          <p className="mt-1 text-sm font-semibold text-white">{activeDisease || 'Select ambulance emergency'}</p>
          <p className="mt-1 text-xs text-rose-100/80">Priority score: {priorityScore || 0} · larger green radius and faster corridor</p>
        </div>
        <label className="grid gap-2 text-sm text-slate-300">
          <span className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">Start node</span>
          <select
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-300/70"
            value={startPoint.id || startPoint.label}
            onChange={(event) => {
              const next = startLocations.find((option) => (option.id || option.label) === event.target.value)
              if (next) setStartPoint(next)
            }}
          >
            {startLocations.map((option) => (
              <option key={option.id || option.label} value={option.id || option.label} className="bg-slate-950 text-white">
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
          <span className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">Destination</span>
          <select
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-300/70"
            value={destinationPoint.id || destinationPoint.label}
            onChange={(event) => {
              const next = destinationLocations.find((option) => (option.id || option.label) === event.target.value)
              if (next) setDestinationPoint(next)
            }}
          >
            {destinationLocations.map((option) => (
              <option key={option.id || option.label} value={option.id || option.label} className="bg-slate-950 text-white">
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setClickMode(clickMode === 'pickup' ? null : 'pickup')}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
            clickMode === 'pickup'
              ? 'border-amber-300/50 bg-amber-400/20 text-amber-100'
              : 'border-white/10 bg-white/[0.06] text-slate-200 hover:border-cyan-300/40'
          }`}
        >
          <MousePointerClick className="h-4 w-4" />
          Map pickup
        </button>
        <button
          type="button"
          onClick={() => setClickMode(clickMode === 'destination' ? null : 'destination')}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
            clickMode === 'destination'
              ? 'border-amber-300/50 bg-amber-400/20 text-amber-100'
              : 'border-white/10 bg-white/[0.06] text-slate-200 hover:border-cyan-300/40'
          }`}
        >
          <MousePointerClick className="h-4 w-4" />
          Map hospital
        </button>
      </div>
      <button
        onClick={onDispatch}
        disabled={loading}
        className="group relative mt-4 w-full overflow-hidden rounded-xl border border-emerald-300/40 bg-emerald-400/15 px-5 py-4 text-left shadow-green transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,.18),transparent)] opacity-0 transition group-hover:translate-x-full group-hover:opacity-100" />
        <span className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-xs uppercase tracking-[0.24em] text-emerald-100/70">Emergency Command</span>
            <span className="mt-1 block text-lg font-semibold text-white">Dispatch Emergency Ambulance</span>
          </span>
          {loading ? <Loader2 className="h-8 w-8 animate-spin text-emerald-200" /> : <Ambulance className="h-9 w-9 text-emerald-200" />}
        </span>
      </button>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={paused ? onResume : onPause}
          disabled={!live}
          className="flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-2 py-3 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-40"
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={onAbort}
          disabled={!live}
          className="flex items-center justify-center gap-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-2 py-3 text-xs font-medium text-rose-100 transition hover:bg-rose-400/20 disabled:opacity-40"
        >
          <Square className="h-4 w-4" />
          Abort
        </button>
        <button
          type="button"
          onClick={onReroute}
          className="flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-2 py-3 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/20"
        >
          <GitBranch className="h-4 w-4" />
          Reroute
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-cyan-200" />
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Speed</p>
        {[0.5, 1, 2].map((rate) => (
          <button
            key={rate}
            type="button"
            onClick={() => onSpeed(rate)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              Number(playbackSpeed) === rate
                ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100'
                : 'border-white/10 bg-white/[0.05] text-slate-300 hover:border-cyan-300/40'
            }`}
          >
            {rate}x
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-slate-200">
          <MapPin className={active ? 'h-3.5 w-3.5 text-emerald-300' : 'h-3.5 w-3.5 text-slate-500'} />
          {simStatus === 'complete' ? 'Arrived' : active ? (paused ? 'Paused' : 'Corridor Live') : 'Awaiting'}
        </div>
      </div>
    </motion.div>
  )
}
