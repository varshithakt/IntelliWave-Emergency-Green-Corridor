import { useState } from 'react'
import { AlertTriangle, Loader2, Route } from 'lucide-react'

export default function RoadClosurePanel({ active, onSimulate, closure }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSimulate() {
    setLoading(true)
    setMessage('')
    try {
      const result = await onSimulate()
      const notice = result?.snapshot?.notice
      setMessage(notice || 'Closure added. The ambulance route is recalculating from its current position.')
    } catch (error) {
      setMessage(error.message || 'Could not simulate a closure. Check the backend connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-amber-300/20 bg-slate-950/80 p-4 shadow-neon">
      <div className="mb-3 flex items-start gap-3">
        <span className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-2 text-amber-200"><AlertTriangle className="h-5 w-5" /></span>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-200/70">Scenario control · simulation</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Road closure response</h3>
        </div>
      </div>
      <p className="mb-4 text-sm leading-6 text-slate-400">Inject a temporary closure ahead of the ambulance. The backend rebuilds a route from the ambulance’s current location through a detour waypoint.</p>
      <button type="button" onClick={handleSimulate} disabled={!active || loading} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
        {loading ? 'Recalculating route…' : 'Simulate road closure'}
      </button>
      {message ? <p role="status" className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-5 text-slate-300">{message}</p> : null}
      {closure ? <p className="mt-3 flex items-center gap-2 text-xs text-amber-100/80"><span className="h-2 w-2 rounded-full bg-amber-300" />Active simulated closure · {closure.lat.toFixed(4)}, {closure.lng.toFixed(4)}</p> : null}
      {!active ? <p className="mt-3 text-xs text-slate-500">Start a dispatch to enable this scenario.</p> : null}
    </section>
  )
}
