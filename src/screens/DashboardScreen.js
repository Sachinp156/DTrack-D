// src/screens/DashboardScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Dimensions,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import CamAutoView from '../components/CamAutoView';
import { SERVER } from '../constants/server';
import { CAMS } from '../constants/cams';

/* ---------------------------- constants & helpers --------------------------- */
const SEG_GAP_TIME = 700;          // ms: start a new segment if last point is older
const SEG_GAP_DIST_FRAC = 0.22;    // fraction of frame diagonal; bigger jump = new segment
const MAX_POINTS_PER_SEG = 40;     // cap per segment
const MAX_SEGS_PER_GID = 6;        // keep only a few recent segments per person
const streamUrl = (id) => `${SERVER}/stream/${id}`;

const GAP = 12;
const W = Dimensions.get('window').width;
const TILE_W = W - GAP * 2;
const TILE_H = Math.round((TILE_W * 9) / 16);

const PEOPLE_TTL = 3000;     // ms window for "active people" (match server ~3s)
const CAMERA_TTL = 3000;     // ms window to consider a camera "online"
const TRAIL_TTL = 2000;      // ms: iOS trajectory points older than this are dropped
const MAX_HISTORY_ROWS = 150;

/* ---------------------------- global stats via WS --------------------------- */
/** Aggregates unique global people and camera online count across all cams */
function useGlobalStats(camIds) {
  const [stats, setStats] = useState({ people: 0, cameras: 0 });
  const gidLastSeen = useRef(new Map());   // key = global_id OR composite
  const camLastSeen = useRef(new Map());   // key = camId

  useEffect(() => {
    const sockets = camIds.map((id) => {
      const ws = new WebSocket(SERVER.replace(/^http/i, 'ws') + `/ws/${id}`);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const now = Date.now();
          camLastSeen.current.set(id, now);
          (msg.tracks || []).forEach((t) => {
            const gid = t.global_id ?? `L:${id}:${t.track_id}`;
            gidLastSeen.current.set(gid, now);
          });
        } catch {/* ignore */}
      };
      return ws;
    });

    const timer = setInterval(() => {
      const now = Date.now();
      // prune and count people
      let people = 0;
      for (const [gid, ts] of Array.from(gidLastSeen.current.entries())) {
        if (now - ts < PEOPLE_TTL) people += 1;
        else gidLastSeen.current.delete(gid);
      }
      // prune and count cameras
      let cameras = 0;
      for (const [cid, ts] of Array.from(camLastSeen.current.entries())) {
        if (now - ts < CAMERA_TTL) cameras += 1;
        else camLastSeen.current.delete(cid);
      }
      setStats({ people, cameras });
    }, 800);

    return () => {
      sockets.forEach((s) => s && s.close());
      clearInterval(timer);
      gidLastSeen.current.clear();
      camLastSeen.current.clear();
    };
  }, [camIds.join('|')]);

  return stats;
}

/* ------------------------ selected-camera movement list --------------------- */
function useMovementHistory(camId) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!camId) return;
    let closed = false;
    const ws = new WebSocket(SERVER.replace(/^http/i, 'ws') + `/ws/${camId}`);

    ws.onmessage = (e) => {
      if (closed) return;
      try {
        const msg = JSON.parse(e.data);
        const ts = msg.timestamp ?? Date.now() / 1000;
        (msg.tracks || []).forEach((t) => {
          const [x, y, w, h] = t.bbox || [0, 0, 0, 0];
          const u = Math.round(x + w / 2);
          const v = Math.round(y + h);
          const gid = t.global_id ?? t.track_id;
          const id = `${camId}-${gid}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}`;

          setRows((prev) =>
            [
              {
                id,
                camId,
                gid,
                uv: [u, v],
                world: t.world_xy || null,
                ts,
              },
              ...prev,
            ].slice(0, MAX_HISTORY_ROWS)
          );
        });
      } catch {/* ignore */}
    };

    return () => {
      closed = true;
      ws.close();
    };
  }, [camId]);

  return rows;
}

