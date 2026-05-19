import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faBox,
  faCheck,
  faChevronLeft,
  faFolder,
  faMagnifyingGlass,
  faQrcode,
  faCamera,
} from '@fortawesome/free-solid-svg-icons';
import QRCode from 'react-native-qrcode-svg';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  LabelQrService,
  type LabelTarget,
  type LabelTargetKind,
} from '../services/LabelQrService';
import QrScannerModal from '../components/QrScannerModal';

const PRIMARY = '#6b7f99';
const QR_PURPLE = '#9b7fd4';

const FILTERS: { key: LabelTargetKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'space', label: 'Spaces' },
  { key: 'container', label: 'Containers' },
  { key: 'item', label: 'Items' },
];

function getKindIcon(kind: LabelTargetKind) {
  if (kind === 'space') return faFolder;
  if (kind === 'container') return faQrcode;
  return faBox;
}

function getKindLabel(kind: LabelTargetKind) {
  if (kind === 'space') return 'Space';
  if (kind === 'container') return 'Container';
  return 'Item';
}

export default function LabelQrGeneratorScreen() {
  const router = useRouter();
  const printableLabelRef = useRef<View>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const inputBg = isDark ? '#2c2c2e' : '#eef0f3';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  const [targets, setTargets] = useState<LabelTarget[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LabelTargetKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        setLoading(true);
        try {
          const nextTargets = await LabelQrService.getTargets();
          if (!active) return;
          setTargets(nextTargets);
          setSelectedId((current) => {
            if (current && nextTargets.some((target) => target.id === current)) return current;
            return nextTargets[0]?.id ?? null;
          });
        } catch (error) {
          console.error('[LabelQrGeneratorScreen] load error', error);
        } finally {
          if (active) setLoading(false);
        }
      };
      load();
      return () => {
        active = false;
      };
    }, [])
  );

  const filteredTargets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return targets.filter((target) => {
      const matchesFilter = filter === 'all' || target.kind === filter;
      const haystack = `${target.name} ${target.location} ${target.subtitle}`.toLowerCase();
      const matchesQuery = normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, targets]);

  const selectedTarget = useMemo(
    () => filteredTargets.find((target) => target.id === selectedId) ?? filteredTargets[0] ?? null,
    [filteredTargets, selectedId]
  );

  const payload = selectedTarget ? LabelQrService.buildPayload(selectedTarget) : '';
  const labelCode = selectedTarget ? LabelQrService.buildCode(selectedTarget) : '';

  const openSelected = () => {
    if (!selectedTarget) return;
    if (selectedTarget.kind === 'space') {
      router.push(`/space/${selectedTarget.id}` as any);
      return;
    }
    if (selectedTarget.kind === 'container') {
      router.push(`/container/${selectedTarget.id}` as any);
      return;
    }
    router.push(`/item/${selectedTarget.id}` as any);
  };

  const exportPrintableLabel = async () => {
    if (!printableLabelRef.current || !selectedTarget || exporting) return;

    setExporting(true);
    try {
      const uri = await captureRef(printableLabelRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing unavailable', 'This device cannot share or save the label right now.');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `Print ${selectedTarget.name} label`,
      });
    } catch (error) {
      console.error('[LabelQrGeneratorScreen] export error', error);
      Alert.alert('Could not create label', 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const renderTarget = (target: LabelTarget) => {
    const selected = target.id === selectedTarget?.id;
    return (
      <TouchableOpacity
        key={`${target.kind}-${target.id}`}
        style={[
          styles.targetRow,
          { backgroundColor: cardBg, borderColor: selected ? PRIMARY : borderColor },
          selected && styles.targetRowSelected,
        ]}
        onPress={() => setSelectedId(target.id)}
        activeOpacity={0.75}
      >
        <View style={[styles.targetIcon, { backgroundColor: `${QR_PURPLE}18` }]}>
          <FontAwesomeIcon icon={getKindIcon(target.kind)} size={16} color={QR_PURPLE} />
        </View>
        <View style={styles.targetBody}>
          <Text style={[styles.targetName, { color: colors.text }]} numberOfLines={1}>
            {target.name}
          </Text>
          <Text style={[styles.targetMeta, { color: subtleText }]} numberOfLines={1}>
            {getKindLabel(target.kind)} - {target.location}
          </Text>
        </View>
        {selected && (
          <View style={[styles.selectedBadge, { backgroundColor: PRIMARY }]}>
            <FontAwesomeIcon icon={faCheck} size={10} color="#ffffff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <FontAwesomeIcon icon={faChevronLeft} size={16} color={PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Label & QR Generator</Text>
          <Text style={[styles.headerSubtitle, { color: subtleText }]}>Create scannable Synop labels</Text>
        </View>
        <TouchableOpacity style={styles.scanButton} onPress={() => setShowScanner(true)} activeOpacity={0.7}>
          <FontAwesomeIcon icon={faCamera} size={16} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={QR_PURPLE} />
        </View>
      ) : targets.length === 0 ? (
        <View style={styles.centered}>
          <FontAwesomeIcon icon={faQrcode} size={52} color={borderColor} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing to label yet</Text>
          <Text style={[styles.emptyText, { color: subtleText }]}>
            Add a space, container, or item first, then come back to generate its label.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {selectedTarget && (
            <View style={[styles.previewCard, { backgroundColor: cardBg, borderColor }]}>
              <View ref={printableLabelRef} collapsable={false} style={styles.printableLabel}>
                <View style={styles.previewHeader}>
                  <View style={styles.previewTitleWrap}>
                    <Text style={[styles.previewEyebrow, { color: QR_PURPLE }]}>
                      {getKindLabel(selectedTarget.kind)} label
                    </Text>
                    <Text style={styles.printName} numberOfLines={2}>
                      {selectedTarget.name}
                    </Text>
                    <Text style={styles.printLocation} numberOfLines={1}>
                      {selectedTarget.location}
                    </Text>
                  </View>
                  <View style={[styles.kindPill, { backgroundColor: `${QR_PURPLE}18` }]}>
                    <Text style={[styles.kindPillText, { color: QR_PURPLE }]}>
                      {getKindLabel(selectedTarget.kind)}
                    </Text>
                  </View>
                </View>

                <View style={styles.qrWrap}>
                  <QRCode
                    value={payload}
                    size={168}
                    color="#11181c"
                    backgroundColor="#ffffff"
                  />
                </View>

                <View style={styles.printCodeBlock}>
                  <Text style={styles.printCodeText}>{labelCode}</Text>
                </View>
              </View>

              {selectedTarget.countLabel && (
                <Text style={[styles.liveCountText, { color: subtleText }]}>
                  Current contents: {selectedTarget.countLabel}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.exportButton, { borderColor: PRIMARY }]}
                onPress={exportPrintableLabel}
                activeOpacity={0.8}
                disabled={exporting}
              >
                <Text style={[styles.exportButtonText, { color: PRIMARY }]}>
                  {exporting ? 'Preparing label...' : 'Download printable label'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.openButton, { backgroundColor: PRIMARY }]}
                onPress={openSelected}
                activeOpacity={0.8}
              >
                <Text style={styles.openButtonText}>Open {getKindLabel(selectedTarget.kind)}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.controls}>
            <View style={[styles.searchBox, { backgroundColor: inputBg }]}>
              <FontAwesomeIcon icon={faMagnifyingGlass} size={14} color={subtleText} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search labels"
                placeholderTextColor={subtleText}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map((option) => {
                const active = filter === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.filterChip,
                      { backgroundColor: active ? PRIMARY : cardBg, borderColor },
                    ]}
                    onPress={() => setFilter(option.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.filterText, { color: active ? '#ffffff' : colors.text }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.listSection}>
            <Text style={[styles.sectionLabel, { color: subtleText }]}>Label targets</Text>
            {filteredTargets.length === 0 ? (
              <View style={[styles.noResults, { borderColor }]}>
                <Text style={[styles.noResultsText, { color: subtleText }]}>No matching labels</Text>
              </View>
            ) : (
              filteredTargets.map(renderTarget)
            )}
          </View>
        </ScrollView>
      )}

      <QrScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  scanButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 32, gap: 18 },
  previewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  printableLabel: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    gap: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewTitleWrap: { flex: 1 },
  previewEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  previewName: { fontSize: 24, fontWeight: '700', marginTop: 2 },
  previewLocation: { fontSize: 13, marginTop: 3 },
  printName: { color: '#11181c', fontSize: 24, fontWeight: '700', marginTop: 2 },
  printLocation: { color: '#687076', fontSize: 13, marginTop: 3 },
  kindPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  kindPillText: { fontSize: 12, fontWeight: '700' },
  qrWrap: {
    alignSelf: 'center',
    padding: 16,
    borderRadius: 14,
  },
  codeBlock: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  codeText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  codeMeta: { fontSize: 12, marginTop: 2 },
  printCodeBlock: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#eef0f3',
  },
  printCodeText: { color: '#11181c', fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  liveCountText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -4,
  },
  exportButton: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonText: { fontSize: 15, fontWeight: '700' },
  openButton: {
    borderRadius: 12,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  controls: { gap: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  filterRow: { gap: 8, paddingRight: 16 },
  filterChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  filterText: { fontSize: 13, fontWeight: '700' },
  listSection: { gap: 10 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  targetRowSelected: { borderWidth: 1.5 },
  targetIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetBody: { flex: 1 },
  targetName: { fontSize: 15, fontWeight: '700' },
  targetMeta: { fontSize: 12, marginTop: 2 },
  selectedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResults: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  noResultsText: { fontSize: 14, fontWeight: '600' },
});
