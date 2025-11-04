// src/screens/AnalyticsScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, Path, G } from 'react-native-svg';
import { SERVER } from '../constants/server';
import { CAMS } from '../constants/cams';

const W = Dimensions.get('window').width;
const PAD = 12;

// match server/dashboard freshness window
const PEOPLE_TTL_MS = 3000;
const TICK_MS = 700;

/* --------- hook: live unique people per camera + daily trend ---------- */
function useAnalytics(camIds) {
  // live counts (unique GIDs within TTL)
  const [byCamLive, setByCamLive] = useState({}); // { camId: count }
  const [globalLive, setGlobalLive] = useState(0); // unique across all cams

  // simple daily “detections” trend (message-level, low cost)
  const [daily, setDaily] = useState({}); // { YYYY-MM-DD: count }

  // last seen map per cam: camId -> Map(gid -> ts_ms)
  const lastSeenPerCam = useRef(new Map());

  useEffect(() => {
    // init maps
    camIds.forEach((id) => {
      if (!lastSeenPerCam.current.has(id)) lastSeenPerCam.current.set(id, new Map());
    });

    const sockets = camIds.map((id) => {
      const ws = new WebSocket(SERVER.replace(/^http/i, 'ws') + `/ws/${id}`);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const nowMs = Date.now();
          const dayKey = new Date((msg.timestamp ?? nowMs / 1000) * 1000).toISOString().slice(0, 10);

          // daily trend (cheap aggregate of messages)
          const inc = (msg.tracks || []).length;
          if (inc > 0) {
            setDaily((prev) => ({ ...prev, [dayKey]: (prev[dayKey] ?? 0) + inc }));
          }

          // update last-seen GIDs for this cam
          const gidMap = lastSeenPerCam.current.get(id) || new Map();
          (msg.tracks || []).forEach((t) => {
            const gid = t.global_id;
            if (gid != null) gidMap.set(gid, nowMs);
          });
          lastSeenPerCam.current.set(id, gidMap);
        } catch {
          /* ignore */
        }
      };
      return ws;
    });

    // periodic sweep to compute live counts with TTL like server
    const timer = setInterval(() => {
      const nowMs = Date.now();

      // prune and count per cam
      const perCamCounts = {};
      for (const camId of camIds) {
        const gidMap = lastSeenPerCam.current.get(camId) || new Map();
        for (const [gid, ts] of Array.from(gidMap.entries())) {
          if (nowMs - ts > PEOPLE_TTL_MS) gidMap.delete(gid);
        }
        perCamCounts[camId] = gidMap.size;
      }

      // global unique across cams (union of GIDs still fresh)
      const globalSet = new Set();
      for (const camId of camIds) {
        const gidMap = lastSeenPerCam.current.get(camId) || new Map();
        for (const gid of gidMap.keys()) globalSet.add(gid);
      }

      setByCamLive(perCamCounts);
      setGlobalLive(globalSet.size);
    }, TICK_MS);

    return () => {
      sockets.forEach((s) => s && s.close());
      clearInterval(timer);
      lastSeenPerCam.current.clear();
    };
  }, [camIds.join('|')]);

  return { byCamLive, globalLive, daily };
}

/* ------------------------- tiny chart primitives (SVG) ---------------------- */
function BarChart({ data, width = W - PAD * 2, height = 180 }) {
  const keys = Object.keys(data);
  const vals = keys.map((k) => data[k]);
  const max = Math.max(1, ...vals);
  const barW = (width - 40) / Math.max(1, keys.length);
  return (
    <Svg width={width} height={height}>
      <Line x1={30} y1={10} x2={30} y2={height - 30} stroke="#334155" />
      <Line x1={30} y1={height - 30} x2={width - 10} y2={height - 30} stroke="#334155" />
      {keys.map((k, i) => {
        const h = (vals[i] / max) * (height - 60);
        const x = 30 + i * barW + barW * 0.15;
        const y = height - 30 - h;
        return (
          <G key={k}>
            <Rect x={x} y={y} width={barW * 0.7} height={h} rx={6} fill="#38bdf8" />
            <SvgText x={x + barW * 0.35} y={height - 12} fill="#94a3b8" fontSize="10" textAnchor="middle">
              {k}
            </SvgText>
            <SvgText x={x + barW * 0.35} y={y - 4} fill="#e2e8f0" fontSize="10" textAnchor="middle">
              {vals[i]}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function LineChart({ data, width = W - PAD * 2, height = 180 }) {
  const keys = Object.keys(data).sort(); // dates
  const vals = keys.map((k) => data[k]);
  const max = Math.max(1, ...vals);
  const xStep = (width - 40) / Math.max(1, keys.length - 1);
  const path = keys
    .map((k, i) => {
      const x = 30 + i * xStep;
      const y = height - 30 - (vals[i] / max) * (height - 60);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  return (
    <Svg width={width} height={height}>
      <Line x1={30} y1={10} x2={30} y2={height - 30} stroke="#334155" />
      <Line x1={30} y1={height - 30} x2={width - 10} y2={height - 30} stroke="#334155" />
      <Path d={path} stroke="#22d3ee" strokeWidth={3} fill="none" />
      {keys.map((k, i) => {
        const x = 30 + i * xStep;
        const y = height - 30 - (vals[i] / max) * (height - 60);
        return (
          <G key={k}>
            <Rect x={x - 2} y={y - 2} width={4} height={4} fill="#22d3ee" />
            <SvgText x={x} y={height - 12} fill="#94a3b8" fontSize="10" textAnchor="middle">
              {k.slice(5)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

export default function AnalyticsScreen() {
  const cams = useMemo(() => (CAMS || []).map((c) => c.id), []);
  const { byCamLive, globalLive, daily } = useAnalytics(cams);

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: PAD }}>
      <Text style={s.h1}>Analytics</Text>

      {/* Global stat to match the web dashboard's "Active People" */}
      <View style={s.statCard}>
        <Text style={s.statVal}>{globalLive}</Text>
        <Text style={s.statLabel}>Active People (global)</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>People per Camera (live)</Text>
        <BarChart data={byCamLive} />
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Daily Detections (trend)</Text>
        <LineChart data={daily} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B1220' },
  h1: { color: '#e2e8f0', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  statCard: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    alignItems: 'center',
  },
  statVal: { color: '#93c5fd', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  card: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  cardTitle: { color: '#cbd5e1', fontWeight: '800', marginBottom: 8 },
});
