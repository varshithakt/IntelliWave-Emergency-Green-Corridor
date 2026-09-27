import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useEffect, useMemo, useRef } from 'react'
import { divIcon, bengaluruCenter, routeBounds, statusColor, toLatLng } from '../utils/map'

function MapClickCapture({ clickMode, onMapClick }) {
  useMapEvents({
    click(event) {
      if (!clickMode || !onMapClick) return
      onMapClick({ lat: Number(event.latlng.lat.toFixed(5)), lng: Number(event.latlng.lng.toFixed(5)) })
    },
  })
  return null
}

function FitRoute({ route }) {
  const map = useMap()
  useEffect(() => {
    if (route?.length > 2) map.fitBounds(routeBounds(route), { animate: true, duration: 1 })
  }, [map, route])
  return null
}

function TrackTarget({ ambulances, vehicles, trackedAmbulanceId, trackedVehicleId }) {
  const map = useMap()
  const previousTargetId = useRef(null)
  const trackedAmbulance = ambulances?.find((ambulance) => ambulance.id === trackedAmbulanceId)
  const trackedVehicle = vehicles?.find((vehicle) => vehicle.id === trackedVehicleId)
  const target = trackedAmbulance || trackedVehicle

  useEffect(() => {
    if (!target) return
    const position = [target.lat, target.lng]

    if (previousTargetId.current !== target.id) {
      previousTargetId.current = target.id
      map.flyTo(position, 15, { animate: true, duration: 0.75 })
      return
    }

    map.panTo(position, { animate: true, duration: 0.35 })
  }, [map, target?.id, target?.lat, target?.lng])

  return null
}

function HolographicLayer({ route, ambulances, intersections, vehicles, heatPoints, startPoint, destinationPoint, trackedVehicleId, trackedAmbulanceId }) {
  const trackedAmbulance = ambulances?.find(a => a.id === trackedAmbulanceId) || ambulances?.[0]
  const completedRoute = useMemo(() => {
    if (!route?.length || !trackedAmbulance) return []
    const index = Math.max(0, trackedAmbulance.route_index || 0)
    return route.slice(0, index + 1)
  }, [route, trackedAmbulance])

  const previewRoute = !route?.length && startPoint && destinationPoint ? [startPoint, destinationPoint] : []
  const trackedVehicle = vehicles?.find((vehicle) => vehicle.id === trackedVehicleId)

  return (
    <>
      {heatPoints?.map((point, index) => (
        <Circle
          key={`heat-${index}`}
          center={[point.lat, point.lng]}
          radius={120 + point.intensity * 3}
          pathOptions={{ color: '#22d3ee', fillColor: '#22d3ee', fillOpacity: 0.05, opacity: 0.18, weight: 1 }}
        />
      ))}
      {previewRoute.length > 1 && (
        <Polyline positions={previewRoute.map(toLatLng)} pathOptions={{ color: '#f59e0b', weight: 4, opacity: 0.9, dashArray: '8 10' }} />
      )}
      {route?.length > 1 && (
        <>
          <Polyline positions={route.map(toLatLng)} pathOptions={{ color: '#0ea5e9', weight: 8, opacity: 0.2 }} />
          <Polyline positions={route.map(toLatLng)} pathOptions={{ color: '#22d3ee', weight: 4, opacity: 0.76, dashArray: '12 14' }} />
          <Polyline positions={completedRoute.map(toLatLng)} pathOptions={{ color: '#22c55e', weight: 7, opacity: 0.9 }} />
        </>
      )}
      {intersections?.map((signal) => (
        <SignalMarker key={signal.id} signal={signal} />
      ))}
      {vehicles?.map((vehicle) => (
        vehicle.route?.length > 1 && vehicle.status !== 'FLOWING' ? (
          <Polyline
            key={`${vehicle.id}-reroute-path`}
            positions={vehicle.route.map(toLatLng)}
            pathOptions={{
              color: vehicle.status === 'REROUTING' ? '#f59e0b' : '#22d3ee',
              weight: vehicle.status === 'REROUTING' ? 4 : 2,
              opacity: vehicle.status === 'REROUTING' ? 0.9 : 0.45,
              dashArray: '6 8',
            }}
          />
        ) : null
      ))}
      {vehicles?.map((vehicle) => (
        <Marker
          key={vehicle.id}
          position={[vehicle.lat, vehicle.lng]}
          icon={divIcon(
            'vehicle-icon',
            `<div class="vehicle-dot ${vehicle.status.toLowerCase()}"><span></span></div>`,
            [22, 22],
          )}
        />
      ))}
      {trackedVehicle && (
        <>
          <Circle
            center={[trackedVehicle.lat, trackedVehicle.lng]}
            radius={140}
            pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.08, weight: 2, opacity: 0.9 }}
          />
          <Marker
            position={[trackedVehicle.lat, trackedVehicle.lng]}
            icon={divIcon('tracked-vehicle', '<div class="vehicle-dot tracked"><span></span></div>', [30, 30])}
          />
        </>
      )}
      {startPoint && (
        <Marker
          position={[startPoint.lat, startPoint.lng]}
          icon={divIcon('location-start', '<div class="location-pin start">S</div>', [30, 30])}
        />
      )}
      {destinationPoint && (
        <Marker
          position={[destinationPoint.lat, destinationPoint.lng]}
          icon={divIcon('location-end', '<div class="location-pin end">D</div>', [30, 30])}
        />
      )}
      {(!trackedAmbulance || !route?.length) && startPoint && (

        <Marker
          position={[startPoint.lat, startPoint.lng]}
          icon={divIcon('ambulance-preview', '<div class="ambulance-pulse preview"><span>🚑</span></div>', [40, 40])}
        />
      )}
      {ambulances?.map((amb) => (
        <Marker
          key={amb.id}
          position={[amb.lat, amb.lng]}
          icon={divIcon(
            amb.id === trackedAmbulanceId ? 'tracked-ambulance' : 'ambulance-icon',
            `<div class="ambulance-pulse${amb.id === trackedAmbulanceId ? ' tracked' : ''}"><span>🚑 ${amb.id.slice(-3)}</span></div>`,
            amb.id === trackedAmbulanceId ? [50, 50] : [46, 46]
          )}
        />
      ))}
    </>
  )
}

