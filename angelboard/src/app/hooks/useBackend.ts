import { useEffect, useRef, useState, useCallback } from 'react';
import type { Incident, FeedbackType } from '../types/incident';
import type { WsMessage, WsFrameLive } from '../types/backend';
import { fetchAlerts, fetchIncidents, fetchClips, patchAlertFeedback, getDashboardWsUrl } from '../services/api';
import { alertToIncident, wsAlertToIncident, mapFeedbackToBackend, mapFeedbackFromBackend } from '../services/mappers';

export interface LiveFrame {
  deviceId: string;
  dataUrl: string; // "data:image/jpeg;base64,..."
  threatScore: number;
  threatLevel: string;
  timestamp: number | string;
}

export interface ClipMeta {
  url: string;
  deviceId: string | null;
  incidentId: number | null;
  timestamp: string;
}

export function useBackend() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [liveFrame, setLiveFrame] = useState<LiveFrame | null>(null);
  const [clips, setClips] = useState<ClipMeta[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Initial fetch ──
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [alertsResult, incidentsResult, clipsResult] = await Promise.allSettled([
          fetchAlerts(),
          fetchIncidents(),
          fetchClips(),
        ]);

        if (cancelled) return;

        const alerts = alertsResult.status === 'fulfilled' ? alertsResult.value : [];
        const backendIncidents = incidentsResult.status === 'fulfilled' ? incidentsResult.value : [];
        const backendClips = clipsResult.status === 'fulfilled' ? clipsResult.value : [];

        if (alertsResult.status === 'rejected' && incidentsResult.status === 'rejected') {
          setError('Failed to reach backend');
        } else if (alertsResult.status === 'rejected') {
          setError('Failed to fetch alerts');
        } else if (incidentsResult.status === 'rejected') {
          setError('Failed to fetch incidents');
        }

        // Build a lookup of backend incidents by id
        const incidentMap = new Map(backendIncidents.map(i => [i.id, i]));

        // Convert alerts → frontend Incidents
        const mapped = alerts.map(a => alertToIncident(a, incidentMap.get(a.incident_id)));
        setIncidents(mapped);

        // Load existing clips
        setClips(backendClips.map(c => ({
          url: c.clip_url,
          deviceId: c.device_id != null ? String(c.device_id) : null,
          incidentId: c.incident_id,
          timestamp: c.timestamp,
        })));
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── WebSocket ──
  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;

      const url = getDashboardWsUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) setWsConnected(true);
      };

      ws.onclose = () => {
        if (!cancelled) {
          setWsConnected(false);
          // Auto-reconnect after 3s
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        // onclose will fire after this, triggering reconnect
      };

      ws.onmessage = (event) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return; // ignore non-JSON
        }

        switch (msg.type) {
          case 'frame.live': {
            const p = msg.payload as WsFrameLive;
            setLiveFrame({
              deviceId: p.device_id,
              dataUrl: `data:image/jpeg;base64,${p.frame_b64}`,
              threatScore: p.threat_score,
              threatLevel: p.threat_level,
              timestamp: p.timestamp,
            });
            break;
          }

          case 'alert.created': {
            const newIncident = wsAlertToIncident(msg.payload);
            setIncidents(prev => {
              const existing = prev.findIndex(
                i => i.backendIncidentId != null && i.backendIncidentId === newIncident.backendIncidentId,
              );
              if (existing !== -1) {
                // Update existing incident card (keep higher confidence)
                return prev.map((i, idx) =>
                  idx === existing
                    ? {
                        ...i,
                        confidence: Math.max(i.confidence, newIncident.confidence),
                        threatScore: Math.max(i.threatScore ?? 0, newIncident.threatScore ?? 0),
                        threatLevel: newIncident.threatLevel,
                        timestamp: newIncident.timestamp,
                        frameUrl: newIncident.frameUrl ?? i.frameUrl,
                        geminiNarration: newIncident.geminiNarration ?? i.geminiNarration,
                      }
                    : i,
                );
              }
              return [newIncident, ...prev];
            });
            break;
          }

          case 'alert.triaged': {
            const { alert_id, status } = msg.payload;
            const feedback = mapFeedbackFromBackend(status);
            setIncidents(prev =>
              prev.map(i =>
                i.backendAlertId === alert_id ? { ...i, feedback } : i,
              ),
            );
            break;
          }

          case 'clip.uploaded': {
            const p = msg.payload;
            setClips(prev => [
              ...prev,
              {
                url: p.clip_url,
                deviceId: p.device_id,
                incidentId: p.incident_id,
                timestamp: p.timestamp,
              },
            ]);
            break;
          }
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  // ── Send feedback ──
  const sendFeedback = useCallback(
    async (incidentId: string, feedback: FeedbackType) => {
      // Optimistic update
      setIncidents(prev =>
        prev.map(i => (i.id === incidentId ? { ...i, feedback } : i)),
      );

      const incident = incidents.find(i => i.id === incidentId) ??
        // Re-check after setState since state may not have flushed
        undefined;

      const alertId = incident?.backendAlertId;
      if (alertId == null) return; // mock/local-only incident

      try {
        await patchAlertFeedback(alertId, mapFeedbackToBackend(feedback));
      } catch (err) {
        console.error('Feedback PATCH failed', err);
        // Revert optimistic update
        setIncidents(prev =>
          prev.map(i => (i.id === incidentId ? { ...i, feedback: 'pending' } : i)),
        );
      }
    },
    [incidents],
  );

  return {
    incidents,
    setIncidents,
    liveFrame,
    clips,
    wsConnected,
    loading,
    error,
    sendFeedback,
  };
}
