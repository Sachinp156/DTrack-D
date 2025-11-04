// src/screens/AlertsScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SERVER } from '../constants/server';
import { CAMS } from '../constants/cams';

const OFFLINE_TTL_MS = 5000;
const MAX_EVENTS = 120;

function useAlerts(camIds) {
  const [restricted, setRestricted] = useState([]); // [{id, ts, camId, gid, zone}]
  const [events, setEvents] = useState([]);         // [{id, ts, kind, camId}]

  const lastSeen = useRef(new Map());
  const offlineSet = useRef(new Set());

  useEffect(() => {
    const sockets = camIds.map((id) => {
      const ws = new WebSocket(SERVER.replace(/^http/i, 'ws') + `/ws/${id}`);

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const tsSec = msg.timestamp ?? Date.now() / 1000;
          const nowMs = Date.now();

          lastSeen.current.set(id, nowMs);

          (msg.events || []).forEach((ev) => {
            if (ev.type === 'restricted') {
              const row = {
                id: `${id}-restricted-${ev.gid}-${tsSec}`,
                ts: tsSec,
                camId: id,
                gid: ev.gid,
                zone: ev.zone ?? 'Restricted',
              };
              setRestricted((prev) => [row, ...prev].slice(0, 100));
              setEvents((prev) =>
                [{ id: `ev-${row.id}`, ts: tsSec, kind: 'restricted', camId: id }, ...prev].slice(0, MAX_EVENTS)
              );
            }
          });
        } catch {
          // ignore
        }
      };

      return ws;
    });

    const t = setInterval(() => {
      const now = Date.now();
      camIds.forEach((id) => {
        const last = lastSeen.current.get(id) ?? 0;
        const isOffline = now - last > OFFLINE_TTL_MS;
        const wasOffline = offlineSet.current.has(id);

        if (isOffline && !wasOffline) {
          offlineSet.current.add(id);
          setEvents((prev) =>
            [{ id: `offline-${id}-${now}`, ts: now / 1000, kind: 'camera_offline', camId: id }, ...prev].slice(
              0,
              MAX_EVENTS
            )
          );
        } else if (!isOffline && wasOffline) {
          offlineSet.current.delete(id);
        }
      });
    }, 1000);

    return () => {
      sockets.forEach((s) => s && s.close());
      clearInterval(t);
    };
  }, [camIds.join('|')]);

  return { restricted, events };
}

export default function AlertsScreen() {
  const cams = useMemo(() => CAMS || [], []);
  const camIds = useMemo(() => cams.filter(x => x && x.id).map((c) => c.id), [cams]);

  const nameOf = (id) => {
    const cam = cams.find((c) => c.id === id);
    if (cam?.name) return cam.name;
    const m = /cam(\d+)/.exec(id || '');
    return m ? `Camera ${m[1]}` : id || 'Camera';
  };

  const { restricted, events } = useAlerts(camIds);

  const renderEvent = ({ item }) => {
    const timeStr = new Date(item.ts * 1000).toLocaleTimeString();
    const line =
      item.kind === 'restricted'
        ? `Person entered restricted area at ${timeStr}`
        : item.kind === 'camera_offline'
        ? `${nameOf(item.camId)} went offline`
        : timeStr;

    return (
      <View style={s.row}>
        <Text style={s.rowText}>{line}</Text>
        <Text style={s.metaText}>{nameOf(item.camId)}</Text>
      </View>
    );
  };

  return (
    <View style={s.wrap}>
      <Text style={s.h1}>Alerts</Text>

      <View style={s.cardRow}>
        <View style={s.card}>
          <Text style={s.cardLabel}>Restricted Zone</Text>
          <Text style={s.cardValue}>{restricted.length}</Text>
        </View>
      </View>

      <View style={s.listCard}>
        <Text style={s.listTitle}>Recent Alerts</Text>
        <FlatList
          data={events}
          keyExtractor={(it) => it.id}
          renderItem={renderEvent}
          ListEmptyComponent={<Text style={s.empty}>No alerts yet</Text>}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B1220', padding: 12 },
  h1: { color: '#e2e8f0', fontSize: 20, fontWeight: '800' },

  cardRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  card: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cardLabel: { color: '#94a3b8', fontWeight: '700' },
  cardValue: { color: '#93c5fd', fontSize: 24, fontWeight: '900', marginTop: 4 },

  listCard: {
    marginTop: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    flex: 1,
  },
  listTitle: { color: '#e2e8f0', fontWeight: '800', marginBottom: 8 },

  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1E293B' },
  rowText: { color: '#cbd5e1', fontWeight: '700' },
  metaText: { color: '#64748b', fontSize: 12, marginTop: 2 },

  empty: { color: '#64748b', paddingVertical: 8 },
});
