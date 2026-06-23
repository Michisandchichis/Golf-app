import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getRounds, getCloudReady } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import NewRoundSheet from '../../components/NewRoundSheet';
import TopoBackground from '../../components/TopoBackground';
import { colors, fonts, spacing, radius, shadow, glassCard, typography } from '../../lib/theme';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const { openNew } = useLocalSearchParams<{ openNew?: string }>();
  const [modalVisible, setModalVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [roundCount, setRoundCount] = useState(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [lastRound, setLastRound] = useState<{ courseName: string; totalScore: number; date: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from('profiles').select('username').eq('id', user.id).single();
      if (data?.username) setUsername(data.username);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      getCloudReady().then(() => {
        const rounds = getRounds().filter((r) => r.totalScore > 0);
        setRoundCount(rounds.length);
        if (rounds.length > 0) {
          setAvgScore(Math.round(rounds.reduce((s, r) => s + r.totalScore, 0) / rounds.length));
          setBestScore(rounds.reduce((b, r) => (r.totalScore < b ? r.totalScore : b), rounds[0].totalScore));
          setLastRound({ courseName: rounds[0].courseName, totalScore: rounds[0].totalScore, date: rounds[0].date });
        } else {
          setLastRound(null);
          setAvgScore(null);
          setBestScore(null);
        }
      });
    }, [])
  );

  useEffect(() => {
    if (openNew === '1') setModalVisible(true);
  }, [openNew]);

  const firstName = username?.split(' ')[0] ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <TopoBackground />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()}{firstName ? `, ${firstName}` : ''}</Text>
            <Text style={styles.greetingSub}>Ready to hit the course?</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => userId && router.push(`/profile/${userId}` as any)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{firstName?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Stat cards */}
        {roundCount > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{roundCount}</Text>
              <Text style={styles.statLabel}>Rounds</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{avgScore ?? '—'}</Text>
              <Text style={styles.statLabel}>Avg Score</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{bestScore ?? '—'}</Text>
              <Text style={styles.statLabel}>Best Round</Text>
            </View>
          </View>
        )}

        {/* Start new round */}
        <TouchableOpacity style={styles.startBtn} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
          <Text style={styles.startBtnText}>Start New Round</Text>
        </TouchableOpacity>

        {/* Last round card */}
        {lastRound && (
          <TouchableOpacity style={styles.lastRoundCard} onPress={() => router.push('/(tabs)/stats')} activeOpacity={0.8}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lastRoundLabel}>Last Round</Text>
              <Text style={styles.lastRoundCourse}>{lastRound.courseName}</Text>
              <Text style={styles.lastRoundDate}>{lastRound.date}</Text>
            </View>
            <View style={styles.lastRoundRight}>
              <Text style={styles.lastRoundScore}>{lastRound.totalScore}</Text>
              <Text style={styles.lastRoundSeeAll}>See all →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Empty state */}
        {roundCount === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No rounds yet</Text>
            <Text style={styles.emptySub}>Log your first round to start tracking your game.</Text>
          </View>
        )}

      </ScrollView>

      <NewRoundSheet visible={modalVisible} onClose={() => setModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },

  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  greeting: { ...typography.h1, fontSize: 24 },
  greetingSub: { ...typography.bodyMuted, marginTop: 4 },
  avatarBtn: { paddingLeft: spacing.md },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.emerald,
    borderWidth: 1.5, borderColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.offWhite, fontFamily: fonts.bodySemiBold, fontSize: 16 },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1, ...glassCard,
    padding: spacing.md, alignItems: 'center',
  },
  statValue: { ...typography.statNumber },
  statLabel: { ...typography.label, marginTop: spacing.xs },

  startBtn: {
    backgroundColor: colors.emerald,
    borderRadius: radius.lg,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.emerald,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  startBtnText: { color: colors.offWhite, fontFamily: fonts.bodySemiBold, fontSize: 17, letterSpacing: 0.3 },

  lastRoundCard: {
    ...glassCard,
    padding: spacing.lg, flexDirection: 'row', alignItems: 'center',
  },
  lastRoundLabel: { ...typography.label, marginBottom: 5 },
  lastRoundCourse: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.offWhite },
  lastRoundDate: { ...typography.bodyMuted, fontSize: 12, marginTop: 3 },
  lastRoundRight: { alignItems: 'center', paddingLeft: spacing.md },
  lastRoundScore: { fontFamily: fonts.bodySemiBold, fontSize: 38, color: colors.gold, lineHeight: 44 },
  lastRoundSeeAll: { fontSize: 11, color: colors.gray, marginTop: 2 },

  emptyCard: {
    ...glassCard,
    padding: spacing.xl, alignItems: 'center',
  },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.offWhite, marginBottom: 6 },
  emptySub: { ...typography.bodyMuted, textAlign: 'center', lineHeight: 20 },
});