/* -------------------------- iOS blue trajectory overlay --------------------- */
function TrackOverlayIOS({ camId, containerSize, enabled }) {
  // paths: { gidKey: { segs: Array<Array<{u,v,t}>> } }
  const [paths, setPaths] = useState({});
  const frameRef = useRef({ w: 0, h: 0 });
  useEffect(() => {
    if (Platform.OS !== 'ios' || !enabled) return;
    let closed = false;
    const ws = new WebSocket(SERVER.replace(/^http/i, 'ws') + `/ws/${camId}`);
    ws.onmessage = (e) => {
      if (closed) return;
      try {
        const msg = JSON.parse(e.data);
        const fw = msg.frame_w || frameRef.current.w || 0;
        const fh = msg.frame_h || frameRef.current.h || 0;
        if (fw && fh) frameRef.current = { w: fw, h: fh };
        const now = Date.now();
        const diag = Math.hypot(frameRef.current.w || 0, frameRef.current.h || 0);
        const jumpThresh = diag * SEG_GAP_DIST_FRAC;
        setPaths((prev) => {
          // 1) prune old points/empty segs
          const next = { ...prev };
          Object.keys(next).forEach((k) => {
            const segs = next[k].segs
              .map((seg) => seg.filter((p) => now - p.t < TRAIL_TTL))
              .filter((seg) => seg.length > 0);
            if (segs.length === 0) delete next[k];
            else next[k] = { segs: segs.slice(-MAX_SEGS_PER_GID) };
          });
          // 2) append new points
          (msg.tracks || []).forEach((t) => {
            // stable key: prefer global_id, else scoped local track id
            const gidKey =
              t.global_id != null ? `G:${t.global_id}` : `L:${camId}:${t.track_id}`;
            const [x, y, w, h] = t.bbox || [0, 0, 0, 0];
            const u = x + w / 2;
            const v = y + h;
            if (!next[gidKey]) next[gidKey] = { segs: [] };
            const segs = next[gidKey].segs;
            const lastSeg = segs[segs.length - 1];
            const pt = { u, v, t: now };
            let startNewSeg = false;
            if (!lastSeg || lastSeg.length === 0) {
              startNewSeg = true;
            } else {
              const lastPt = lastSeg[lastSeg.length - 1];
              const dt = now - lastPt.t;
              const dist = Math.hypot(pt.u - lastPt.u, pt.v - lastPt.v);
              if (dt > SEG_GAP_TIME || dist > jumpThresh) startNewSeg = true;
            }
            if (startNewSeg) {
              segs.push([pt]);
              if (segs.length > MAX_SEGS_PER_GID) segs.shift();
            } else {
              lastSeg.push(pt);
              if (lastSeg.length > MAX_POINTS_PER_SEG) lastSeg.shift();
            }
          });
          return next;
        });
      } catch {
        /* ignore */
      }
    };
    return () => {
      closed = true;
      ws.close();
      setPaths({});
    };
  }, [camId, enabled]);
  // scale from frame pixels -> container pixels
  const scalePoint = (p) => {
    const { w: fw, h: fh } = frameRef.current;
    const { width: cw, height: ch } = containerSize || {};
    if (!fw || !fh || !cw || !ch) return null;
    const sx = cw / fw;
    const sy = ch / fh;
    return { x: p.u * sx, y: p.v * sy };
  };
  if (Platform.OS !== 'ios' || !enabled) return null;
  const gidKeys = Object.keys(paths);
  if (gidKeys.length === 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        {gidKeys.map((gid) =>
          paths[gid].segs.map((seg, idx) => {
            const pts = seg
              .map(scalePoint)
              .filter(Boolean)
              .map((p) => `${p.x},${p.y}`)
              .join(' ');
            if (!pts) return null;
            return (
              <Polyline
                key={`${gid}-${idx}`}
                points={pts}
                stroke="#3B82F6"
                strokeWidth={3}
                strokeOpacity={0.85}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })
        )}
      </Svg>
    </View>
  );
}
/* ------------------------------ small UI pieces ----------------------------- */
function StatCard({ label, value }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statVal}>{String(value)}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function HistoryList({ rows }) {
  const renderItem = ({ item }) => (
    <View style={s.histRow}>
      <Text style={s.histRowText}>
        <Text style={s.histTime}>
          {new Date(item.ts * 1000).toLocaleTimeString()}
        </Text>
        {'  •  '}
        <Text style={s.histCam}>{item.camId}</Text>
        {'  •  '}
        G{item.gid}  {'  •  '}
        <Text style={s.histDim}>
          {item.world
            ? `world(${item.world[0].toFixed(1)}, ${item.world[1].toFixed(1)})`
            : `uv(${item.uv[0]}, ${item.uv[1]})`}
        </Text>
      </Text>
    </View>
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(it) => it.id}
      renderItem={renderItem}
      contentContainerStyle={{ paddingVertical: 4 }}
    />
  );
}

