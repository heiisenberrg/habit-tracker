import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { Card, IconButton } from '../components/common';
import { monthKeyOf } from '../services/grocery';
import { useStore } from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

/** The store registry: what shows up in the picker when you start a shop. */
function StoresScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const grocery = useStore(s => s.grocery);
  const addStore = useStore(s => s.addStore);
  const renameStore = useStore(s => s.renameStore);
  const archiveStore = useStore(s => s.archiveStore);

  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const tripCount = (storeId: string) =>
    grocery.trips.filter(t => t.storeId === storeId).length;

  const commitRename = () => {
    if (editingId) {
      renameStore(editingId, editingName);
    }
    setEditingId(null);
    setEditingName('');
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton
          size={40}
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
        >
          <AppText variant="h6">‹</AppText>
        </IconButton>
        <AppText variant="h6" style={styles.flex}>
          Stores
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a store"
            placeholderTextColor={colors.ink40}
            style={styles.input}
            returnKeyType="done"
            accessibilityLabel="Add a store"
            onSubmitEditing={() => {
              addStore(draft);
              setDraft('');
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add store"
            onPress={() => {
              addStore(draft);
              setDraft('');
            }}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <AppText variant="bodyMedium" color={colors.white}>
              Add
            </AppText>
          </Pressable>
        </View>

        {grocery.stores.map(store => (
          <Card key={store.id} style={styles.rowCard} accessible={false}>
            {editingId === store.id ? (
              <TextInput
                value={editingName}
                onChangeText={setEditingName}
                autoFocus
                onBlur={commitRename}
                onSubmitEditing={commitRename}
                style={[styles.input, styles.flex]}
                accessibilityLabel={`Rename ${store.name}`}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Rename ${store.name}`}
                style={styles.flex}
                onPress={() => {
                  setEditingId(store.id);
                  setEditingName(store.name);
                }}
              >
                <AppText
                  variant="bodyMedium"
                  color={store.archived ? colors.ink40 : colors.ink}
                >
                  {store.name}
                </AppText>
                <AppText variant="alt" color={colors.ink60}>
                  {tripCount(store.id)} shops
                  {store.archived ? ' · hidden from the picker' : ''}
                </AppText>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                store.archived
                  ? `Restore ${store.name}`
                  : `Archive ${store.name}`
              }
              onPress={() => archiveStore(store.id, !store.archived)}
              style={styles.chip}
            >
              <AppText variant="alt" color={colors.ink60}>
                {store.archived ? 'Restore' : 'Archive'}
              </AppText>
            </Pressable>
          </Card>
        ))}

        <AppText variant="alt" color={colors.ink60}>
          Archiving keeps a store on the shops you already logged
          {grocery.trips.length > 0
            ? ` (${monthKeyOf(grocery.trips[0].date)} and earlier)`
            : ''}
          , it only leaves the picker.
        </AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  body: { paddingHorizontal: screenPadding, gap: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  input: {
    flex: 1,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.ink,
  },
  addBtn: {
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  chip: {
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
});

export default StoresScreen;
