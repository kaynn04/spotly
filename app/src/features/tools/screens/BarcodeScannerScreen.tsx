import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faBarcode,
  faBox,
  faCheck,
  faChevronLeft,
  faCircleInfo,
  faFolder,
  faMagnifyingGlass,
  faMinus,
  faPlus,
  faShield,
} from '@fortawesome/free-solid-svg-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import {
  BarcodeScannerService,
  type BarcodeMatch,
  type BarcodeDestination,
  type ScannedBarcode,
} from '../services/BarcodeScannerService';
import ItemFormModal from '@/src/features/spaces/screens/components/ItemFormModal';
import { ItemService } from '@/src/services/ItemService';
import { PhotoService } from '@/src/services/PhotoService';
import { ItemRepository } from '@/src/repositories/ItemRepository';
import { formatDateOnly, parseDateOnly, startOfLocalDay } from '@/src/utils/dateOnly';

const PRIMARY = '#6b7f99';
const BARCODE_ORANGE = '#e07b54';
const DESTINATION_FILTERS: { key: BarcodeDestination['kind'] | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'space', label: 'Spaces' },
  { key: 'container', label: 'Containers' },
];

export default function BarcodeScannerScreen() {
  const router = useRouter();
  const { barcodeType, barcodeData } = useLocalSearchParams<{ barcodeType?: string; barcodeData?: string }>();
  const handledRouteBarcodeRef = useRef<string | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const inputBg = isDark ? '#2c2c2e' : '#eef0f3';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  const [destinations, setDestinations] = useState<BarcodeDestination[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationFilter, setDestinationFilter] = useState<BarcodeDestination['kind'] | 'all'>('all');
  const [spaceFilter, setSpaceFilter] = useState<string | 'all'>('all');
  const [scannedBarcode, setScannedBarcode] = useState<ScannedBarcode | null>(null);
  const [matchedItem, setMatchedItem] = useState<BarcodeMatch | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolvingScan, setResolvingScan] = useState(false);
  const [updatingQuantity, setUpdatingQuantity] = useState(false);
  const [quantityDraft, setQuantityDraft] = useState('');
  const [choosingMoveLocation, setChoosingMoveLocation] = useState(false);
  const [movingLocation, setMovingLocation] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        setLoading(true);
        try {
          const nextDestinations = await BarcodeScannerService.getDestinations();
          if (!active) return;
          setDestinations(nextDestinations);
          setSelectedKey((current) => {
            if (current && nextDestinations.some((destination) => destination.key === current)) return current;
            return null;
          });
        } catch (error) {
          console.error('[BarcodeScannerScreen] load error', error);
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

  const selectedDestination = useMemo(
    () => destinations.find((destination) => destination.key === selectedKey) ?? null,
    [destinations, selectedKey]
  );

  const spaceOptions = useMemo(() => {
    const byId = new Map<string, string>();
    destinations.forEach((destination) => {
      if (destination.kind === 'space') byId.set(destination.spaceId, destination.name);
      if (destination.kind === 'container') byId.set(destination.spaceId, destination.subtitle.replace(/^Container in\s+/i, ''));
    });
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [destinations]);

  const showSpaceFilter = destinationFilter === 'container';

  const filteredDestinations = useMemo(() => {
    const normalizedQuery = destinationQuery.trim().toLowerCase();
    return destinations.filter((destination) => {
      const matchesFilter = destinationFilter === 'all' || destination.kind === destinationFilter;
      const matchesSpace = !showSpaceFilter || spaceFilter === 'all' || destination.spaceId === spaceFilter;
      const haystack = `${destination.name} ${destination.subtitle}`.toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesFilter && matchesSpace && matchesQuery;
    });
  }, [destinationFilter, destinationQuery, destinations, showSpaceFilter, spaceFilter]);

  const initialName = '';
  const initialDescription = '';

  const getWarrantyStatus = (expiryStr: string) => {
    const today = startOfLocalDay(new Date());
    const expiry = parseDateOnly(expiryStr);
    const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
    if (days < 0) return { label: 'Warranty expired', color: '#e53e3e' };
    if (days <= 30) return { label: 'Warranty expiring soon', color: '#e09b3a' };
    return { label: 'Warranty active', color: '#6b9e7a' };
  };

  const handleQuantityChange = async (delta: number) => {
    if (!matchedItem || updatingQuantity) return;

    const currentQuantity = Math.max(1, parseInt(quantityDraft, 10) || matchedItem.quantity);
    const nextQuantity = Math.max(1, currentQuantity + delta);
    if (nextQuantity === matchedItem.quantity) return;

    setUpdatingQuantity(true);
    try {
      await ItemService.updateItem(matchedItem.id, { quantity: nextQuantity });
      setMatchedItem((current) => current ? { ...current, quantity: nextQuantity } : current);
      setQuantityDraft(String(nextQuantity));
      DeviceEventEmitter.emit('synop:refresh-home');
    } catch (error) {
      console.error('[BarcodeScannerScreen] quantity update error', error);
      Alert.alert('Could not update quantity', 'Please try again.');
    } finally {
      setUpdatingQuantity(false);
    }
  };

  const handleQuantitySubmit = async () => {
    if (!matchedItem || updatingQuantity) return;

    const nextQuantity = Math.max(1, parseInt(quantityDraft, 10) || 1);
    setQuantityDraft(String(nextQuantity));
    if (nextQuantity === matchedItem.quantity) return;

    setUpdatingQuantity(true);
    try {
      await ItemService.updateItem(matchedItem.id, { quantity: nextQuantity });
      setMatchedItem((current) => current ? { ...current, quantity: nextQuantity } : current);
      DeviceEventEmitter.emit('synop:refresh-home');
    } catch (error) {
      console.error('[BarcodeScannerScreen] quantity update error', error);
      setQuantityDraft(String(matchedItem.quantity));
      Alert.alert('Could not update quantity', 'Please try again.');
    } finally {
      setUpdatingQuantity(false);
    }
  };

  const handleMoveMatchedItem = async (destination: BarcodeDestination) => {
    if (!matchedItem || movingLocation) return;

    const isSameLocation =
      matchedItem.spaceId === destination.spaceId &&
      (matchedItem.containerId ?? null) === (destination.containerId ?? null);

    if (isSameLocation) {
      setChoosingMoveLocation(false);
      return;
    }

    setMovingLocation(true);
    try {
      await ItemService.moveItemToContainer(matchedItem.id, destination.spaceId, destination.containerId ?? '');
      setMatchedItem((current) => current ? {
        ...current,
        spaceId: destination.spaceId,
        containerId: destination.containerId,
        spaceName: destination.kind === 'space' ? destination.name : destination.subtitle.replace('Container in ', ''),
        containerName: destination.kind === 'container' ? destination.name : null,
      } : current);
      setChoosingMoveLocation(false);
      DeviceEventEmitter.emit('synop:refresh-home');
    } catch (error) {
      console.error('[BarcodeScannerScreen] move location error', error);
      Alert.alert('Could not move item', 'Please try again.');
    } finally {
      setMovingLocation(false);
    }
  };

  const handleScanned = async (barcode: ScannedBarcode) => {
    setShowScanner(false);
    setScannedBarcode(barcode);
    setMatchedItem(null);
    setChoosingMoveLocation(false);
    setResolvingScan(true);

    try {
      const match = await BarcodeScannerService.findItemByBarcode(barcode);
      setMatchedItem(match);
      setQuantityDraft(match ? String(match.quantity) : '');
      if (!match && selectedDestination) setShowItemForm(true);
    } catch (error) {
      console.error('[BarcodeScannerScreen] barcode lookup error', error);
      Alert.alert('Scan saved', 'Barcode captured, but Synop could not check existing items. You can still add it now.');
    } finally {
      setResolvingScan(false);
    }
  };

  useEffect(() => {
    if (loading || !barcodeData) return;

    const routeBarcode = {
      type: barcodeType ?? 'unknown',
      data: barcodeData,
    };
    const routeBarcodeKey = `${routeBarcode.type}:${routeBarcode.data}`;
    if (handledRouteBarcodeRef.current === routeBarcodeKey) return;

    handledRouteBarcodeRef.current = routeBarcodeKey;
    handleScanned(routeBarcode);
    // handleScanned intentionally stays local to this screen's state machine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcodeData, barcodeType, loading]);

  const handleSubmit = async (
    name: string,
    description?: string,
    quantity?: number,
    photoUri?: string | null,
    warrantyExpiry?: Date | null,
    barcode?: ScannedBarcode | null
  ) => {
    if (!selectedDestination) {
      Alert.alert('Choose a destination', 'Select a space or container before creating the item.');
      return;
    }

    const item = await ItemService.createItem(
      selectedDestination.spaceId,
      name,
      selectedDestination.containerId,
      description,
      quantity
    );

    const barcodeToSave = barcode ?? scannedBarcode;
    if (barcodeToSave) {
      await BarcodeScannerService.linkItemToBarcode(item.id, barcodeToSave);
    }

    if (photoUri) {
      const savedUri = await PhotoService.savePhoto(photoUri, item.id);
      await ItemRepository.updatePhotoUri(item.id, savedUri);
    }

    if (warrantyExpiry) {
      await ItemService.updateWarranty(item.id, warrantyExpiry, selectedDestination.name);
    }

    DeviceEventEmitter.emit('synop:refresh-home');
    setShowItemForm(false);
    setMatchedItem({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      quantity: item.quantity,
      photoUri: item.photoUri ?? null,
      warrantyExpiry: warrantyExpiry ? formatDateOnly(warrantyExpiry) : null,
      spaceId: selectedDestination.spaceId,
      containerId: selectedDestination.containerId,
      spaceName: selectedDestination.kind === 'space' ? selectedDestination.name : selectedDestination.subtitle.replace('Container in ', ''),
      containerName: selectedDestination.kind === 'container' ? selectedDestination.name : null,
      barcodeType: barcodeToSave?.type ?? null,
      barcodeData: barcodeToSave?.data ?? '',
    });
    setQuantityDraft(String(item.quantity));
    router.push(`/item/${item.id}` as any);
  };

  const renderDestination = (destination: BarcodeDestination) => {
    const isMatchedCurrentLocation =
      choosingMoveLocation &&
      matchedItem?.spaceId === destination.spaceId &&
      (matchedItem.containerId ?? null) === (destination.containerId ?? null);
    const selected = destination.key === selectedDestination?.key || isMatchedCurrentLocation;
    return (
      <TouchableOpacity
        key={destination.key}
        style={[
          styles.destinationRow,
          { backgroundColor: cardBg, borderColor: selected ? BARCODE_ORANGE : borderColor },
          selected && styles.destinationRowSelected,
        ]}
        onPress={() => {
          if (matchedItem && choosingMoveLocation) {
            handleMoveMatchedItem(destination);
            return;
          }
          setSelectedKey(destination.key);
          if (scannedBarcode && !matchedItem) setShowItemForm(true);
        }}
        activeOpacity={0.75}
      >
        <View style={[styles.destinationIcon, { backgroundColor: `${BARCODE_ORANGE}18` }]}>
          <FontAwesomeIcon icon={destination.kind === 'space' ? faFolder : faBox} size={16} color={BARCODE_ORANGE} />
        </View>
        <View style={styles.destinationBody}>
          <Text style={[styles.destinationName, { color: colors.text }]} numberOfLines={1}>
            {destination.name}
          </Text>
          <Text style={[styles.destinationMeta, { color: subtleText }]} numberOfLines={1}>
            {destination.kind === 'container'
              ? destination.subtitle.replace(/^Container in\s+/i, '')
              : 'Space'}
          </Text>
        </View>
        {selected && (
          <View style={[styles.selectedBadge, { backgroundColor: BARCODE_ORANGE }]}>
            <FontAwesomeIcon icon={faCheck} size={10} color="#ffffff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderDestinationPicker = (label: string) => (
    <View style={styles.pickerBlock}>
      <View style={styles.controls}>
        <View style={[styles.searchBox, { backgroundColor: inputBg }]}>
          <FontAwesomeIcon icon={faMagnifyingGlass} size={14} color={subtleText} />
          <TextInput
            value={destinationQuery}
            onChangeText={setDestinationQuery}
            placeholder="Search spaces or containers"
            placeholderTextColor={subtleText}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {DESTINATION_FILTERS.map((option) => {
            const active = destinationFilter === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.filterChip,
                  { backgroundColor: active ? BARCODE_ORANGE : cardBg, borderColor },
                ]}
                onPress={() => {
                  setDestinationFilter(option.key);
                  if (option.key !== 'container') setSpaceFilter('all');
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterText, { color: active ? '#ffffff' : colors.text }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {showSpaceFilter && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {[{ id: 'all', name: 'All Spaces' }, ...spaceOptions].map((option) => {
              const active = spaceFilter === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.filterChip,
                    { backgroundColor: active ? BARCODE_ORANGE : cardBg, borderColor },
                  ]}
                  onPress={() => setSpaceFilter(option.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterText, { color: active ? '#ffffff' : colors.text }]}>
                    {option.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={styles.listSection}>
        <Text style={[styles.sectionLabel, { color: subtleText }]}>{label}</Text>
        <View style={styles.destinationList}>
          {movingLocation && (
            <View style={[styles.statusRow, { backgroundColor: inputBg, borderColor }]}>
              <ActivityIndicator color={BARCODE_ORANGE} size="small" />
              <Text style={[styles.statusText, { color: subtleText }]}>Moving item...</Text>
            </View>
          )}
          {filteredDestinations.length === 0 ? (
            <View style={[styles.noResults, { borderColor }]}>
              <Text style={[styles.noResultsText, { color: subtleText }]}>No matching locations</Text>
            </View>
          ) : (
            filteredDestinations.map(renderDestination)
          )}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Back"
          >
            <FontAwesomeIcon icon={faChevronLeft} size={16} color={BARCODE_ORANGE} />
          </TouchableOpacity>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: colors.text }]}>Barcode Scanner</Text>
            <Text style={[styles.subtitle, { color: subtleText }]}>Scan and add product-coded items</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={BARCODE_ORANGE} />
        </View>
      ) : destinations.length === 0 ? (
        <View style={styles.centered}>
          <FontAwesomeIcon icon={faBarcode} size={52} color={borderColor} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No destination yet</Text>
          <Text style={[styles.emptyText, { color: subtleText }]}>
            Create a space first, then scan barcodes into your inventory.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.scanCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={[styles.scanIcon, { backgroundColor: `${BARCODE_ORANGE}18` }]}>
              <FontAwesomeIcon icon={faBarcode} size={28} color={BARCODE_ORANGE} />
            </View>
            <Text style={[styles.scanTitle, { color: colors.text }]}>
              {matchedItem ? 'Item found' : scannedBarcode ? 'Barcode captured' : 'Scan a product barcode'}
            </Text>
            <Text style={[styles.scanSubtitle, { color: subtleText }]}>
              {matchedItem
                ? 'Synop recognized this barcode from your inventory.'
                : scannedBarcode
                ? `${scannedBarcode.type} - ${scannedBarcode.data}`
                : 'First scan saves the item details. Future scans bring those details back instantly.'}
            </Text>
            <TouchableOpacity
              style={[styles.scanButton, { backgroundColor: BARCODE_ORANGE }]}
              onPress={() => setShowScanner(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.scanButtonText}>{scannedBarcode ? 'Scan Again' : 'Start Scan'}</Text>
            </TouchableOpacity>
          </View>

          {resolvingScan && (
            <View style={[styles.statusRow, { backgroundColor: inputBg, borderColor }]}>
              <ActivityIndicator color={BARCODE_ORANGE} size="small" />
              <Text style={[styles.statusText, { color: subtleText }]}>Checking your saved items...</Text>
            </View>
          )}

          {matchedItem ? (
            <View style={[styles.matchCard, { backgroundColor: cardBg, borderColor }]}>
              <View style={styles.matchHeader}>
                <View style={[styles.matchIcon, { backgroundColor: `${PRIMARY}18` }]}>
                  <FontAwesomeIcon icon={faCircleInfo} size={18} color={PRIMARY} />
                </View>
                <View style={styles.matchBody}>
                  <Text style={[styles.matchName, { color: colors.text }]} numberOfLines={2}>
                    {matchedItem.name}
                  </Text>
                  <Text style={[styles.matchLocation, { color: subtleText }]} numberOfLines={1}>
                    {matchedItem.containerName
                      ? `${matchedItem.containerName} in ${matchedItem.spaceName}`
                      : matchedItem.spaceName}
                  </Text>
                </View>
              </View>
              {!!matchedItem.description && (
                <Text style={[styles.matchDescription, { color: subtleText }]} numberOfLines={3}>
                  {matchedItem.description}
                </Text>
              )}
              <View style={styles.factGrid}>
                <View style={[styles.factTile, { backgroundColor: inputBg, borderColor }]}>
                  <Text style={[styles.factLabel, { color: subtleText }]}>Quantity</Text>
                  <View style={styles.quantityControl}>
                    <TouchableOpacity
                      style={[styles.quantityButton, { borderColor }]}
                      onPress={() => handleQuantityChange(-1)}
                      disabled={updatingQuantity || matchedItem.quantity <= 1}
                      activeOpacity={0.75}
                    >
                      <FontAwesomeIcon icon={faMinus} size={12} color={matchedItem.quantity <= 1 ? subtleText : PRIMARY} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.quantityInput, { color: colors.text }]}
                      value={quantityDraft}
                      onChangeText={(value) => setQuantityDraft(value.replace(/[^0-9]/g, ''))}
                      onBlur={handleQuantitySubmit}
                      onSubmitEditing={handleQuantitySubmit}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      maxLength={4}
                      editable={!updatingQuantity}
                      selectTextOnFocus
                    />
                    <TouchableOpacity
                      style={[styles.quantityButton, { borderColor }]}
                      onPress={() => handleQuantityChange(1)}
                      disabled={updatingQuantity}
                      activeOpacity={0.75}
                    >
                      <FontAwesomeIcon icon={faPlus} size={12} color={PRIMARY} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.factTile, { backgroundColor: inputBg, borderColor }]}>
                  <Text style={[styles.factLabel, { color: subtleText }]}>Warranty</Text>
                  {matchedItem.warrantyExpiry ? (
                    <View style={styles.warrantyRow}>
                      <FontAwesomeIcon
                        icon={faShield}
                        size={14}
                        color={getWarrantyStatus(matchedItem.warrantyExpiry).color}
                      />
                      <View style={styles.warrantyTextWrap}>
                        <Text
                          style={[styles.warrantyStatus, { color: getWarrantyStatus(matchedItem.warrantyExpiry).color }]}
                          numberOfLines={1}
                        >
                          {getWarrantyStatus(matchedItem.warrantyExpiry).label}
                        </Text>
                        <Text style={[styles.warrantyDate, { color: subtleText }]} numberOfLines={1}>
                          {parseDateOnly(matchedItem.warrantyExpiry).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={[styles.emptyFactText, { color: subtleText }]}>Not set</Text>
                  )}
                </View>
              </View>
              <View style={styles.matchActions}>
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor }]}
                  onPress={() => setChoosingMoveLocation((current) => !current)}
                  activeOpacity={0.8}
                  disabled={movingLocation}
                >
                  <Text style={[styles.secondaryButtonText, { color: PRIMARY }]}>
                    {choosingMoveLocation ? 'Cancel Move' : 'Move Location'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.openButton, { backgroundColor: PRIMARY }]}
                  onPress={() => router.push(`/item/${matchedItem.id}` as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.openButtonText}>Open Item</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {matchedItem && choosingMoveLocation ? (
            renderDestinationPicker('Move to another location')
          ) : !matchedItem ? (
            renderDestinationPicker(scannedBarcode ? 'Choose item location' : 'Locations')
          ) : null}
        </ScrollView>
      )}

      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScanned={handleScanned}
      />

      <ItemFormModal
        visible={showItemForm}
        onClose={() => setShowItemForm(false)}
        onSubmit={handleSubmit}
        contextLabel={selectedDestination?.name}
        initialName={initialName}
        initialDescription={initialDescription}
        initialBarcode={scannedBarcode}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { fontSize: 29, fontWeight: '700', letterSpacing: 0, lineHeight: 34 },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 1 },
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
  scanCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  scanIcon: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  scanSubtitle: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  scanButton: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  scanButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  statusRow: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: { fontSize: 13, fontWeight: '600' },
  matchCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  matchIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchBody: { flex: 1 },
  matchName: { fontSize: 17, fontWeight: '700' },
  matchLocation: { fontSize: 13, marginTop: 2 },
  matchDescription: { fontSize: 13, lineHeight: 19 },
  factGrid: { flexDirection: 'row', gap: 10 },
  factTile: {
    flex: 1,
    minHeight: 76,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  factLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityInput: {
    flex: 1,
    minWidth: 38,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 0,
  },
  warrantyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warrantyTextWrap: { flex: 1 },
  warrantyStatus: { fontSize: 12, fontWeight: '800' },
  warrantyDate: { fontSize: 12, marginTop: 1 },
  emptyFactText: { fontSize: 14, fontWeight: '700' },
  matchActions: { flexDirection: 'row', gap: 10 },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '700' },
  openButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  pickerBlock: { gap: 12 },
  controls: { gap: 12 },
  listSection: { gap: 10 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
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
  destinationList: { gap: 10 },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  destinationRowSelected: { borderWidth: 1.5 },
  destinationIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationBody: { flex: 1 },
  destinationName: { fontSize: 15, fontWeight: '700' },
  destinationMeta: { fontSize: 12, marginTop: 2 },
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