/* ---------------------------------- screen --------------------------------- */
export default function DashboardScreen() {
  // camera list decorated with stream URL
  const cams = useMemo(
    () => (CAMS || []).map((c) => ({ ...c, stream: streamUrl(c.id) })),
    []
  );
  const camIds = useMemo(() => cams.map((c) => c.id), [cams]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(cams[0]?.id ?? 'cam1');
  const [showTrails, setShowTrails] = useState(true);

  const selected = useMemo(
    () => cams.find((c) => c.id === selectedId),
    [cams, selectedId]
  );

  const globalStats = useGlobalStats(camIds);
  const historyRows = useMovementHistory(selectedId);

  // layout tracking for overlay scaling
  const [playerSize, setPlayerSize] = useState({ width: TILE_W, height: TILE_H });

  return (
    <View style={s.container}>
      {/* Header: title + trails toggle */}
      <View style={s.headerRow}>
        <Text style={s.h1}>Live Feed</Text>
    </View>

      {/* Global stats */}
      <View style={s.statsRow}>
        <StatCard label="Active People" value={globalStats.people} />
        <StatCard label="Active Cameras" value={globalStats.cameras} />
        <StatCard label="Trails" value={showTrails ? 'On' : 'Off'} />
      </View>

      {/* Trails toggle below stats */}
<View style={s.toggleWrap}>
  <TouchableOpacity
    style={[s.toggleBtn, showTrails ? s.toggleOn : s.toggleOff]}
    onPress={() => setShowTrails((v) => !v)}
    activeOpacity={0.9}
  >
    <Text style={s.toggleText}>{showTrails ? 'Trails: ON' : 'Trails: OFF'}</Text>
  </TouchableOpacity>
</View>


      {/* Camera picker */}
      <View style={s.rowBetween}>
        <Text style={s.sectionLabel}>Camera</Text>
        <TouchableOpacity
          style={s.selector}
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.9}
        >
          <View style={s.selectorDot} />
          <Text style={s.selectorText}>
            {cams.find((c) => c.id === selectedId)?.name || selectedId}
          </Text>
          <Text style={s.selectorCaret}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* Picker modal */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={s.backdrop} onPress={() => setPickerOpen(false)}>
          <View style={s.menu}>
            {cams.map((cam) => (
              <Pressable
                key={cam.id}
                style={s.menuItem}
                onPress={() => {
                  setSelectedId(cam.id);
                  setPickerOpen(false);
                }}
              >
                <Text style={s.menuText}>{cam.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Single selected camera with iOS overlay */}
      {selected && (
        <>
          <View
            style={s.player}
            onLayout={(e) => setPlayerSize(e.nativeEvent.layout)}
          >
            <CamAutoView
              camId={selected.id}
              src={selected.stream}
              label={selected.name}
              style={{ width: '100%', height: '100%' }}
            />
            <TrackOverlayIOS
              camId={selected.id}
              containerSize={playerSize}
              enabled={showTrails}
            />
          </View>
          <Text style={s.srcText}>Source: {selected.stream}</Text>
        </>
      )}

      {/* Movement History for selected camera */}
      <View style={s.historyWrap}>
        <Text style={s.sectionTitle}>
          Movement History — {selected?.name} ({historyRows.length})
        </Text>
        <HistoryList rows={historyRows} />
      </View>
    </View>
  );
}

/* ---------------------------------- styles --------------------------------- */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220', padding: GAP },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: '#e2e8f0', fontSize: 20, fontWeight: '800' },

  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  toggleOn: { borderColor: '#22d3ee', backgroundColor: '#09313a' },
  toggleOff: { borderColor: '#334155', backgroundColor: '#0F172A' },
  toggleText: { color: '#e2e8f0', fontWeight: '700' },

  toggleWrap: {
  marginTop: 4,
  alignItems: 'flex-end', // or 'center' if you want it centered
},


  statsRow: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statVal: { color: '#93c5fd', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#94a3b8', marginTop: 2, fontWeight: '600' },

  rowBetween: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: { color: '#94a3b8', fontSize: 12 },

  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  selectorDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#22d3ee' },
  selectorText: { color: '#cbd5e1', fontWeight: '700' },
  selectorCaret: { color: '#cbd5e1', fontWeight: '900', marginLeft: 2 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', paddingTop: 80 },
  menu: {
    marginHorizontal: 16,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  menuItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  menuText: { color: '#e2e8f0', fontSize: 14 },

  player: {
    width: '100%',
    height: TILE_H,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 12,
  },
  srcText: { color: '#64748b', fontSize: 12, marginTop: 6 },

  historyWrap: {
    marginTop: 14,
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flex: 1,
  },
  sectionTitle: { color: '#e2e8f0', fontWeight: '800', marginBottom: 8 },

  histRow: {
    paddingVertical: 6,
    borderBottomColor: '#1E293B',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  histRowText: { color: '#cbd5e1' },
  histDim: { color: '#7c91b2' },
  histCam: { color: '#60a5fa', fontWeight: '700' },
  histTime: { color: '#a5b4fc' },
});
