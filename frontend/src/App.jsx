import { useMemo, useState } from 'react'
import { Activity, Ambulance, BarChart3, RadioTower, ShieldCheck } from 'lucide-react'
import AfterActionPanel from './components/AfterActionPanel'
import AIInsightsPanel from './components/AIInsightsPanel'
import AmbulanceFleetPanel, { createDefaultAmbulances, diseasePriority } from './components/AmbulanceFleetPanel'
import AmbulanceStatusPanel from './components/AmbulanceStatusPanel'
import AnalyticsSidebar from './components/AnalyticsSidebar'
import DispatchControl from './components/DispatchControl'
import LiveActivityFeed from './components/LiveActivityFeed'
import LiveCityMap from './components/LiveCityMap'
import Navbar from './components/Navbar'
import SignalControlPanel from './components/SignalControlPanel'
import TrafficWavePanel from './components/TrafficWavePanel'
import VehicleReroutingPanel from './components/VehicleReroutingPanel'
import { useIntelliWaveSocket } from './hooks/useIntelliWaveSocket'
import {
  abortSimulation,
  dispatchEmergency,
  pauseSimulation,
  requestReroute,
  resumeSimulation,
  setSimulationSpeed,
} from './services/api'

const destinationLocations = [
  { id: 'trauma-hub', label: 'Trauma Care Hub', lat: 12.9542, lng: 77.4908 },
  { id: 'super-hospital', label: 'Bengaluru Super Hospital', lat: 12.925, lng: 77.5869 },
  { id: 'city-gate', label: 'City Emergency Gate', lat: 12.9418, lng: 77.6151 },
  { id: 'apollo-hospital', label: 'Apollo Emergency Center', lat: 12.9612, lng: 77.6387 },
  { id: 'manipal-hospital', label: 'Manipal City Hospital', lat: 12.949, lng: 77.5238 },
]

function mergeAmbulances(fleet, live) {
  const liveById = Object.fromEntries((live || []).map((ambulance) => [ambulance.id, ambulance]))
  const seen = new Set()
  const merged = fleet.map((ambulance) => {
    seen.add(ambulance.id)
    const liveUnit = liveById[ambulance.id]
    if (!liveUnit) return ambulance
    return {
      ...ambulance,
      ...liveUnit,
      name: ambulance.name,
      disease: ambulance.disease,
    }
  })
  for (const unit of live || []) {
    if (!seen.has(unit.id)) merged.push(unit)
  }
  return merged
}

