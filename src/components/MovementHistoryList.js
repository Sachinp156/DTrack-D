// MovementHistoryList.js
import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

export default function MovementHistoryList({ rows }) {
  const renderItem = ({ item }) => (
    <View style={s.row}>
      <Text style={s.time}>{new Date(item.ts * 1000).toLocaleTimeString()}</Text>
      <Text style={s.dot}> • </Text>
      <Text style={s.cam}>{item.camId}</Text>
      <Text style={s.dot}> • </Text>
      <Text style={s.gid}>G{item.gid}</Text>
      <Text style={s.dot}> • </Text>
      <Text style={s.coord}>
        {item.world
          ? `world(${item.world[0].toFixed(1)}, ${item.world[1].toFixed(1)})`
          : `uv(${item.uv[0]}, ${item.uv[1]})`}
      </Text>
    </View>
  );

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Movement History</Text>
      <FlatList
        data={rows}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingVertical: 4 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginTop: 12,
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  title: { color: '#e2e8f0', fontWeight: '800', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomColor: '#1E293B',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  time: { color: '#93a7bf', width: 90 },
  cam: { color: '#60a5fa', fontWeight: '700', width: 54 },
  gid: { color: '#cbd5e1', width: 50 },
  coord: { color: '#cbd5e1', flex: 1 },
  dot: { color: '#4f5a6a' },
});
