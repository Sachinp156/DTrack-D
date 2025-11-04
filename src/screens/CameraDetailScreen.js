// src/screens/CameraDetailScreen.js
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import CamAutoView from '../components/CamAutoView';

const GAP = 12;
const W = Dimensions.get('window').width;
const H = Math.round((W * 9) / 16);

export default function CameraDetailScreen({ route, navigation }) {
  const { camId, name } = route.params || {};
  const title = useMemo(() => name || camId || 'Camera', [name, camId]);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const [size, setSize] = useState({ width: W - GAP * 2, height: H });

  return (
    <View style={s.container}>
      <View
        style={[s.player, { height: size.height }]}
        onLayout={(e) => setSize(e.nativeEvent.layout)}
      >
        <CamAutoView camId={camId} style={{ width: '100%', height: '100%' }} />
      </View>
      <Text style={s.meta}>ID: {camId}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220', padding: GAP },
  player: {
    width: '100%',
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  meta: { color: '#94a3b8', marginTop: 8, fontSize: 12 },
});
