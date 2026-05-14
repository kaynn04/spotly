/**
 * SettingsScreen
 *
 * Full-page settings screen — uniform minimalist design.
 * Sections: Profile, Appearance, Data, About
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faChevronLeft,
  faUser,
  faSun,
  faMoon,
  faFileExport,
  faFileImport,
  faTrash,
  faInfoCircle,
  faChevronRight,
  faRotateRight,
} from '@fortawesome/free-solid-svg-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useToggleColorScheme } from '@/src/context/ColorSchemeContext';
import { Colors } from '@/constants/theme';
import { UserService } from '@/src/services/UserService';
import { ExportService } from '@/src/services/ExportService';
import { ImportService } from '@/src/services/ImportService';
import type { ImportMode } from '@/src/services/ImportService';
import { resetDatabase, initializeDatabase } from '@/src/db/migrations';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalkthroughService } from '@/src/features/walkthrough/services/WalkthroughService';
import { useWalkthroughContext } from '@/src/features/walkthrough/context/WalkthroughContext';

const PRIMARY = '#6b7f99';
const DANGER = '#d32f2f';

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const toggleColorScheme = useToggleColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const { registerScreenRef } = useWalkthroughContext();

  const [userName, setUserName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const appearanceToggleRef = useRef<View | null>(null);

  // Register appearance toggle ref with walkthrough context
  useEffect(() => {
    registerScreenRef('appearance-toggle', appearanceToggleRef);
  }, [registerScreenRef]);

  const handleRestartWalkthrough = async () => {
    await WalkthroughService.reset();
    router.replace('/(tabs)');
  };

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const inputBg = isDark ? '#2c2c2e' : '#f8f9fa';

  useFocusEffect(
    useCallback(() => {
      UserService.getName().then((name) => {
        setUserName(name ?? '');
        setNameInput(name ?? '');
      });
    }, [])
  );

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (trimmed.length === 0) {
      Alert.alert('Invalid Name', 'Please enter a name.');
      return;
    }
    await UserService.setName(trimmed);
    setUserName(trimmed);
    setEditingName(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await ExportService.exportInventory();
    } catch (err: any) {
      console.error('Export error:', err);
      const message = err?.message?.includes('sharing')
        ? 'Sharing is not available on this device.'
        : 'Could not export your data. Please try again.';
      Alert.alert('Export Failed', message);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = () => {
    Alert.alert(
      'Import Data',
      'How would you like to import?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge',
          onPress: () => doImport('merge'),
        },
        {
          text: 'Replace All',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Replace All Data?',
              'This will delete your current data and replace it with the imported file.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Replace', style: 'destructive', onPress: () => doImport('replace') },
              ]
            );
          },
        },
      ]
    );
  };

  const doImport = async (mode: ImportMode) => {
    setImporting(true);
    try {
      const result = await ImportService.pickAndImport(mode);
      if (!result) {
        // User cancelled picker
        return;
      }
      const parts = [
        result.spaces > 0 && `${result.spaces} spaces`,
        result.containers > 0 && `${result.containers} containers`,
        result.items > 0 && `${result.items} items`,
        result.lendings > 0 && `${result.lendings} lendings`,
      ].filter(Boolean);
      Alert.alert(
        'Import Complete',
        parts.length > 0
          ? `Successfully imported: ${parts.join(', ')}.`
          : 'No new data was imported.'
      );
    } catch (err: any) {
      console.error('Import error:', err);
      Alert.alert('Import Failed', err?.message || 'Something went wrong while importing your data.');
    } finally {
      setImporting(false);
    }
  };

  const handleResetAccount = () => {
    Alert.alert(
      'Reset Account',
      'This will permanently delete ALL your data — spaces, items, containers, lendings, and outside sessions. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Are you absolutely sure?',
              'All your inventory data will be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Reset',
                  style: 'destructive',
                  onPress: async () => {
                    setResetting(true);
                    try {
                      await resetDatabase();
                      await initializeDatabase();
                      await AsyncStorage.clear();
                      router.replace('/onboarding');
                    } catch (err) {
                      console.error('Reset error:', err);
                      Alert.alert('Error', 'Failed to reset account.');
                      setResetting(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const renderRow = (
    icon: any,
    iconColor: string,
    label: string,
    onPress: () => void,
    options?: { rightText?: string; danger?: boolean; loading?: boolean; rightElement?: React.ReactNode; ref?: React.RefObject<View> }
  ) => (
    <TouchableOpacity
      ref={options?.ref}
      style={[styles.row, { borderBottomColor: borderColor }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={options?.loading}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: isDark ? '#2c2c2e' : '#f0f1f3' }]}>
        <FontAwesomeIcon icon={icon} size={14} color={iconColor} />
      </View>
      <Text
        style={[
          styles.rowLabel,
          { color: options?.danger ? DANGER : colors.text },
        ]}
      >
        {label}
      </Text>
      {options?.loading ? (
        <ActivityIndicator size="small" color={PRIMARY} />
      ) : options?.rightElement ? (
        options.rightElement
      ) : (
        <View style={styles.rowRight}>
          {options?.rightText && (
            <Text style={[styles.rowRightText, { color: subtleText }]}>{options.rightText}</Text>
          )}
          <FontAwesomeIcon icon={faChevronRight} size={12} color={subtleText} />
        </View>
      )}
    </TouchableOpacity>
  );

  if (resetting) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#f8f9fa', paddingTop: insets.top }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={[styles.resetText, { color: subtleText }]}>Resetting account...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#f8f9fa' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <FontAwesomeIcon icon={faChevronLeft} size={16} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 16 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile ────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: subtleText }]}>PROFILE</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {editingName ? (
            <View style={[styles.editNameRow, { borderBottomColor: borderColor }]}>
              <View style={[styles.rowIconWrap, { backgroundColor: isDark ? '#2c2c2e' : '#f0f1f3' }]}>
                <FontAwesomeIcon icon={faUser} size={14} color={PRIMARY} />
              </View>
              <TextInput
                style={[styles.nameInput, { color: colors.text, backgroundColor: inputBg, borderColor }]}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Your name"
                placeholderTextColor={subtleText}
                maxLength={50}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <TouchableOpacity onPress={handleSaveName} style={[styles.saveBtn, { backgroundColor: PRIMARY }]}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setEditingName(false); setNameInput(userName); }}
                style={styles.cancelBtn}
              >
                <Text style={[styles.cancelBtnText, { color: subtleText }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            renderRow(faUser, PRIMARY, 'Display Name', () => setEditingName(true), {
              rightText: userName || 'Not set',
            })
          )}
        </View>

        {/* ── Appearance ─────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: subtleText }]}>APPEARANCE</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {renderRow(
            isDark ? faSun : faMoon,
            isDark ? '#fbbf24' : PRIMARY,
            isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
            toggleColorScheme,
            {
              ref: appearanceToggleRef,
              rightElement: (
                <View style={[styles.themeBadge, { backgroundColor: isDark ? '#2c2c2e' : '#e8eaed' }]}>
                  <FontAwesomeIcon
                    icon={isDark ? faMoon : faSun}
                    size={12}
                    color={isDark ? '#8e8e93' : '#fbbf24'}
                  />
                  <Text style={[styles.themeBadgeText, { color: subtleText }]}>
                    {isDark ? 'Dark' : 'Light'}
                  </Text>
                </View>
              ),
            }
          )}
        </View>

        {/* ── Data ───────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: subtleText }]}>DATA</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {renderRow(faFileExport, PRIMARY, 'Export Inventory', handleExport, {
            loading: exporting,
          })}
          {renderRow(faFileImport, PRIMARY, 'Import Data', handleImport, {
            loading: importing,
          })}
          {renderRow(faTrash, DANGER, 'Reset Account', handleResetAccount, {
            danger: true,
          })}
        </View>
        {/* ── App ────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: subtleText }]}>APP</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {renderRow(faRotateRight, PRIMARY, 'Restart Walkthrough', handleRestartWalkthrough)}
        </View>
        {/* ── About ──────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: subtleText }]}>ABOUT</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {renderRow(faInfoCircle, PRIMARY, 'Version', () => {}, {
            rightElement: (
              <Text style={[styles.versionText, { color: subtleText }]}>1.0.0</Text>
            ),
          })}
        </View>

        <Text style={[styles.footerText, { color: subtleText }]}>
          Made with care for organizing your things.
        </Text>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  resetText: { marginTop: 12, fontSize: 15, fontWeight: '500' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
    paddingLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowRightText: { fontSize: 14 },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '500' },
  themeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  themeBadgeText: { fontSize: 12, fontWeight: '500' },
  versionText: { fontSize: 14, fontWeight: '500' },
  footerText: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 16,
  },
});
