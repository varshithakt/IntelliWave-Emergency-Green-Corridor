import { Ambulance, Crosshair, MapPin, Save, Siren } from 'lucide-react'

const defaultSlots = [
  { id: 'AMB-001', name: 'MG Road Emergency Pickup', disease: 'Cardiac Arrest', lat: 12.9716, lng: 77.5946, status: 'Ready' },
  { id: 'AMB-002', name: 'Yelahanka Trauma Pickup', disease: 'Road Accident Trauma', lat: 13.0378, lng: 77.597, status: 'Ready' },
  { id: 'AMB-003', name: 'Sarjapur Critical Pickup', disease: 'Stroke Symptoms', lat: 12.9152, lng: 77.6642, status: 'Ready' },
]

export const diseasePriority = {
  'Cardiac Arrest': 100,
  'Severe Breathing Difficulty': 94,
  'Stroke Symptoms': 90,
  'Road Accident Trauma': 86,
  'Pregnancy Emergency': 78,
  'High Fever / Infection': 58,
  'Fracture / Injury': 44,
  'Routine Transfer': 20,
}

const diseases = Object.keys(diseasePriority)

export function createDefaultAmbulances() {
  return defaultSlots
}

export default function AmbulanceFleetPanel({ ambulances, setAmbulances, trackedAmbulanceId, onTrackAmbulance, recommendedAmbulance }) {
  const priorityOrder = [...ambulances].sort((a, b) => diseasePriority[b.disease] - diseasePriority[a.disease])

  function updateAmbulance(id, field, value) {
    setAmbulances((current) =>
      current.map((ambulance) => (
        ambulance.id === id
          ? { ...ambulance, [field]: field === 'lat' || field === 'lng' ? Number(value) : value }
          : ambulance
      )),
    )
  }

  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-slate-950/82 p-4 shadow-neon backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/60">Ambulance Locations</p>
          <h2 className="text-lg font-semibold text-white">Store & Track Fleet</h2>
        </div>
        <Ambulance className="h-5 w-5 text-rose-300" />
      </div>

      <div className="mb-4 rounded-xl border border-rose-300/20 bg-rose-400/10 p-3">
        <div className="mb-2 flex items-center gap-2 text-rose-100">
          <Siren className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">Priority Movement Order</p>
        </div>
        <div className="space-y-1 text-sm text-slate-200">
          {priorityOrder.map((ambulance, index) => (
            <button
              key={ambulance.id}
              type="button"
              onClick={() => onTrackAmbulance(ambulance.id)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left transition hover:bg-white/[0.06]"
            >
              <span>{index + 1}. {ambulance.name}</span>
              <span className="text-xs font-semibold text-rose-100">{ambulance.disease}</span>
            </button>
          ))}
        </div>
      </div>

      {recommendedAmbulance ? (
        <div className="mb-4 rounded-xl border border-emerald-300/25 bg-emerald-400/[0.08] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">Dispatch recommendation</p>
              <p className="mt-1 text-sm font-semibold text-white">{recommendedAmbulance.id} · {recommendedAmbulance.disease}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Highest configured emergency priority among available units (P{diseasePriority[recommendedAmbulance.disease]}). Review and confirm before dispatch.</p>
            </div>
            <button type="button" onClick={() => onTrackAmbulance(recommendedAmbulance.id)} className="shrink-0 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/20">
              {trackedAmbulanceId === recommendedAmbulance.id ? 'Selected' : 'Select unit'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-400/[0.06] p-3 text-xs text-amber-100/80">No available ambulance to recommend. Set a unit to Ready before dispatch.</div>
      )}

      <div className="space-y-3">
        {ambulances.map((ambulance) => (
          <div key={ambulance.id} className="rounded-xl border border-white/10 bg-white/[0.055] p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{ambulance.id}</p>
                <p className="text-xs text-slate-400">{ambulance.status}</p>
              </div>
              <button
                type="button"
                onClick={() => onTrackAmbulance(ambulance.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase transition ${
                  trackedAmbulanceId === ambulance.id
                    ? 'border-rose-300/50 bg-rose-400/20 text-rose-100'
                    : 'border-white/10 bg-white/[0.06] text-slate-200 hover:border-cyan-300/40 hover:text-cyan-100'
                }`}
              >
                <Crosshair className="h-3.5 w-3.5" />
                {trackedAmbulanceId === ambulance.id ? 'Tracking' : 'Track'}
              </button>
            </div>

            <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-cyan-200/60">Location name</label>
            <input
              value={ambulance.name}
              onChange={(event) => updateAmbulance(ambulance.id, 'name', event.target.value)}
              className="mb-3 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70"
            />

            <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-rose-200/70">Disease / Emergency</label>
            <select
              value={ambulance.disease}
              onChange={(event) => updateAmbulance(ambulance.id, 'disease', event.target.value)}
              className="mb-3 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/70"
            >
              {diseases.map((disease) => (
                <option key={disease} value={disease} className="bg-slate-950 text-white">
                  {disease} - Priority {diseasePriority[disease]}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs text-slate-300">
                Latitude
                <input
                  type="number"
                  step="0.0001"
                  value={ambulance.lat}
                  onChange={(event) => updateAmbulance(ambulance.id, 'lat', event.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70"
                />
              </label>
              <label className="grid gap-1 text-xs text-slate-300">
                Longitude
                <input
                  type="number"
                  step="0.0001"
                  value={ambulance.lng}
                  onChange={(event) => updateAmbulance(ambulance.id, 'lng', event.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70"
                />
              </label>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="h-3.5 w-3.5 text-cyan-200" />
              {ambulance.lat.toFixed(4)}, {ambulance.lng.toFixed(4)}
              <span className="rounded-full bg-rose-400/10 px-2 py-1 font-semibold text-rose-100">
                P{diseasePriority[ambulance.disease]}
              </span>
              <Save className="ml-auto h-3.5 w-3.5 text-emerald-300" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
