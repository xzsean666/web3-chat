import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { VisualHarness } from './src/visual/VisualHarness';

export default function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <VisualHarness />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
