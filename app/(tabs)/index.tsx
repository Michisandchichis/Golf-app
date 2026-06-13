import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { createRound, getRounds } from '../../lib/db';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { searchCourses, PresetCourse, Tee } from '../../lib/courses';

export default function HomeScreen() {
  const router = useRouter();
  const { openNew } = useLocalSearchParams<{ openNew?: string }>();
  const [modalVisible, setModalVisible] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [holes, setHoles] = useState<'9' | '18'>('18');
  const [courseRating, setCourseRating] = useState('');
  const [slopeRating, setSlopeRating] = useState('');
  const [suggestions, setSuggestions] = useState<PresetCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<PresetCourse | null>(null);
  const [selectedTee, setSelectedTee] = useState<Tee | null>(null);
  const [hasRounds, setHasRounds] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const rounds = getRounds().filter((r) => r.totalScore > 0);
      setHasRounds(rounds.length > 0);
      if (openNew === '1') setModalVisible(true);
    }, [openNew])
  );

  function handleCourseNameChange(name: string) {
    setCourseName(name);
    setSelectedCourse(null);
    setSelectedTee(null);
    setCourseRating('');
    setSlopeRating('');
    setSuggestions(searchCourses(name));
  }

  function selectPresetCourse(course: PresetCourse) {
    setCourseName(course.name);
    setSelectedCourse(course);
    setSuggestions([]);
    setHoles(course.holes === 9 ? '9' : '18');
    const firstTee = course.tees[0];
    setSelectedTee(firstTee);
    setCourseRating(String(firstTee.rating));
    setSlopeRating(String(firstTee.slope));
  }

  function selectTee(tee: Tee) {
    setSelectedTee(tee);
    setCourseRating(String(tee.rating));
    setSlopeRating(String(tee.slope));
  }

  function startRound() {
    if (!courseName.trim()) return;
    const rating = parseFloat(courseRating) || 0;
    const slope = parseInt(slopeRating) || 113;
    const pars = selectedCourse?.pars ?? [];
    const yards = selectedTee?.yards ?? [];
    const handicaps = selectedCourse?.handicaps ?? [];
    const roundId = createRound(courseName.trim(), parseInt(holes), rating, slope);
    setModalVisible(false);
    setCourseName('');
    setCourseRating('');
    setSlopeRating('');
    setSuggestions([]);
    setSelectedCourse(null);
    setSelectedTee(null);
    router.push({
      pathname: '/(tabs)/scorecard',
      params: { roundId, totalHoles: holes, pars: pars.join(','), yards: yards.join(','), handicaps: handicaps.join(',') },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => userId && router.push(`/profile/${userId}` as any)}
          >
            <Text style={styles.profileBtnText}>My Profile</Text>
          </TouchableOpacity>
          <Text style={styles.heroEmoji}>⛳</Text>
          <Text style={styles.heroTitle}>Golf Tracker</Text>
          <Text style={styles.heroSub}>Track your rounds, improve your game</Text>
        </View>

        <TouchableOpacity style={styles.startBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.startBtnText}>Start New Round</Text>
        </TouchableOpacity>

        {hasRounds && (
          <TouchableOpacity style={styles.historyBtn} onPress={() => router.push('/(tabs)/stats')}>
            <Text style={styles.historyBtnText}>📋  Round History</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {modalVisible && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setModalVisible(false)} />
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Round</Text>

            <Text style={styles.label}>Course name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Valley Oaks"
              value={courseName}
              onChangeText={handleCourseNameChange}
              autoFocus
            />

            {suggestions.length > 0 && (
              <View style={styles.suggestions}>
                {suggestions.map((c) => (
                  <TouchableOpacity
                    key={c.name}
                    style={styles.suggestion}
                    onPress={() => selectPresetCourse(c)}
                  >
                    <Text style={styles.suggestionText}>{c.name}</Text>
                    <Text style={styles.suggestionSub}>{c.holes} holes</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedCourse && (
              <>
                <Text style={styles.label}>Tee color</Text>
                <View style={styles.teeRow}>
                  {selectedCourse.tees.map((tee) => (
                    <TouchableOpacity
                      key={tee.name}
                      style={[styles.teeBtn, selectedTee?.name === tee.name && styles.teeBtnActive]}
                      onPress={() => selectTee(tee)}
                    >
                      <Text style={[styles.teeBtnText, selectedTee?.name === tee.name && styles.teeBtnTextActive]}>
                        {tee.name}
                      </Text>
                      <Text style={[styles.teeBtnSub, selectedTee?.name === tee.name && styles.teeBtnTextActive]}>
                        {tee.rating} / {tee.slope}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {!selectedCourse && (
              <>
                <Text style={styles.label}>
                  Course Rating & Slope{' '}
                  <Text style={styles.labelHint}>(on scorecard — needed for handicap)</Text>
                </Text>
                <View style={styles.ratingRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Rating e.g. 72.4"
                    value={courseRating}
                    onChangeText={setCourseRating}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Slope e.g. 113"
                    value={slopeRating}
                    onChangeText={setSlopeRating}
                    keyboardType="number-pad"
                  />
                </View>
              </>
            )}

            {!selectedCourse && (
              <>
                <Text style={styles.label}>Number of holes</Text>
                <View style={styles.holeToggle}>
                  {(['9', '18'] as const).map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[styles.holeBtn, holes === n && styles.holeBtnActive]}
                      onPress={() => setHoles(n)}
                    >
                      <Text style={[styles.holeBtnText, holes === n && styles.holeBtnTextActive]}>
                        {n} holes
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.confirmBtn, !courseName.trim() && { opacity: 0.4 }]}
              onPress={startRound}
              disabled={!courseName.trim()}
            >
              <Text style={styles.confirmBtnText}>Tee Off →</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const GREEN = '#2d6a2d';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 20 },
  hero: { alignItems: 'center', paddingVertical: 32, position: 'relative' },
  profileBtn: { position: 'absolute', top: 0, right: 0, paddingVertical: 4, paddingHorizontal: 10 },
  profileBtnText: { color: GREEN, fontSize: 13, fontWeight: '600' },
  heroEmoji: { fontSize: 64 },
  heroTitle: { fontSize: 28, fontWeight: 'bold', color: GREEN, marginTop: 8 },
  heroSub: { fontSize: 14, color: '#666', marginTop: 4 },
  startBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  historyBtn: {
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  historyBtnText: { color: GREEN, fontSize: 16, fontWeight: '600' },
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 16 },
  label: { fontSize: 13, color: '#555', marginBottom: 6, marginTop: 12 },
  labelHint: { fontSize: 11, color: '#aaa' },
  ratingRow: { flexDirection: 'row', gap: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  suggestions: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestion: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionText: { fontSize: 14, color: '#222', fontWeight: '500' },
  suggestionSub: { fontSize: 12, color: '#aaa' },
  teeRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  teeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  teeBtnActive: { backgroundColor: GREEN, borderColor: GREEN },
  teeBtnText: { fontSize: 14, fontWeight: '600', color: '#444' },
  teeBtnSub: { fontSize: 11, color: '#888', marginTop: 2 },
  teeBtnTextActive: { color: '#fff' },
  holeToggle: { flexDirection: 'row', gap: 10, marginTop: 4 },
  holeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  holeBtnActive: { backgroundColor: GREEN, borderColor: GREEN },
  holeBtnText: { fontSize: 15, color: '#444' },
  holeBtnTextActive: { color: '#fff', fontWeight: '600' },
  confirmBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { color: '#888', fontSize: 14 },
});
