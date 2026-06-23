import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors, fonts, spacing, radius, typography, rarityGlow } from '../../lib/theme';
import { ALL_MILESTONES, BADGE_GROUPS, RARITY_META, Category, Rarity, computeCareerStats } from '../../lib/achievements';
import { getRounds, getAllHoles } from '../../lib/db';

const CATEGORY_ORDER: Category[] = ['score', 'birdie_eagle', 'putting', 'ball_striking', 'clean_round', 'career'];
const CATEGORY_LABELS: Record<Category, string> = {
  score: 'Score Milestones',
  birdie_eagle: 'Birdie & Eagle',
  putting: 'Putting',
  ball_striking: 'Ball Striking',
  clean_round: 'Clean Rounds',
  career: 'Career',
};

const MILESTONE_MAP = new Map(ALL_MILESTONES.map(m => [m.key, m]));
const GROUPED_KEYS = new Set(BADGE_GROUPS.flatMap(g => g.tiers));
const STANDALONE = ALL_MILESTONES.filter(m => !GROUPED_KEYS.has(m.key));

export default function TrophyCaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [username, setUsername] = useState('golfer');
  const [unlockedKeys, setUnlockedKeys] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
    const [profileRes, achievementsRes] = await Promise.all([
      supabase.from('profiles').select('username').eq('id', id).single(),
      supabase.from('achievements').select('milestone_key').eq('user_id', id),
    ]);
    setUsername(profileRes.data?.username ?? 'golfer');
    setUnlockedKeys(new Set((achievementsRes.data ?? []).map((a: any) => a.milestone_key)));
    setLoading(false);
  }

  const isOwnProfile = currentUserId === id;
  const career = isOwnProfile ? computeCareerStats(getRounds(), getAllHoles()) : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Trophy Case</Text>
        <Text style={styles.subtitle}>@{username} · {unlockedKeys.size}/{ALL_MILESTONES.length} unlocked</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {CATEGORY_ORDER.map((cat) => {
          const groups = BADGE_GROUPS.filter(g => g.category === cat);
          const standalones = STANDALONE.filter(m => m.category === cat);
          if (groups.length === 0 && standalones.length === 0) return null;

          const catKeys = [...groups.flatMap(g => g.tiers), ...standalones.map(m => m.key)];
          const unlockedCat = catKeys.filter(k => unlockedKeys.has(k)).length;

          return (
            <View key={cat} style={styles.section}>
              <Text style={styles.sectionLabel}>
                {CATEGORY_LABELS[cat]} · {unlockedCat}/{catKeys.length}
              </Text>

              {groups.map(group => {
                // Find the highest unlocked tier in this group
                let highestIdx = -1;
                for (let i = group.tiers.length - 1; i >= 0; i--) {
                  if (unlockedKeys.has(group.tiers[i])) { highestIdx = i; break; }
                }
                const currentLevel = highestIdx + 1;
                const totalLevels = group.tiers.length;
                const isMaxed = currentLevel === totalLevels;
                const hasUnlocked = currentLevel > 0;

                const currentMilestone = highestIdx >= 0 ? MILESTONE_MAP.get(group.tiers[highestIdx]) : null;
                const nextMilestone = !isMaxed ? MILESTONE_MAP.get(group.tiers[highestIdx + 1]) : null;

                const displayRarity: Rarity =
                  currentMilestone?.rarity ??
                  MILESTONE_MAP.get(group.tiers[0])?.rarity ??
                  'common';
                const rarityColor = RARITY_META[displayRarity].color;

                const progressData = !isMaxed && isOwnProfile && career && nextMilestone?.progress
                  ? nextMilestone.progress(career)
                  : null;

                return (
                  <View
                    key={group.id}
                    style={[
                      styles.groupCard,
                      { borderColor: hasUnlocked ? rarityColor : colors.hairline },
                      hasUnlocked && (rarityGlow as any)[displayRarity],
                      !hasUnlocked && styles.lockedCard,
                    ]}
                  >
                    <View style={styles.groupRow}>
                      <Text style={styles.groupIcon}>{group.icon}</Text>
                      <View style={styles.groupText}>
                        <Text style={styles.groupName}>{group.name}</Text>
                        {hasUnlocked && currentMilestone && (
                          <Text style={[styles.groupTier, { color: rarityColor }]} numberOfLines={1}>
                            {currentMilestone.label}
                          </Text>
                        )}
                        {!hasUnlocked && nextMilestone && (
                          <Text style={styles.groupTierLocked} numberOfLines={1}>
                            Locked
                          </Text>
                        )}
                      </View>
                      <View style={[styles.levelPill, hasUnlocked && { borderColor: rarityColor + '80' }]}>
                        <Text style={[styles.levelText, hasUnlocked && { color: rarityColor }]}>
                          Lv {currentLevel}/{totalLevels}
                        </Text>
                      </View>
                    </View>

                    {isMaxed ? (
                      <Text style={[styles.maxLevel, { color: rarityColor }]}>
                        ✦ MAX LEVEL — {RARITY_META[displayRarity].label}
                      </Text>
                    ) : (
                      <View style={styles.nextSection}>
                        {progressData ? (
                          <>
                            <View style={styles.progressTrack}>
                              <View
                                style={[
                                  styles.progressFill,
                                  {
                                    width: `${Math.min(100, Math.round((progressData.current / progressData.target) * 100))}%`,
                                    backgroundColor: hasUnlocked ? rarityColor : colors.gray,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={styles.progressText}>
                              {progressData.current.toLocaleString()}/{progressData.target.toLocaleString()} → {nextMilestone?.label}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.nextText}>
                            Next: {nextMilestone?.label ?? MILESTONE_MAP.get(group.tiers[0])?.label}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {standalones.length > 0 && (
                <View style={[styles.grid, groups.length > 0 && { marginTop: spacing.sm }]}>
                  {standalones.map((m) => {
                    const unlocked = unlockedKeys.has(m.key);
                    const rarityColor = RARITY_META[m.rarity].color;
                    return (
                      <View
                        key={m.key}
                        style={[
                          styles.badge,
                          { borderColor: unlocked ? rarityColor : colors.hairline },
                          unlocked && (rarityGlow as any)[m.rarity],
                          !unlocked && styles.badgeLocked,
                        ]}
                      >
                        <Text style={styles.badgeIcon}>{m.icon}</Text>
                        <Text style={styles.badgeLabel}>{m.label}</Text>
                        <Text style={[styles.badgeRarity, { color: rarityColor }]}>{RARITY_META[m.rarity].label}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, alignItems: 'center' },
  back: { color: colors.gold, fontSize: 16, fontFamily: fonts.bodyMedium, alignSelf: 'flex-start' },
  title: { ...typography.h1, marginTop: 8 },
  subtitle: { color: colors.gray, fontSize: 13, marginTop: 2 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  section: { marginTop: spacing.lg },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm },

  // Group badge cards
  groupCard: {
    borderRadius: radius.lg, borderWidth: 1.5, backgroundColor: colors.bgSecondary,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: spacing.sm,
  },
  lockedCard: { opacity: 0.45 },
  groupRow: { flexDirection: 'row', alignItems: 'center' },
  groupIcon: { fontSize: 28, marginRight: 12 },
  groupText: { flex: 1 },
  groupName: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.offWhite },
  groupTier: { fontSize: 12, fontFamily: fonts.bodyMedium, marginTop: 2 },
  groupTierLocked: { fontSize: 12, fontFamily: fonts.body, color: colors.gray, marginTop: 2 },
  levelPill: {
    borderWidth: 1, borderColor: colors.hairline, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3, marginLeft: 8, minWidth: 54, alignItems: 'center',
  },
  levelText: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: colors.gray },
  maxLevel: { fontSize: 11, fontFamily: fonts.bodySemiBold, marginTop: 8 },
  nextSection: { marginTop: 8 },
  progressTrack: {
    width: '100%', height: 5, borderRadius: 3, backgroundColor: colors.hairline, overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  progressText: { fontSize: 11, color: colors.gray, marginTop: 4 },
  nextText: { fontSize: 11, color: colors.gray },

  // Standalone badge grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    width: 100, alignItems: 'center', borderRadius: radius.lg, borderWidth: 1.5,
    paddingVertical: 12, paddingHorizontal: 6, backgroundColor: colors.bgSecondary,
  },
  badgeLocked: { opacity: 0.4 },
  badgeIcon: { fontSize: 26, marginBottom: 4 },
  badgeLabel: { fontSize: 10, fontFamily: fonts.bodyMedium, color: colors.offWhite, textAlign: 'center' },
  badgeRarity: { fontSize: 9, fontFamily: fonts.bodySemiBold, marginTop: 2, textTransform: 'uppercase' },
});
