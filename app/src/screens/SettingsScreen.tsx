/**
 * SettingsScreen
 *
 * Full-page settings screen — uniform minimalist design.
 * Sections: Profile, Appearance, Data, About
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
  Pressable,
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
  faBookOpen,
  faLayerGroup,
} from '@fortawesome/free-solid-svg-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
import { SpaceService } from '@/src/services/SpaceService';
import { ContainerService } from '@/src/services/ContainerService';

const PRIMARY = '#6b7f99';
const DANGER = '#d32f2f';

interface StarterTemplate {
  id: string;
  title: string;
  description: string;
  spaces: {
    name: string;
    containers: string[];
  }[];
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'home',
    title: 'Home Inventory',
    description: 'A balanced setup for rooms, documents, tools, and everyday storage.',
    spaces: [
      { name: 'Living Room', containers: ['Cabinet', 'Media Shelf'] },
      { name: 'Bedroom', containers: ['Drawer', 'Closet'] },
      { name: 'Kitchen', containers: ['Pantry', 'Utility Drawer'] },
      { name: 'Documents', containers: ['IDs', 'Receipts', 'Warranty Papers'] },
    ],
  },
  {
    id: 'apartment',
    title: 'Dorm / Apartment',
    description: 'Simple spaces for compact living and shared storage.',
    spaces: [
      { name: 'Desk', containers: ['Documents Tray', 'Cables'] },
      { name: 'Closet', containers: ['Top Shelf', 'Travel Bag'] },
      { name: 'Shared Kitchen', containers: ['Food Bin', 'Cookware'] },
    ],
  },
  {
    id: 'office',
    title: 'Office Storage',
    description: 'Track office supplies, equipment, and documents.',
    spaces: [
      { name: 'Office', containers: ['Desk Drawer', 'Filing Cabinet'] },
      { name: 'Storage Room', containers: ['Supplies Box', 'Tech Equipment'] },
      { name: 'Meeting Area', containers: ['Presentation Kit'] },
    ],
  },
  {
    id: 'travel',
    title: 'Travel Essentials',
    description: 'Prepare common travel groups for bags, documents, and gadgets.',
    spaces: [
      { name: 'Travel Bag', containers: ['Documents', 'Chargers', 'Toiletries'] },
      { name: 'Carry-on', containers: ['Medicine Pouch', 'Gadget Pouch'] },
    ],
  },
  {
    id: 'tools',
    title: 'Tools & Equipment',
    description: 'Organize tools, spare parts, manuals, and safety gear.',
    spaces: [
      { name: 'Garage', containers: ['Toolbox', 'Power Tools', 'Spare Parts'] },
      { name: 'Shed', containers: ['Garden Tools', 'Safety Gear'] },
    ],
  },
  {
    id: 'family',
    title: 'Family Home',
    description: 'Separate shared household storage, kids items, medicine, and school supplies.',
    spaces: [
      { name: 'Entryway', containers: ['Keys Tray', 'Shoe Rack', 'Go Bag'] },
      { name: 'Kids Room', containers: ['School Supplies', 'Toys Bin', 'Clothes Drawer'] },
      { name: 'Medicine Cabinet', containers: ['First Aid', 'Daily Medicine', 'Thermometers'] },
      { name: 'Laundry Area', containers: ['Cleaning Supplies', 'Spare Linens'] },
    ],
  },
  {
    id: 'electronics',
    title: 'Electronics & Gadgets',
    description: 'Track devices, cables, accessories, warranties, and manuals.',
    spaces: [
      { name: 'Tech Shelf', containers: ['Phones & Tablets', 'Adapters', 'Manuals'] },
      { name: 'Computer Desk', containers: ['Peripherals', 'Storage Drives', 'Cables'] },
      { name: 'Camera Kit', containers: ['Batteries', 'Memory Cards', 'Lenses'] },
    ],
  },
  {
    id: 'kitchen',
    title: 'Kitchen & Pantry',
    description: 'Structure pantry goods, cookware, appliances, and party supplies.',
    spaces: [
      { name: 'Pantry', containers: ['Canned Goods', 'Baking Supplies', 'Snacks'] },
      { name: 'Kitchen Cabinets', containers: ['Cookware', 'Food Containers', 'Small Appliances'] },
      { name: 'Dining Storage', containers: ['Serveware', 'Party Supplies'] },
    ],
  },
  {
    id: 'hobby',
    title: 'Hobbies & Crafts',
    description: 'Group creative supplies, sports gear, collectibles, and project materials.',
    spaces: [
      { name: 'Craft Station', containers: ['Paints', 'Paper', 'Tools'] },
      { name: 'Sports Gear', containers: ['Outdoor Gear', 'Protective Gear', 'Accessories'] },
      { name: 'Collections', containers: ['Display Items', 'Storage Boxes'] },
    ],
  },
  {
    id: 'emergency',
    title: 'Emergency Preparedness',
    description: 'Create a quick structure for safety kits, documents, and backup supplies.',
    spaces: [
      { name: 'Emergency Kit', containers: ['First Aid', 'Flashlights', 'Batteries'] },
      { name: 'Important Documents', containers: ['IDs', 'Insurance', 'Medical Records'] },
      { name: 'Backup Supplies', containers: ['Water', 'Food', 'Power Bank'] },
    ],
  },
  {
    id: 'moving',
    title: 'Moving Boxes',
    description: 'Prepare spaces and box groups for packing, moving, or storage units.',
    spaces: [
      { name: 'Packed Boxes', containers: ['Kitchen Box', 'Bedroom Box', 'Bathroom Box'] },
      { name: 'Fragile Items', containers: ['Glassware', 'Electronics', 'Decor'] },
      { name: 'Storage Unit', containers: ['Seasonal Box', 'Archive Box', 'Tools Box'] },
    ],
  },
];

const GUIDE_TOPICS = [
  {
    title: 'Start with places',
    body: 'Create a space first, like Bedroom, Garage, Office, or Travel Bag. Add containers only when they help, like Drawer, Toolbox, or Documents.',
  },
  {
    title: 'Add items with useful details',
    body: 'Name the item, set quantity, add a photo if helpful, and use description for notes like size, color, serial number, or where it fits.',
  },
  {
    title: 'Use the scanner to skip searching',
    body: 'Generate QR labels for spaces, containers, or items. Product barcodes can remember item details after the first scan.',
  },
  {
    title: 'Track borrowed quantity',
    body: 'When lending, choose how many units leave your inventory. When they come back, Synop adds the quantity back automatically.',
  },
  {
    title: 'Use outside sessions for trips',
    body: 'Before leaving, choose the items you are bringing. When you return, check them off, mark missing items, or move items to a new location.',
  },
  {
    title: 'Back up when you make progress',
    body: 'Export a backup after big organizing sessions. Import later by merging with current data or replacing it when you need a clean restore.',
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ openTemplates?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const toggleColorScheme = useToggleColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const [userName, setUserName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateLoadingId, setTemplateLoadingId] = useState<string | null>(null);

  const handleRestartWalkthrough = async () => {
    await WalkthroughService.reset();
    router.replace('/(tabs)');
  };

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const inputBg = isDark ? '#2c2c2e' : '#f8f9fa';

  const buildAvailableName = (baseName: string, existingNames: Set<string>) => {
    let candidate = baseName;
    let suffix = 2;
    while (existingNames.has(candidate.toLowerCase())) {
      candidate = `${baseName} ${suffix}`;
      suffix += 1;
    }
    existingNames.add(candidate.toLowerCase());
    return candidate;
  };

  useFocusEffect(
    useCallback(() => {
      UserService.getName().then((name) => {
        setUserName(name ?? '');
        setNameInput(name ?? '');
      });
    }, [])
  );

  useEffect(() => {
    if (params.openTemplates === '1') setShowTemplates(true);
  }, [params.openTemplates]);

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

  const handleApplyTemplate = async (template: StarterTemplate) => {
    setTemplateLoadingId(template.id);
    try {
      const [existingSpaces, existingContainers] = await Promise.all([
        SpaceService.getAllSpaces(),
        ContainerService.getAllContainers(),
      ]);
      const spaceNames = new Set(existingSpaces.map((space) => space.name.toLowerCase()));
      const containerNames = new Set(existingContainers.map((container) => container.name.toLowerCase()));
      let createdSpaces = 0;
      let createdContainers = 0;

      for (const templateSpace of template.spaces) {
        const spaceName = buildAvailableName(templateSpace.name, spaceNames);
        const createdSpace = await SpaceService.createSpace(spaceName);
        createdSpaces += 1;

        for (const templateContainer of templateSpace.containers) {
          const containerName = buildAvailableName(templateContainer, containerNames);
          await ContainerService.createContainer(containerName, createdSpace.id);
          createdContainers += 1;
        }
      }

      setShowTemplates(false);
      Alert.alert(
        'Template Added',
        `Added ${createdSpaces} space${createdSpaces === 1 ? '' : 's'} and ${createdContainers} container${createdContainers === 1 ? '' : 's'}.`,
        [
          {
            text: 'View Dashboard',
            onPress: () => router.replace('/(tabs)' as any),
          },
        ]
      );
    } catch (err: any) {
      console.error('Template error:', err);
      Alert.alert('Template Failed', err?.message || 'Could not add this template. Please try again.');
    } finally {
      setTemplateLoadingId(null);
    }
  };

  const renderRow = (
    icon: any,
    iconColor: string,
    label: string,
    onPress: () => void,
    options?: { rightText?: string; danger?: boolean; loading?: boolean; rightElement?: React.ReactNode }
  ) => (
    <TouchableOpacity
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
        <Text style={[styles.sectionLabel, { color: subtleText }]}>HELP & SETUP</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {renderRow(faBookOpen, PRIMARY, 'Guide', () => setShowGuide(true))}
          {renderRow(faLayerGroup, PRIMARY, 'Starter Templates', () => setShowTemplates(true), {
            loading: templateLoadingId !== null,
          })}
        </View>
        <Text style={[styles.sectionLabel, { color: subtleText }]}>APP</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {renderRow(faRotateRight, PRIMARY, 'Restart Walkthrough', handleRestartWalkthrough)}
        </View>
        {/* ── About ──────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: subtleText }]}>ABOUT</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {renderRow(faInfoCircle, PRIMARY, 'Version', () => {}, {
            rightElement: (
              <Text style={[styles.versionText, { color: subtleText }]}>1.0.1</Text>
            ),
          })}
        </View>

        <Text style={[styles.footerText, { color: subtleText }]}>
          Made with care for organizing your things.
        </Text>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>

      <Modal visible={showGuide} transparent animationType="slide" onRequestClose={() => setShowGuide(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowGuide(false)} />
          <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Guide</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
              {GUIDE_TOPICS.map((topic) => (
                <View key={topic.title} style={[styles.guideTopic, { borderColor }]}>
                  <Text style={[styles.guideTitle, { color: colors.text }]}>{topic.title}</Text>
                  <Text style={[styles.guideBody, { color: subtleText }]}>{topic.body}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showTemplates} transparent animationType="slide" onRequestClose={() => setShowTemplates(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowTemplates(false)} />
          <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Starter Templates</Text>
            <Text style={[styles.sheetSubtitle, { color: subtleText }]}>
              Add ready-made spaces and containers without replacing your current data.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
              {STARTER_TEMPLATES.map((template) => {
                const spaceCount = template.spaces.length;
                const containerCount = template.spaces.reduce((sum, space) => sum + space.containers.length, 0);
                const isLoading = templateLoadingId === template.id;
                return (
                  <View key={template.id} style={[styles.templateCard, { borderColor, backgroundColor: inputBg }]}>
                    <View style={styles.templateHeader}>
                      <View style={styles.templateCopy}>
                        <Text style={[styles.templateTitle, { color: colors.text }]}>{template.title}</Text>
                        <Text style={[styles.templateDescription, { color: subtleText }]}>{template.description}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.templateButton, { backgroundColor: PRIMARY, opacity: templateLoadingId && !isLoading ? 0.5 : 1 }]}
                        onPress={() => handleApplyTemplate(template)}
                        disabled={templateLoadingId !== null}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.templateButtonText}>Add</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.templateMeta, { color: subtleText }]}>
                      {spaceCount} space{spaceCount === 1 ? '' : 's'} · {containerCount} container{containerCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '82%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  sheetSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  sheetScroll: {
    paddingBottom: 8,
  },
  guideTopic: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 5,
  },
  guideBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  templateCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  templateHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  templateCopy: {
    flex: 1,
    minWidth: 0,
  },
  templateTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  templateButton: {
    minWidth: 62,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  templateMeta: {
    fontSize: 12,
    marginTop: 10,
    fontWeight: '600',
  },
});
