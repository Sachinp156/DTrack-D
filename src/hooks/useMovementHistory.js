// src/hooks/useMovementHistory.js
import { useEffect, useRef, useState } from 'react';
import { wsURL } from '../constants/server';

const MAX_HISTORY_ROWS = 200;

export function useMovementHistory(camIds) {
  const [rows, setRows] = useState([]);
  const seqRef = useRef(0);

  useEffect(() => {
    const sockets = camIds.map((camId) => {
      const ws = new WebSocket(wsURL(camId));
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const ts = msg.timestamp ?? Date.now() / 1000;

          (msg.tracks || []).forEach((t) => {
            const [x, y, w, h] = t.bbox || [0, 0, 0, 0];
            const u = Math.round(x + w / 2);
            const v = Math.round(y + h);
            const gid = t.global_id ?? t.track_id;

            const id = `${camId}-${gid}-${Date.now()}-${(seqRef.current += 1)}`;

            setRows((prev) => [
              { id, camId, gid, ts, uv: [u, v], world: t.world_xy || null },
              ...prev,
            ].slice(0, MAX_HISTORY_ROWS));
          });
        } catch {}
      };
      return ws;
    });

    return () => sockets.forEach((s) => s.close());
  }, [camIds.join('|')]);

  return rows;
}
