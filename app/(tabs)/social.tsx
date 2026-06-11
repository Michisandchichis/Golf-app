import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';

export default function SocialScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>👥</Text>
        <Text style={styles.title}>Social & Group Play</Text>
        <Text style={styles.sub}>
          Play with friends, share live leaderboards, and compete in friendly tournaments.
        </Text>

        <View style={styles.featureList}>
          {[
            { icon: '🔗', label: 'Create a game code' },
            { icon: '📡', label: 'Live score sync' },
            { icon: '🏆', label: 'Leaderboards' },
            { icon: '🎖', label: 'Tournaments' },
          ].map((f) => (
            <View key={f.label} style={styles.featureItem}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonText}>🚧 Coming in Phase 3</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const GREEN = '#2d6a2d';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 64 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#222', marginTop: 16, textAlign: 'center' },
  sub: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  featureList: { marginTop: 28, width: '100%', gap: 10 },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  featureIcon: { fontSize: 22 },
  featureLabel: { fontSize: 15, color: '#333', fontWeight: '500' },
  comingSoon: {
    marginTop: 24,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  comingSoonText: { fontSize: 13, color: '#856404' },
});