function SignalMarker({ signal }) {
  const color = statusColor(signal.state)
  return (
    <>
      <Circle
        center={[signal.lat, signal.lng]}
        radius={signal.state === 'GREEN' ? (signal.activation_radius_m || 200) : 90}
        pathOptions={{ color, fillColor: color, fillOpacity: signal.state === 'GREEN' ? 0.13 : 0.05, opacity: 0.4, weight: 2 }}
      />
      <Marker
        position={[signal.lat, signal.lng]}
        icon={divIcon(
          'signal-icon',
          `<div class="signal-node ${signal.state.toLowerCase()}"><strong>${signal.countdown || ''}</strong></div>`,
          [34, 34],
        )}
      />
    </>
  )
}

export default function LiveCityMap({ snapshot, startPoint, destinationPoint, trackedVehicleId, trackedAmbulanceId, clickMode, onMapClick }) {
  const { route, ambulances, intersections, vehicles, heat_points: heatPoints } = snapshot
  const clickHint = clickMode === 'pickup' ? 'Click map to set pickup' : clickMode === 'destination' ? 'Click map to set hospital' : 'Live Map Workspace'
  return (
    <div className={`relative h-full min-h-[520px] overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950 shadow-neon ${clickMode ? 'cursor-crosshair' : ''}`}>
      <MapContainer center={bengaluruCenter} zoom={13} zoomControl className="h-full w-full bg-slate-950">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickCapture clickMode={clickMode} onMapClick={onMapClick} />
        <FitRoute route={route?.length ? route : [startPoint, destinationPoint]} />
        <TrackTarget
          ambulances={ambulances}
          vehicles={vehicles}
          trackedAmbulanceId={trackedAmbulanceId}
          trackedVehicleId={trackedVehicleId}
        />
        <HolographicLayer
          route={route}
          ambulances={ambulances}
          intersections={intersections}
          vehicles={vehicles}
          heatPoints={heatPoints}
          startPoint={startPoint}
          destinationPoint={destinationPoint}
          trackedVehicleId={trackedVehicleId}
          trackedAmbulanceId={trackedAmbulanceId}
        />
      </MapContainer>
      <div className="pointer-events-none absolute inset-0 map-panel-vignette" />
      <div className="pointer-events-none absolute inset-0 radar-scan" />
      <div className={`pointer-events-none absolute left-4 top-4 z-[600] rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] backdrop-blur-xl ${
        clickMode ? 'border-amber-300/40 bg-amber-400/15 text-amber-100' : 'border-cyan-300/30 bg-slate-950/80 text-cyan-100'
      }`}>
        {clickHint}
      </div>
    </div>
  )
}
