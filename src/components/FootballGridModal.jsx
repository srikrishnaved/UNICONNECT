import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { X, Trophy } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { generateGrid, checkAnswer } from '../lib/gridGenerator';
import { colors, spacing, radius } from '../theme';

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const CELL_STATUS = { idle: 'idle', correct: 'correct', incorrect: 'incorrect' };

export default function FootballGridModal({ visible, onClose }) {
  const { userProfile } = useApp();
  const [loading, setLoading] = useState(true);
  const [grid, setGrid] = useState(null);
  const [cellInputs, setCellInputs] = useState(Array(9).fill(''));
  const [cellStatus, setCellStatus] = useState(Array(9).fill(CELL_STATUS.idle));
  const [cellAnswers, setCellAnswers] = useState(Array(9).fill(null)); // playerName|null
  const [cellLocked, setCellLocked] = useState(Array(9).fill(false));
  const [cellMessages, setCellMessages] = useState(Array(9).fill(''));
  const [usedPlayerIds, setUsedPlayerIds] = useState(new Set());
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [existingSession, setExistingSession] = useState(null);

  useEffect(() => {
    if (visible) loadGame();
  }, [visible]);

  async function loadGame() {
    setLoading(true);
    try {
      const [pRes, pcRes, prRes] = await Promise.all([
        supabase.from('gg_players').select('id,name,aliases'),
        supabase.from('gg_player_clubs').select('player_id,club_name,league'),
        supabase.from('gg_player_countries').select('player_id,country_name'),
      ]);

      const date = todayStr();
      const generated = generateGrid(
        date,
        pRes.data || [],
        pcRes.data || [],
        prRes.data || []
      );
      setGrid(generated);

      // Check for existing session today
      const { data: session } = await supabase
        .from('gg_sessions')
        .select('*')
        .eq('user_id', userProfile.id)
        .eq('grid_date', date)
        .maybeSingle();

      if (session) {
        setExistingSession(session);
        restoreSession(session, generated);
      } else {
        resetCellState();
      }
    } catch (e) {
      console.warn('FootballGrid load error', e);
    } finally {
      setLoading(false);
    }
  }

  function resetCellState() {
    setCellInputs(Array(9).fill(''));
    setCellStatus(Array(9).fill(CELL_STATUS.idle));
    setCellAnswers(Array(9).fill(null));
    setCellLocked(Array(9).fill(false));
    setCellMessages(Array(9).fill(''));
    setUsedPlayerIds(new Set());
    setScore(0);
    setDone(false);
    setSessionSaved(false);
    setExistingSession(null);
  }

  function restoreSession(session, gridData) {
    const answers = session.answers || [];
    const newStatus = Array(9).fill(CELL_STATUS.idle);
    const newAnswers = Array(9).fill(null);
    const newLocked = Array(9).fill(false);
    const newInputs = Array(9).fill('');
    const usedIds = new Set();

    for (const ans of answers) {
      const idx = ans.cellIndex;
      if (idx == null) continue;
      newStatus[idx] = ans.correct ? CELL_STATUS.correct : CELL_STATUS.incorrect;
      newAnswers[idx] = ans.playerName || ans.input || '';
      newLocked[idx] = true;
      newInputs[idx] = ans.playerName || ans.input || '';
      if (ans.correct && ans.playerId) usedIds.add(ans.playerId);
    }

    setCellStatus(newStatus);
    setCellAnswers(newAnswers);
    setCellLocked(newLocked);
    setCellInputs(newInputs);
    setCellMessages(Array(9).fill(''));
    setUsedPlayerIds(usedIds);
    setScore(session.score || 0);
    setDone(!!session.completed_at);
    setSessionSaved(true);
  }

  function submitCell(idx) {
    if (!grid || cellLocked[idx]) return;
    const input = cellInputs[idx];
    const rowIdx = Math.floor(idx / 3);
    const colIdx = idx % 3;
    const validPlayers = grid.cells[idx];

    const result = checkAnswer(input, validPlayers, usedPlayerIds);

    const newStatus = [...cellStatus];
    const newLocked = [...cellLocked];
    const newAnswers = [...cellAnswers];
    const newMessages = [...cellMessages];

    if (result.result === 'empty') {
      newMessages[idx] = result.message;
      setCellMessages(newMessages);
      return;
    }

    if (result.result === 'used') {
      newMessages[idx] = result.message;
      setCellMessages(newMessages);
      return;
    }

    newLocked[idx] = true;
    newMessages[idx] = '';

    if (result.result === 'correct') {
      newStatus[idx] = CELL_STATUS.correct;
      newAnswers[idx] = result.playerName;
      const newUsed = new Set(usedPlayerIds);
      newUsed.add(result.playerId);
      setUsedPlayerIds(newUsed);
      const newScore = score + 1;
      setScore(newScore);

      setCellStatus(newStatus);
      setCellLocked(newLocked);
      setCellAnswers(newAnswers);
      setCellMessages(newMessages);

      const allDone = newLocked.every(Boolean);
      if (allDone) {
        setDone(true);
        saveSession(newStatus, newAnswers, newScore, true);
      } else {
        saveSession(newStatus, newAnswers, newScore, false);
      }
    } else {
      newStatus[idx] = CELL_STATUS.incorrect;
      newAnswers[idx] = input;
      setCellStatus(newStatus);
      setCellLocked(newLocked);
      setCellAnswers(newAnswers);
      setCellMessages(newMessages);

      const allDone = newLocked.every(Boolean);
      if (allDone) {
        setDone(true);
        saveSession(newStatus, newAnswers, score, true);
      } else {
        saveSession(newStatus, newAnswers, score, false);
      }
    }
  }

  async function saveSession(statuses, answers, finalScore, completed) {
    if (!grid || !userProfile) return;
    const date = todayStr();
    const answersPayload = statuses.map((st, i) => ({
      cellIndex: i,
      input: cellInputs[i],
      playerName: answers[i],
      correct: st === CELL_STATUS.correct,
    }));

    const payload = {
      user_id: userProfile.id,
      grid_date: date,
      row_categories: grid.rowCategories,
      col_categories: grid.colCategories,
      answers: answersPayload,
      score: finalScore,
      completed_at: completed ? new Date().toISOString() : null,
    };

    await supabase
      .from('gg_sessions')
      .upsert(payload, { onConflict: 'user_id,grid_date' });
    setSessionSaved(true);
  }

  function finishEarly() {
    setDone(true);
    saveSession(cellStatus, cellAnswers, score, true);
  }

  function categoryLabel(cat) {
    return cat.value;
  }

  function categoryEmoji(cat) {
    if (cat.type === 'country') return '🌍';
    return '🏟️';
  }

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Football Grid</Text>
              <Text style={styles.subtitle}>
                {loading ? 'Loading…' : done ? `Final score: ${score}/9` : `Score: ${score}/9`}
              </Text>
            </View>
            <View style={styles.headerRight}>
              {!done && !loading && (
                <TouchableOpacity onPress={finishEarly} style={styles.doneBtn} activeOpacity={0.7}>
                  <Text style={styles.doneBtnText}>Finish</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>Building today's grid…</Text>
            </View>
          ) : done ? (
            <ScrollView contentContainerStyle={styles.doneContainer}>
              <Trophy size={48} color={colors.amber} />
              <Text style={styles.doneScore}>{score}/9</Text>
              <Text style={styles.doneLabel}>
                {score === 9 ? 'Perfect!' : score >= 6 ? 'Great job!' : score >= 3 ? 'Not bad!' : 'Better luck tomorrow!'}
              </Text>
              {grid && (
                <View style={styles.resultGrid}>
                  {renderGridReadOnly()}
                </View>
              )}
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {grid && renderGrid()}
              <Text style={styles.hint}>
                Type a player name in each cell, then press ✓ to check. A player can only be used once.
              </Text>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  function renderGrid() {
    const { rowCategories, colCategories } = grid;
    return (
      <View style={styles.gridWrap}>
        {/* Top row: empty corner + 3 col headers */}
        <View style={styles.gridRow}>
          <View style={styles.cornerCell} />
          {colCategories.map((cat, ci) => (
            <View key={ci} style={styles.headerCell}>
              <Text style={styles.headerEmoji}>{categoryEmoji(cat)}</Text>
              <Text style={styles.headerLabel} numberOfLines={2}>{categoryLabel(cat)}</Text>
            </View>
          ))}
        </View>

        {/* 3 data rows */}
        {rowCategories.map((rowCat, ri) => (
          <View key={ri} style={styles.gridRow}>
            <View style={styles.headerCell}>
              <Text style={styles.headerEmoji}>{categoryEmoji(rowCat)}</Text>
              <Text style={styles.headerLabel} numberOfLines={2}>{categoryLabel(rowCat)}</Text>
            </View>
            {colCategories.map((_, ci) => {
              const idx = ri * 3 + ci;
              return renderCell(idx);
            })}
          </View>
        ))}
      </View>
    );
  }

  function renderCell(idx) {
    const status = cellStatus[idx];
    const locked = cellLocked[idx];
    const answer = cellAnswers[idx];
    const msg = cellMessages[idx];

    const bg =
      status === CELL_STATUS.correct ? colors.greenLight :
      status === CELL_STATUS.incorrect ? colors.redLight :
      colors.card;

    const borderColor =
      status === CELL_STATUS.correct ? colors.green :
      status === CELL_STATUS.incorrect ? colors.red :
      colors.border;

    return (
      <View key={idx} style={[styles.cell, { backgroundColor: bg, borderColor }]}>
        {locked ? (
          <View style={styles.lockedContent}>
            <Text style={[
              styles.lockedText,
              { color: status === CELL_STATUS.correct ? colors.green : colors.red }
            ]} numberOfLines={2}>
              {status === CELL_STATUS.correct ? '✓ ' : '✗ '}{answer}
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.cellInput}
              value={cellInputs[idx]}
              onChangeText={val => {
                const next = [...cellInputs];
                next[idx] = val;
                setCellInputs(next);
                if (cellMessages[idx]) {
                  const msgs = [...cellMessages];
                  msgs[idx] = '';
                  setCellMessages(msgs);
                }
              }}
              placeholder="Player…"
              placeholderTextColor={colors.textTertiary}
              onSubmitEditing={() => submitCell(idx)}
              returnKeyType="done"
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => submitCell(idx)}
              activeOpacity={0.7}
            >
              <Text style={styles.submitBtnText}>✓</Text>
            </TouchableOpacity>
          </>
        )}
        {!!msg && !locked && (
          <Text style={styles.cellMsg} numberOfLines={1}>{msg}</Text>
        )}
      </View>
    );
  }

  function renderGridReadOnly() {
    if (!grid) return null;
    const { rowCategories, colCategories } = grid;
    return (
      <View>
        <View style={styles.gridRow}>
          <View style={styles.cornerCell} />
          {colCategories.map((cat, ci) => (
            <View key={ci} style={styles.headerCell}>
              <Text style={styles.headerEmoji}>{categoryEmoji(cat)}</Text>
              <Text style={styles.headerLabel} numberOfLines={2}>{categoryLabel(cat)}</Text>
            </View>
          ))}
        </View>
        {rowCategories.map((rowCat, ri) => (
          <View key={ri} style={styles.gridRow}>
            <View style={styles.headerCell}>
              <Text style={styles.headerEmoji}>{categoryEmoji(rowCat)}</Text>
              <Text style={styles.headerLabel} numberOfLines={2}>{categoryLabel(rowCat)}</Text>
            </View>
            {colCategories.map((_, ci) => {
              const idx = ri * 3 + ci;
              const status = cellStatus[idx];
              const answer = cellAnswers[idx];
              const bg =
                status === CELL_STATUS.correct ? colors.greenLight :
                status === CELL_STATUS.incorrect ? colors.redLight :
                colors.card;
              const borderColor =
                status === CELL_STATUS.correct ? colors.green :
                status === CELL_STATUS.incorrect ? colors.red :
                colors.border;
              return (
                <View key={ci} style={[styles.cell, { backgroundColor: bg, borderColor }]}>
                  <Text style={[
                    styles.lockedText,
                    { color: status === CELL_STATUS.correct ? colors.green : status === CELL_STATUS.incorrect ? colors.red : colors.textTertiary }
                  ]} numberOfLines={2}>
                    {status === CELL_STATUS.correct ? '✓ ' : status === CELL_STATUS.incorrect ? '✗ ' : '—'}
                    {answer || ''}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  }
}

const CELL_SIZE = 88;
const HEADER_SIZE = 72;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doneBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  doneBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  scrollContent: {
    padding: 12,
    alignItems: 'center',
  },
  gridWrap: {
    alignSelf: 'center',
  },
  gridRow: {
    flexDirection: 'row',
  },
  cornerCell: {
    width: HEADER_SIZE,
    height: HEADER_SIZE,
  },
  headerCell: {
    width: CELL_SIZE,
    height: HEADER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  headerEmoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 13,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 1,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  cellInput: {
    flex: 1,
    fontSize: 11,
    color: colors.textPrimary,
    textAlignVertical: 'center',
    paddingHorizontal: 4,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    marginTop: 2,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  lockedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  cellMsg: {
    fontSize: 8,
    color: colors.red,
    textAlign: 'center',
    marginTop: 1,
  },
  hint: {
    marginTop: 16,
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 16,
  },
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  doneScore: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 8,
  },
  doneLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 16,
  },
  resultGrid: {
    marginTop: 8,
  },
});
