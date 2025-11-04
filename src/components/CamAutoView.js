// src/components/CamAutoView.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { wsURL } from '../constants/server';

const MAX_POINTS = 150;

/**
 * iOS WebSocket frame viewer with short trail overlay
 * trailMs: keep only the last N milliseconds of trajectory points (default 2000ms)
 */
export default function CamAutoView({ camId, style, trailMs = 2000 }) {
  const [status, setStatus] = useState('connecting…');
  const [frameSrc, setFrameSrc] = useState(null);
  const pathsRef = useRef({});                 // { gid: [{u,v,t}, ...] }
  const sizeRef = useRef({ width: 0, height: 0 });
  const frameSizeRef = useRef({ w: 0, h: 0 });
  const [, force] = useState(0);               // tiny re-render trigger for overlay

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const url = wsURL(camId);
    const ws = new WebSocket(url);

    ws.onopen = () => setStatus('connected');
    ws.onerror = () => setStatus('error');
    ws.onclose = () => setStatus('closed');

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        if (msg.jpg) setFrameSrc(`data:image/jpeg;base64,${msg.jpg}`);
        if (msg.frame_w && msg.frame_h) frameSizeRef.current = { w: msg.frame_w, h: msg.frame_h };

        // append & prune by time window
        const now = Date.now();
        const cutoff = now - trailMs;
        const next = { ...pathsRef.current };

        (msg.tracks || []).forEach((t) => {
          const gid = t.global_id ?? t.track_id;
          const [x, y, w, h] = t.bbox || [0, 0, 0, 0];
          const u = x + w / 2;
          const v = y + h;
          const arr = next[gid] ? [...next[gid], { u, v, t: now }] : [{ u, v, t: now }];
          // keep only last 2s and cap points
          next[gid] = arr.filter(p => p.t >= cutoff).slice(-MAX_POINTS);
        });

        // also prune empty tracks
        for (const k of Object.keys(next)) {
          if (!next[k].length) delete next[k];
        }

        pathsRef.current = next;
        // small re-render so overlay updates even if the frame didn't change
        force((n) => n + 1);
      } catch {}
    };

    return () => ws.close();
  }, [camId, trailMs]);

  const scalePoints = () => {
    const { w: fw, h: fh } = frameSizeRef.current;
    const { width: cw, height: ch } = sizeRef.current;
    if (!fw || !fh || !cw || !ch) return {};

    const sx = cw / fw;
    const sy = ch / fh;

    const out = {};
    for (const gid of Object.keys(pathsRef.current)) {
      out[gid] = pathsRef.current[gid].map(({ u, v }) => ({ x: u * sx, y: v * sy }));
    }
    return out;
  };

  const overlay = (() => {
    const scaled = scalePoints();
    const gids = Object.keys(scaled);
    if (gids.length === 0) return null;

    return (
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        {gids.map((gid) => {
          const pts = scaled[gid].map(p => `${p.x},${p.y}`).join(' ');
          if (!pts) return null;
          return (
            <Polyline
              key={gid}
              points={pts}
              stroke="#3b82f6"
              strokeWidth={3}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
    );
  })();

  return (
    <View
      style={[styles.wrap, style]}
      onLayout={(e) => (sizeRef.current = e.nativeEvent.layout)}
    >
      {frameSrc ? (
        <>
          <Image source={{ uri: frameSrc }} style={styles.img} resizeMode="cover" />
          {overlay}
        </>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.phTxt}>Connecting {camId}…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#000', overflow: 'hidden', borderRadius: 12 },
  img: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  phTxt: { color: '#cbd5e1' },
});
