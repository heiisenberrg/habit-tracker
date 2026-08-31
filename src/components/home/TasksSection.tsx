import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AppText from '../AppText';
import { Card, SectionHeader } from '../common';
import { TimeCircleIcon } from '../icons';
import { PlannerItem } from '../../data/seed';
import { addDays, toDateKey } from '../../store/useStore';
import { colors, radius, spacing } from '../../theme/theme';

type Props = {
  tasks: PlannerItem[];
  onToggle: (id: string) => void;
  onMove: (id: string, dateKey: string) => void;
  onDelete: (id: string) => void;
};

/** The day's planner: checkable tasks and calendar time blocks. */
function TasksSection({ tasks, onToggle, onMove, onDelete }: Props) {
  return (
    <View style={styles.section}>
      <SectionHeader title="Tasks" />
      {tasks.length === 0 && (
        <Card style={styles.emptyCard}>
          <AppText variant="alt" color={colors.ink40} center>
            Nothing planned — add a task or block time from the calendar
          </AppText>
        </Card>
      )}
      {tasks.map(t => (
        <Card key={t.id} style={styles.taskCard}>
          {t.type === 'task' ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: t.done }}
              accessibilityLabel={`Mark ${t.title} done`}
              onPress={() => onToggle(t.id)}
              style={[styles.checkbox, t.done && styles.checkboxDone]}
            >
              {t.done && (
                <AppText variant="chip" color={colors.white}>
                  ✓
                </AppText>
              )}
            </Pressable>
          ) : (
            <TimeCircleIcon size={22} />
          )}
          <View style={styles.flex}>
            <AppText
              variant="bodyMedium"
              color={t.done ? colors.ink40 : colors.ink}
              style={t.done && styles.struck}
            >
              {t.title}
            </AppText>
            <View style={styles.taskMetaRow}>
              <AppText variant="alt" color={colors.ink40}>
                {t.time || (t.type === 'task' ? 'Any time' : '')}
              </AppText>
              {t.type === 'block' && (
                <View style={styles.blockChip}>
                  <AppText variant="chip" color={colors.ink40}>
                    time block
                  </AppText>
                </View>
              )}
            </View>
          </View>
          {t.type === 'task' && !t.done && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Postpone ${t.title} one day`}
              onPress={() =>
                onMove(t.id, toDateKey(addDays(new Date(`${t.date}T00:00`), 1)))
              }
              style={styles.postponeChip}
            >
              <AppText variant="chip" color={colors.blue}>
                +1d
              </AppText>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${t.title}`}
            hitSlop={8}
            onPress={() => onDelete(t.id)}
          >
            <AppText variant="body" color={colors.ink20}>
              ✕
            </AppText>
          </Pressable>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing.xs, alignSelf: 'stretch' },
  emptyCard: { paddingVertical: spacing.md, alignSelf: 'stretch' },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.blue, borderColor: colors.blue },
  struck: { textDecorationLine: 'line-through' },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blockChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
  },
  postponeChip: {
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.blue10,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
});

export default TasksSection;
