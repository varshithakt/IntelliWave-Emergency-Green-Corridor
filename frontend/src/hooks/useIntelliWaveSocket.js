import { useEffect, useRef, useState } from 'react'
import { WS_URL } from '../services/api'

const initialMetrics = {
  normal_eta_min: 0,
  optimized_eta_min: 0,
  eta_reduction_pct: 0,
  active_signals: 0,
  vehicles_rerouted: 0,
  congestion_score: 0,
  ai_efficiency: 0,
  corridor_length_km: 0,
  route_confidence: 0,
}

export function useIntelliWaveSocket() {
  const [connected, setConnected] = useState(false)
  const [snapshot, setSnapshot] = useState({
    route: [],
    intersections: [],
    vehicles: [],
    ambulances: [],
    metrics: initialMetrics,
    events: ['Awaiting emergency dispatch'],
    heat_points: [],
    sim_status: 'idle',
    playback_speed: 1,
    incident_summary: null,
    active_ambulance_id: null,
    green_radius_m: 200,
    priority: 0,
  })
  const [series, setSeries] = useState([])
  const wsRef = useRef(null)

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'pong') return
        const normalizedData = { ...data }
        if (data.ambulance && !data.ambulances) {
          normalizedData.ambulances = [{ id: 'AMB-001', ...data.ambulance }]
        } else if (!data.ambulances) {
          normalizedData.ambulances = []
        }
        setSnapshot((current) => ({
          ...current,
          ...normalizedData,
          metrics: normalizedData.metrics || current.metrics,
          route: normalizedData.route?.length ? normalizedData.route : current.route,
          heat_points: normalizedData.heat_points || current.heat_points,
          incident_summary: normalizedData.incident_summary ?? current.incident_summary,
        }))
        if (data.metrics && (data.type === 'tick' || data.type === 'dispatch' || data.type === 'complete')) {
          setSeries((current) => {
            const next = [
              ...current,
              {
                tick: current.length + 1,
                congestion: data.metrics.congestion_score,
                efficiency: data.metrics.ai_efficiency,
                eta: data.metrics.optimized_eta_min,
              },
            ]
            return next.slice(-26)
          })
        }
      } catch (error) {
        console.error('WebSocket message error:', error, event.data)
      }
    }
    return () => ws.close()
  }, [])

  return { connected, snapshot, setSnapshot, series, setSeries }
}
