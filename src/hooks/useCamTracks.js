// useCamTracks.js
import { useEffect, useRef, useState } from 'react';
import { SERVER } from '../constants/server';

export function useCamTracks(camId) {
  const [activeTracks, setActive] = useState([]);
  const [status, setStatus] = useState('connecting…');
  const lastTs = useRef(0);

  useEffect(() => {
    if (!camId) return;
    const url = SERVER.replace(/^http/i, 'ws') + `/ws/${camId}`;
    const ws = new WebSocket(url);

    ws.onopen = () => setStatus('connected');
    ws.onerror = () => setStatus('error');
    ws.onclose = () => setStatus('closed');

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.timestamp && msg.timestamp <= lastTs.current) return;
        lastTs.current = msg.timestamp || Date.now() / 1000;
        setActive(msg.tracks || []);
      } catch {}
    };

    return () => ws.close();
  }, [camId]);

  return { status, activeTracks };
}