export default function App() {
  const { connected, snapshot, setSnapshot, series, setSeries } = useIntelliWaveSocket()
  const [loading, setLoading] = useState(false)
  const [fleetAmbulances, setFleetAmbulances] = useState(createDefaultAmbulances)
  const [trackedAmbulanceId, setTrackedAmbulanceId] = useState('AMB-001')
  const [trackedVehicleId, setTrackedVehicleId] = useState(null)
  const [destinationPoint, setDestinationPoint] = useState(destinationLocations[2])
  const [clickMode, setClickMode] = useState(null)
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [dispatchEstimate, setDispatchEstimate] = useState(null)
  const [activeView, setActiveView] = useState('command')

  const trackedAmbulance = fleetAmbulances.find((ambulance) => ambulance.id === trackedAmbulanceId) || fleetAmbulances[0]
  const startLocations = useMemo(
    () => fleetAmbulances.map((ambulance) => ({
      id: ambulance.id,
      label: `${ambulance.id} - ${ambulance.name}`,
      lat: ambulance.lat,
      lng: ambulance.lng,
    })),
    [fleetAmbulances],
  )
  const startPoint = useMemo(() => ({
    id: trackedAmbulance.id,
    label: `${trackedAmbulance.id} - ${trackedAmbulance.name}`,
    lat: trackedAmbulance.lat,
    lng: trackedAmbulance.lng,
  }), [trackedAmbulance])

  const destinations = useMemo(() => {
    if (destinationPoint.id === 'map-pin' && !destinationLocations.some((item) => item.id === 'map-pin')) {
      return [destinationPoint, ...destinationLocations]
    }
    return destinationLocations
  }, [destinationPoint])

  const mapSnapshot = useMemo(
    () => ({ ...snapshot, ambulances: mergeAmbulances(fleetAmbulances, snapshot.ambulances) }),
    [snapshot, fleetAmbulances],
  )

  const fleetView = useMemo(
    () => fleetAmbulances.map((ambulance) => {
      const live = (snapshot.ambulances || []).find((unit) => unit.id === ambulance.id)
      return live ? { ...ambulance, status: live.status || ambulance.status } : ambulance
    }),
    [fleetAmbulances, snapshot.ambulances],
  )
  const recommendedAmbulance = useMemo(() => fleetView
    .filter((ambulance) => ['Ready', 'Standby'].includes(ambulance.status))
    .sort((a, b) => diseasePriority[b.disease] - diseasePriority[a.disease])[0] || null,
  [fleetView])

  async function handleDispatch() {
    setLoading(true)
    setSummaryOpen(true)
    setSeries([])
    try {
      const response = await dispatchEmergency({
        start: { lat: startPoint.lat, lng: startPoint.lng },
        destination: { lat: destinationPoint.lat, lng: destinationPoint.lng },
        ambulance_id: trackedAmbulance.id,
        name: trackedAmbulance.name,
        disease: trackedAmbulance.disease,
        priority: diseasePriority[trackedAmbulance.disease],
        fleet: fleetAmbulances.map((ambulance) => ({
          id: ambulance.id,
          lat: ambulance.lat,
          lng: ambulance.lng,
          name: ambulance.name,
          disease: ambulance.disease,
          status: ambulance.status,
        })),
      })
      setSnapshot((current) => ({
        ...current,
        ...response,
        incident_summary: null,
        events: [...(response.events || []), `${trackedAmbulance.id} dispatched from ${trackedAmbulance.name}`],
      }))
      setDispatchEstimate(response.metrics)
      setFleetAmbulances((current) => current.map((ambulance) => (
        ambulance.id === trackedAmbulance.id ? { ...ambulance, status: 'En Route' } : { ...ambulance, status: ambulance.status === 'En Route' ? 'Standby' : ambulance.status }
      )))
    } catch {
      setSnapshot((current) => ({
        ...current,
        events: [...(current.events || []), 'Dispatch failed - check backend status'],
      }))
    } finally {
      setLoading(false)
    }
  }

  async function handleReroute() {
    await requestReroute()
  }

  function handleMapClick(point) {
    if (clickMode === 'destination') {
      setDestinationPoint({
        id: 'map-pin',
        label: `Map pin ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`,
        ...point,
      })
      setClickMode(null)
      return
    }
    if (clickMode === 'pickup') {
      setFleetAmbulances((current) => current.map((ambulance) => (
        ambulance.id === trackedAmbulanceId ? { ...ambulance, lat: point.lat, lng: point.lng } : ambulance
      )))
      setClickMode(null)
    }
  }

  function handleSelectStart(option) {
    if (option?.id) setTrackedAmbulanceId(option.id)
  }

  const activeAmbulance = mapSnapshot.ambulances.find((ambulance) => ambulance.id === trackedAmbulanceId)
  const simStatus = snapshot.sim_status || 'idle'
  const active = simStatus === 'running' || simStatus === 'paused'
  const showSummary = summaryOpen && snapshot.incident_summary && (simStatus === 'complete' || snapshot.type === 'complete')

  return (
    <main className="min-h-screen bg-void text-white lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="app-sidebar flex flex-col border-b border-white/10 bg-slate-950/95 p-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="mb-7 flex items-center gap-3 px-2 pt-1">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><ShieldCheck className="h-6 w-6" /></span>
          <div><p className="font-semibold text-white">IntelliWave</p><p className="text-xs text-slate-500">Emergency response</p></div>
        </div>
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
        <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Main navigation">
          <WorkspaceLink icon={Ambulance} label="Command" active={activeView === 'command'} onClick={() => setActiveView('command')} />
          <WorkspaceLink icon={Activity} label="Fleet" active={activeView === 'fleet'} onClick={() => setActiveView('fleet')} />
          <WorkspaceLink icon={RadioTower} label="Signals & traffic" active={activeView === 'signals'} onClick={() => setActiveView('signals')} />
          <WorkspaceLink icon={BarChart3} label="Insights" active={activeView === 'insights'} onClick={() => setActiveView('insights')} />
        </nav>
        <div className="mt-auto hidden rounded-xl border border-white/10 bg-white/[0.035] p-3 lg:block">
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-400"><span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />Backend connection</div>
          <p className="text-sm font-medium text-white">{connected ? 'Connected' : 'Offline'}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{snapshot.dispatch_id || 'No active dispatch'}</p>
        </div>
      </aside>
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col gap-4 p-4 lg:p-6">
        <Navbar connected={connected} dispatchId={snapshot.dispatch_id} />

        {showSummary ? <AfterActionPanel summary={snapshot.incident_summary} onDismiss={() => setSummaryOpen(false)} /> : null}

        {activeView === 'command' ? <>
        <div className="mb-1"><p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">Operations / Command</p><h2 className="mt-1 text-2xl font-semibold text-white">Emergency dispatch</h2><p className="mt-1 text-sm text-slate-400">Coordinate the ambulance route and monitor the corridor.</p></div>
        <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <AmbulanceFleetPanel
              ambulances={fleetView}
              setAmbulances={setFleetAmbulances}
              trackedAmbulanceId={trackedAmbulanceId}
              onTrackAmbulance={setTrackedAmbulanceId}
              recommendedAmbulance={recommendedAmbulance}
            />
            <DispatchControl
              onDispatch={handleDispatch}
              onReroute={handleReroute}
              onPause={() => pauseSimulation()}
              onResume={() => resumeSimulation()}
              onAbort={() => abortSimulation()}
              onSpeed={(rate) => setSimulationSpeed(rate)}
              loading={loading}
              active={active}
              simStatus={simStatus}
              playbackSpeed={snapshot.playback_speed || 1}
              clickMode={clickMode}
              setClickMode={setClickMode}
              startPoint={startPoint}
              destinationPoint={destinationPoint}
              setStartPoint={handleSelectStart}
              setDestinationPoint={setDestinationPoint}
              startLocations={startLocations}
              destinationLocations={destinations}
              activeDisease={trackedAmbulance.disease}
              priorityScore={diseasePriority[trackedAmbulance.disease]}
            />
          </div>

          <div className="min-h-[620px]">
            <LiveCityMap
              snapshot={mapSnapshot}
              startPoint={startPoint}
              destinationPoint={destinationPoint}
              trackedVehicleId={trackedVehicleId}
              trackedAmbulanceId={trackedAmbulanceId}
              clickMode={clickMode}
              onMapClick={handleMapClick}
            />
          </div>
        </section>
        </> : null}

        {activeView === 'fleet' ? <section className="grid gap-4 xl:grid-cols-2">
          <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">Operations / Fleet</p><h2 className="mb-4 mt-1 text-2xl font-semibold">Ambulance fleet</h2><AmbulanceFleetPanel ambulances={fleetView} setAmbulances={setFleetAmbulances} trackedAmbulanceId={trackedAmbulanceId} onTrackAmbulance={setTrackedAmbulanceId} recommendedAmbulance={recommendedAmbulance} /></div>
          <VehicleReroutingPanel vehicles={snapshot.vehicles || []} onTrackVehicle={setTrackedVehicleId} trackedVehicleId={trackedVehicleId} ambulances={mapSnapshot.ambulances} onTrackAmbulance={setTrackedAmbulanceId} trackedAmbulanceId={trackedAmbulanceId} />
        </section> : null}

        {activeView === 'signals' ? <section className="grid gap-4 xl:grid-cols-2"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">Operations / Network</p><h2 className="mb-4 mt-1 text-2xl font-semibold">Signals & traffic</h2><SignalControlPanel intersections={snapshot.intersections || []} priorityEnabled /></div><TrafficWavePanel series={series} active={active} /></section> : null}

        {activeView === 'insights' ? <section className="grid gap-4 xl:grid-cols-[360px_1fr_390px]">
          <AnalyticsSidebar metrics={snapshot.metrics} series={series} dispatchEstimate={dispatchEstimate} />
          <div className="space-y-4">
            <TrafficWavePanel series={series} active={active} />
            <SignalControlPanel intersections={snapshot.intersections || []} priorityEnabled />
            <VehicleReroutingPanel vehicles={snapshot.vehicles || []} onTrackVehicle={setTrackedVehicleId} trackedVehicleId={trackedVehicleId} ambulances={mapSnapshot.ambulances} onTrackAmbulance={setTrackedAmbulanceId} trackedAmbulanceId={trackedAmbulanceId} />
          </div>
          <div className="space-y-4">
            <AIInsightsPanel metrics={snapshot.metrics} snapshot={snapshot} disease={trackedAmbulance.disease} />
            <AmbulanceStatusPanel
              ambulance={activeAmbulance}
              intersections={snapshot.intersections || []}
              metrics={snapshot.metrics}
            />
            <LiveActivityFeed events={snapshot.events || []} />
          </div>
        </section> : null}
      </div>
    </main>
  )
}

function WorkspaceLink({ icon: Icon, label, active, onClick }) {
  return <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition lg:w-full ${active ? 'bg-emerald-400/10 font-medium text-emerald-200 ring-1 ring-emerald-300/20' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'}`}><Icon className="h-4 w-4" />{label}</button>
}
