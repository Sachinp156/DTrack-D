// src/screens/LiveCamsScreen.js
import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import CamAutoView from '../components/CamAutoView';
import { CAMS } from '../constants/cams';

const GAP = 12;
const W = Dimensions.get('window').width;
const TILE_W = (W - GAP * 3) / 2;
const TILE_H = Math.round((TILE_W * 9) / 16);

export default function LiveCamsScreen({ navigation }) {
  return (
    <View style={s.container}>
      <Text style={s.h1}>Live Cameras</Text>

      <View style={s.grid}>
        {CAMS.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={s.tile}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('CameraDetail', { camId: c.id, name: c.name })}
          >
            <View style={s.player}>
              {/* Optional: show a tiny preview; keep it if it’s light. Otherwise, remove to save bandwidth */}
              <CamAutoView camId={c.id} style={{ width: '100%', height: '100%' }} />
            </View>
            <Text style={s.label}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220', padding: 12 },
  h1: { color: '#e2e8f0', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { width: TILE_W },
  player: {
    width: '100%',
    height: TILE_H,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  label: { color: '#94a3b8', marginTop: 6, fontSize: 12 },
});
