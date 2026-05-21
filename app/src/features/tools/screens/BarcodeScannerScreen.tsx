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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { LabelQrService, type LabelTarget } from '../services/LabelQrService';
import ItemFormModal from '@/src/features/spaces/screens/components/ItemFormModal';
import { ItemService } from '@/src/services/ItemService';
import { PhotoService } from '@/src/services/PhotoService';
import { ItemRepository } from '@/src/repositories/ItemRepository';
import { formatDateOnly, parseDateOnly, startOfLocalDay } from '@/src/utils/dateOnly';

const BARCODE_ORANGE = '#e07b54';
const DESTINATION_FILTERS: { key: BarcodeDestination['kind'] | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'space', label: 'Spaces' },
  { key: 'container', label: 'Containers' },
];

function getItemCount(quantity: number, contentsPerItem?: number | null) {
  const safeQuantity = Math.max(0, Math.floor(quantity) || 0);
  const safeContents = contentsPerItem ? Math.max(1, Math.floor(contentsPerItem) || 1) : null;
  return safeContents ? Math.ceil(safeQuantity / safeContents) : safeQuantity;
}

function getStoredQuantity(itemCount: number, contentsPerItem?: number | null) {
  const safeItemCount = Math.max(0, Math.floor(itemCount) || 0);
  const safeContents = contentsPerItem ? Math.max(1, Math.floor(contentsPerItem) || 1) : null;
  return safeContents ? safeItemCount * safeContents : safeItemCount;
}

function routeForLabelTarget(target: LabelTarget) {
  if (target.kind === 'space') return `/space/${target.id}`;
  if (target.kind === 'container') return `/container/${target.id}`;
  return `/item/${target.id}`;
}

export default function BarcodeScannerScreen() {
  const router = useRouter();
  const { barcodeType, barcodeData } = useLocalSearchParams<{ barcodeType?: string; barcodeData?: string }>();
  const handledRouteBarcodeRef = useRef<string | null>(null);
  const insets = useSafeAreaInsets();
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
  const [itemCountDraft, setItemCountDraft] = useState('');
  const [updatingUnitsPerPack, setUpdatingUnitsPerPack] = useState(false);
  const [unitsPerPackDraft, setUnitsPerPackDraft] = useState('');
  const [editingMatchedContents, setEditingMatchedContents] = useState(false);
  const [choosingMoveLocation, setChoosingMoveLocation] = useState(false);
  const [movingLocation, setMovingLocation] = useState(false);
  const matchedItemId = matchedItem?.id ?? null;

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

  const persistMatchedQuantity = useCallback(async (quantity: number, rollbackOnError = true) => {
    if (!matchedItem || updatingQuantity) return;

    const nextQuantity = Math.max(0, Math.floor(quantity) || 0);
    setQuantityDraft(String(nextQuantity));
    if (nextQuantity === matchedItem.quantity) return;

    setUpdatingQuantity(true);
    try {
      await ItemService.updateItem(matchedItem.id, { quantity: nextQuantity });
      setMatchedItem((current) => current ? { ...current, quantity: nextQuantity } : current);
      setItemCountDraft(String(getItemCount(nextQuantity, matchedItem.unitsPerPack)));
      DeviceEventEmitter.emit('synop:refresh-home');
    } catch (error) {
      console.error('[BarcodeScannerScreen] quantity update error', error);
      if (rollbackOnError) setQuantityDraft(String(matchedItem.quantity));
      Alert.alert('Could not update quantity', 'Please try again.');
    } finally {
      setUpdatingQuantity(false);
    }
  }, [matchedItem, updatingQuantity]);

  const persistMatchedItemCount = useCallback(async (itemCount: number, rollbackOnError = true) => {
    if (!matchedItem || updatingQuantity) return;

    const nextItemCount = Math.max(0, Math.floor(itemCount) || 0);
    const nextQuantity = getStoredQuantity(nextItemCount, matchedItem.unitsPerPack);
    setItemCountDraft(String(nextItemCount));
    setQuantityDraft(String(nextQuantity));
    if (nextQuantity === matchedItem.quantity) return;

    setUpdatingQuantity(true);
    try {
      await ItemService.updateItem(matchedItem.id, { quantity: nextQuantity });
      setMatchedItem((current) => current ? { ...current, quantity: nextQuantity } : current);
      DeviceEventEmitter.emit('synop:refresh-home');
    } catch (error) {
      console.error('[BarcodeScannerScreen] item count update error', error);
      if (rollbackOnError) {
        setItemCountDraft(String(getItemCount(matchedItem.quantity, matchedItem.unitsPerPack)));
        setQuantityDraft(String(matchedItem.quantity));
      }
      Alert.alert('Could not update item count', 'Please try again.');
    } finally {
      setUpdatingQuantity(false);
    }
  }, [matchedItem, updatingQuantity]);

  useEffect(() => {
    if (!matchedItem || updatingQuantity) return;

    const trimmedDraft = quantityDraft.trim();
    if (!trimmedDraft) return;

    const nextQuantity = Math.max(0, Math.floor(parseInt(trimmedDraft, 10)) || 0);
    if (nextQuantity === matchedItem.quantity && trimmedDraft === String(matchedItem.quantity)) return;

    const timeout = setTimeout(() => {
      persistMatchedQuantity(nextQuantity);
    }, 650);

    return () => clearTimeout(timeout);
  }, [matchedItem, persistMatchedQuantity, quantityDraft, updatingQuantity]);

  useEffect(() => {
    if (!matchedItem || updatingQuantity) return;

    const trimmedDraft = itemCountDraft.trim();
    if (!trimmedDraft) return;

    const nextItemCount = Math.max(0, Math.floor(parseInt(trimmedDraft, 10)) || 0);
    const currentItemCount = getItemCount(matchedItem.quantity, matchedItem.unitsPerPack);
    if (nextItemCount === currentItemCount && trimmedDraft === String(currentItemCount)) return;

    const timeout = setTimeout(() => {
      persistMatchedItemCount(nextItemCount);
    }, 650);

    return () => clearTimeout(timeout);
  }, [itemCountDraft, matchedItem, persistMatchedItemCount, updatingQuantity]);

  const handleQuantityChange = (delta: number) => {
    if (!matchedItem || updatingQuantity) return;

    const currentQuantity = Math.max(0, parseInt(quantityDraft, 10) || matchedItem.quantity);
    persistMatchedQuantity(currentQuantity + delta);
  };

  const handleItemCountChange = (delta: number) => {
    if (!matchedItem || updatingQuantity) return;

    const currentItemCount = Math.max(0, parseInt(itemCountDraft, 10) || getItemCount(matchedItem.quantity, matchedItem.unitsPerPack));
    persistMatchedItemCount(currentItemCount + delta);
  };

  const handleItemCountSubmit = () => {
    if (!matchedItem || updatingQuantity) return;

    const nextItemCount = Math.max(0, parseInt(itemCountDraft, 10) || 0);
    persistMatchedItemCount(nextItemCount);
  };

  const handleQuantitySubmit = () => {
    if (!matchedItem || updatingQuantity) return;

    const nextQuantity = Math.max(0, parseInt(quantityDraft, 10) || 0);
    persistMatchedQuantity(nextQuantity);
  };

  const persistMatchedUnitsPerPack = useCallback(async (unitsPerPack: number | null, rollbackOnError = true) => {
    if (!matchedItem || updatingUnitsPerPack) return;

    const nextUnitsPerPack = unitsPerPack == null ? null : Math.max(1, Math.floor(unitsPerPack) || 1);
    setUnitsPerPackDraft(nextUnitsPerPack ? String(nextUnitsPerPack) : '');
    if ((nextUnitsPerPack ?? null) === (matchedItem.unitsPerPack ?? null)) return;

    setUpdatingUnitsPerPack(true);
    try {
      const currentItemCount = getItemCount(matchedItem.quantity, matchedItem.unitsPerPack);
      const nextQuantity = nextUnitsPerPack ? getStoredQuantity(currentItemCount, nextUnitsPerPack) : currentItemCount;
      await ItemService.updateItem(matchedItem.id, { unitsPerPack: nextUnitsPerPack, quantity: nextQuantity });
      setMatchedItem((current) => current ? { ...current, unitsPerPack: nextUnitsPerPack, quantity: nextQuantity } : current);
      setQuantityDraft(String(nextQuantity));
      setItemCountDraft(String(getItemCount(nextQuantity, nextUnitsPerPack)));
      DeviceEventEmitter.emit('synop:refresh-home');
    } catch (error) {
      console.error('[BarcodeScannerScreen] units-per-pack update error', error);
      if (rollbackOnError) setUnitsPerPackDraft(matchedItem.unitsPerPack ? String(matchedItem.unitsPerPack) : '');
      Alert.alert('Could not update contents per item', 'Please try again.');
    } finally {
      setUpdatingUnitsPerPack(false);
    }
  }, [matchedItem, updatingUnitsPerPack]);

  useEffect(() => {
    if (!matchedItem || updatingUnitsPerPack || !editingMatchedContents) return;

    const trimmedDraft = unitsPerPackDraft.trim();
    const nextUnitsPerPack = trimmedDraft ? Math.max(1, Math.floor(parseInt(trimmedDraft, 10)) || 1) : null;
    if ((nextUnitsPerPack ?? null) === (matchedItem.unitsPerPack ?? null)) return;

    const timeout = setTimeout(() => {
      persistMatchedUnitsPerPack(nextUnitsPerPack);
    }, 650);

    return () => clearTimeout(timeout);
  }, [editingMatchedContents, matchedItem, persistMatchedUnitsPerPack, unitsPerPackDraft, updatingUnitsPerPack]);

  const handleUnitsPerPackChange = (delta: number) => {
    if (!matchedItem || updatingUnitsPerPack) return;

    const currentUnits = Math.max(0, parseInt(unitsPerPackDraft, 10) || matchedItem.unitsPerPack || 0);
    const nextUnits = Math.max(0, currentUnits + delta);
    persistMatchedUnitsPerPack(nextUnits > 0 ? nextUnits : null);
  };

  const handleUnitsPerPackSubmit = () => {
    if (!matchedItem || updatingUnitsPerPack) return;

    const nextUnits = unitsPerPackDraft.trim() ? Math.max(1, parseInt(unitsPerPackDraft, 10) || 1) : null;
    persistMatchedUnitsPerPack(nextUnits);
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
    setEditingMatchedContents(false);
    setChoosingMoveLocation(false);
    setResolvingScan(true);

    try {
      if (barcode.type === 'qr') {
        const target = await LabelQrService.resolveScannedData(barcode.data);
        if (target) {
          router.push(routeForLabelTarget(target) as any);
          return;
        }

        Alert.alert(
          'QR not recognized',
          'This QR code is not a Synop label. Try scanning a printed Synop label or a product barcode.'
        );
        setScannedBarcode(null);
        return;
      }

      const match = await BarcodeScannerService.findItemByBarcode(barcode);
      setMatchedItem(match);
      setEditingMatchedContents(false);
      setQuantityDraft(match ? String(match.quantity) : '');
      setItemCountDraft(match ? String(getItemCount(match.quantity, match.unitsPerPack)) : '');
      setUnitsPerPackDraft(match?.unitsPerPack ? String(match.unitsPerPack) : '');
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

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refreshMatchedItem = async () => {
        if (!matchedItemId) return;

        try {
          const latestItem = await ItemService.getItemById(matchedItemId);
          if (!active || !latestItem) return;

          setMatchedItem((current) => current ? {
            ...current,
            name: latestItem.name,
            description: latestItem.description ?? null,
            quantity: latestItem.quantity,
            unitsPerPack: latestItem.unitsPerPack ?? null,
            photoUri: latestItem.photoUri ?? null,
            warrantyExpiry: latestItem.warrantyExpiry ?? null,
            spaceId: latestItem.spaceId,
            containerId: latestItem.containerId ?? null,
            spaceName: latestItem.space?.name ?? current.spaceName,
            containerName: latestItem.container?.name ?? null,
          } : current);
          setQuantityDraft(String(latestItem.quantity));
          setItemCountDraft(String(getItemCount(latestItem.quantity, latestItem.unitsPerPack)));
          setUnitsPerPackDraft(latestItem.unitsPerPack ? String(latestItem.unitsPerPack) : '');
        } catch (error) {
          console.error('[BarcodeScannerScreen] matched item refresh error', error);
        }
      };

      refreshMatchedItem();

      return () => {
        active = false;
      };
    }, [matchedItemId])
  );

  const handleSubmit = async (
    name: string,
    description?: string,
    quantity?: number,
    photoUri?: string | null,
    warrantyExpiry?: Date | null,
    barcode?: ScannedBarcode | null,
    unitsPerPack?: number | null
  ) => {
    if (!selectedDestination) {
      Alert.alert('Choose a destination', 'Select a space or container before creating the item.');
      return;
    }

    const barcodeToSave = barcode ?? scannedBarcode;
    if (barcodeToSave) {
      const existingMatch = await BarcodeScannerService.findItemByBarcode(barcodeToSave);
      if (existingMatch) {
        setShowItemForm(false);
        setMatchedItem(existingMatch);
        setEditingMatchedContents(false);
        setQuantityDraft(String(existingMatch.quantity));
        setItemCountDraft(String(getItemCount(existingMatch.quantity, existingMatch.unitsPerPack)));
        setUnitsPerPackDraft(existingMatch.unitsPerPack ? String(existingMatch.unitsPerPack) : '');
        setChoosingMoveLocation(false);
        return;
      }
    }

    const item = await ItemService.createItem(
      selectedDestination.spaceId,
      name,
      selectedDestination.containerId,
      description,
      quantity,
      null,
      unitsPerPack
    );

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
      unitsPerPack: item.unitsPerPack ?? unitsPerPack ?? null,
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
    setItemCountDraft(String(getItemCount(item.quantity, item.unitsPerPack ?? unitsPerPack ?? null)));
    setUnitsPerPackDraft(item.unitsPerPack ? String(item.unitsPerPack) : '');
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
            <Text style={[styles.title, { color: colors.text }]}>Scan Code</Text>
            <Text style={[styles.subtitle, { color: subtleText }]}>Open QR labels or save product barcodes</Text>
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
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 112 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[
            styles.scanCard,
            matchedItem && styles.scanCardCompact,
            { backgroundColor: cardBg, borderColor },
          ]}>
            {!matchedItem && (
              <View style={[styles.scanIcon, { backgroundColor: `${BARCODE_ORANGE}18` }]}>
                <FontAwesomeIcon icon={faBarcode} size={28} color={BARCODE_ORANGE} />
              </View>
            )}
            <View style={matchedItem ? styles.compactScanText : undefined}>
              <Text style={[styles.scanTitle, matchedItem && styles.scanTitleCompact, { color: colors.text }]}>
                {matchedItem ? 'Item found' : scannedBarcode ? 'Barcode captured' : 'Scan a product barcode'}
              </Text>
              <Text style={[styles.scanSubtitle, matchedItem && styles.scanSubtitleCompact, { color: subtleText }]}>
                {matchedItem
                  ? 'Barcode matched your saved inventory.'
                  : scannedBarcode
                  ? `${scannedBarcode.type} - ${scannedBarcode.data}`
                  : 'Scan a printed Synop QR label to open an item, or scan a product barcode to save and find it later.'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.scanButton, matchedItem && styles.scanButtonCompact, { backgroundColor: BARCODE_ORANGE }]}
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
            <View style={[styles.matchCard, { backgroundColor: cardBg, borderColor: `${BARCODE_ORANGE}33` }]}>
              <View style={styles.matchHeader}>
                <View style={[styles.matchIcon, { backgroundColor: `${BARCODE_ORANGE}18` }]}>
                  <FontAwesomeIcon icon={faCircleInfo} size={18} color={BARCODE_ORANGE} />
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
              <View style={[styles.stockPanel, { backgroundColor: `${BARCODE_ORANGE}0F`, borderColor: `${BARCODE_ORANGE}40` }]}>
                <View style={styles.stockPanelHeader}>
                  <View>
                    <Text style={[styles.stockPanelTitle, { color: BARCODE_ORANGE }]}>Stock controls</Text>
                    <Text style={[styles.stockPanelSubtitle, { color: subtleText }]}>
                      {matchedItem.unitsPerPack ? 'Use total contents when selling one unit inside a pack.' : 'Track whole items in stock.'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.stockControlRow, { borderColor: `${BARCODE_ORANGE}22` }]}>
                  <View style={styles.stockControlText}>
                    <Text style={[styles.stockControlLabel, { color: subtleText }]}>Item count</Text>
                    <Text style={[styles.stockControlHint, { color: subtleText }]}>
                      Whole items, packs, boxes, or containers
                    </Text>
                  </View>
                  <View style={styles.quantityControl}>
                    <TouchableOpacity
                      style={[styles.quantityButton, { borderColor: `${BARCODE_ORANGE}33`, backgroundColor: `${BARCODE_ORANGE}12` }]}
                      onPress={() => handleItemCountChange(-1)}
                      disabled={updatingQuantity || matchedItem.quantity <= 0}
                      activeOpacity={0.75}
                    >
                      <FontAwesomeIcon icon={faMinus} size={12} color={matchedItem.quantity <= 0 ? subtleText : BARCODE_ORANGE} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.quantityInput, styles.quantityInputCompact, { color: colors.text }]}
                      value={itemCountDraft}
                      onChangeText={(value) => setItemCountDraft(value.replace(/[^0-9]/g, ''))}
                      onBlur={handleItemCountSubmit}
                      onSubmitEditing={handleItemCountSubmit}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      maxLength={4}
                      editable={!updatingQuantity}
                      selectTextOnFocus
                    />
                    <TouchableOpacity
                      style={[styles.quantityButton, { borderColor: `${BARCODE_ORANGE}33`, backgroundColor: `${BARCODE_ORANGE}12` }]}
                      onPress={() => handleItemCountChange(1)}
                      disabled={updatingQuantity}
                      activeOpacity={0.75}
                    >
                      <FontAwesomeIcon icon={faPlus} size={12} color={BARCODE_ORANGE} />
                    </TouchableOpacity>
                  </View>
                </View>

                {matchedItem.unitsPerPack ? (
                  <View style={[styles.stockControlRow, { borderColor: `${BARCODE_ORANGE}22` }]}>
                    <View style={styles.stockControlText}>
                      <Text style={[styles.stockControlLabel, { color: subtleText }]}>Total contents</Text>
                      <Text style={[styles.stockControlHint, { color: subtleText }]}>Sell or add one content unit</Text>
                    </View>
                    <View style={styles.quantityControl}>
                      <TouchableOpacity
                        style={[styles.quantityButton, { borderColor: `${BARCODE_ORANGE}33`, backgroundColor: `${BARCODE_ORANGE}12` }]}
                        onPress={() => handleQuantityChange(-1)}
                        disabled={updatingQuantity || matchedItem.quantity <= 0}
                        activeOpacity={0.75}
                      >
                        <FontAwesomeIcon icon={faMinus} size={12} color={matchedItem.quantity <= 0 ? subtleText : BARCODE_ORANGE} />
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.quantityInput, styles.quantityInputCompact, { color: colors.text }]}
                        value={quantityDraft}
                        onChangeText={(value) => setQuantityDraft(value.replace(/[^0-9]/g, ''))}
                        onBlur={handleQuantitySubmit}
                        onSubmitEditing={handleQuantitySubmit}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        maxLength={5}
                        editable={!updatingQuantity}
                        selectTextOnFocus
                      />
                      <TouchableOpacity
                        style={[styles.quantityButton, { borderColor: `${BARCODE_ORANGE}33`, backgroundColor: `${BARCODE_ORANGE}12` }]}
                        onPress={() => handleQuantityChange(1)}
                        disabled={updatingQuantity}
                        activeOpacity={0.75}
                      >
                        <FontAwesomeIcon icon={faPlus} size={12} color={BARCODE_ORANGE} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                <View style={styles.contentsSettingRow}>
                  <View style={styles.stockControlText}>
                    <Text style={[styles.stockControlLabel, { color: subtleText }]}>Contents per item</Text>
                    <Text style={[styles.stockControlHint, { color: subtleText }]}>Crucial setup value, edit intentionally</Text>
                  </View>
                  {editingMatchedContents ? (
                    <View style={styles.contentsEditor}>
                      <View style={styles.quantityControl}>
                        <TouchableOpacity
                          style={[styles.quantityButton, { borderColor: `${BARCODE_ORANGE}33`, backgroundColor: `${BARCODE_ORANGE}12` }]}
                          onPress={() => handleUnitsPerPackChange(-1)}
                          disabled={updatingUnitsPerPack || !matchedItem.unitsPerPack}
                          activeOpacity={0.75}
                        >
                          <FontAwesomeIcon icon={faMinus} size={12} color={!matchedItem.unitsPerPack ? subtleText : BARCODE_ORANGE} />
                        </TouchableOpacity>
                        <TextInput
                          style={[styles.quantityInput, styles.quantityInputCompact, { color: matchedItem.unitsPerPack ? colors.text : subtleText }]}
                          value={unitsPerPackDraft}
                          onChangeText={(value) => setUnitsPerPackDraft(value.replace(/[^0-9]/g, ''))}
                          onBlur={handleUnitsPerPackSubmit}
                          onSubmitEditing={handleUnitsPerPackSubmit}
                          keyboardType="number-pad"
                          returnKeyType="done"
                          maxLength={5}
                          editable={!updatingUnitsPerPack}
                          placeholder="0"
                          placeholderTextColor={subtleText}
                          selectTextOnFocus
                        />
                        <TouchableOpacity
                          style={[styles.quantityButton, { borderColor: `${BARCODE_ORANGE}33`, backgroundColor: `${BARCODE_ORANGE}12` }]}
                          onPress={() => handleUnitsPerPackChange(1)}
                          disabled={updatingUnitsPerPack}
                          activeOpacity={0.75}
                        >
                          <FontAwesomeIcon icon={faPlus} size={12} color={BARCODE_ORANGE} />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={[styles.inlineEditButton, { borderColor: `${BARCODE_ORANGE}33`, backgroundColor: `${BARCODE_ORANGE}12` }]}
                        onPress={() => {
                          handleUnitsPerPackSubmit();
                          setEditingMatchedContents(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.inlineEditButtonText, { color: BARCODE_ORANGE }]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.protectedFactRow}>
                      <Text style={[styles.protectedFactValue, { color: matchedItem.unitsPerPack ? colors.text : subtleText }]}>
                        {matchedItem.unitsPerPack ?? 0}
                      </Text>
                      <TouchableOpacity
                        style={[styles.inlineEditButton, { borderColor: `${BARCODE_ORANGE}33`, backgroundColor: `${BARCODE_ORANGE}12` }]}
                        onPress={() => setEditingMatchedContents(true)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.inlineEditButtonText, { color: BARCODE_ORANGE }]}>
                          {matchedItem.unitsPerPack ? 'Edit' : 'Enable'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              <View style={[styles.metaStrip, { backgroundColor: inputBg, borderColor: `${BARCODE_ORANGE}20` }]}>
                <View style={styles.metaContent}>
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
                  style={[styles.secondaryButton, { borderColor: `${BARCODE_ORANGE}33` }]}
                  onPress={() => setChoosingMoveLocation((current) => !current)}
                  activeOpacity={0.8}
                  disabled={movingLocation}
                >
                  <Text style={[styles.secondaryButtonText, { color: BARCODE_ORANGE }]}>
                    {choosingMoveLocation ? 'Cancel Move' : 'Move Location'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.openButton, { backgroundColor: BARCODE_ORANGE }]}
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
        includeQr
        title="Scan Code"
        permissionMessage="Synop needs camera access to scan printed QR labels and product barcodes."
        hint="Place a Synop QR label or product barcode inside the frame"
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
  scroll: { padding: 16, gap: 14 },
  scanCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  scanCardCompact: {
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactScanText: { flex: 1, minWidth: 0 },
  scanIcon: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  scanTitleCompact: { fontSize: 15, textAlign: 'left' },
  scanSubtitle: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  scanSubtitleCompact: { fontSize: 12, lineHeight: 16, textAlign: 'left', marginTop: 1 },
  scanButton: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  scanButtonCompact: {
    alignSelf: 'auto',
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginTop: 0,
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
  stockPanel: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  stockPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  stockPanelTitle: { fontSize: 15, fontWeight: '800' },
  stockPanelSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  stockControlRow: {
    borderTopWidth: 1,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stockControlText: { flex: 1, minWidth: 0 },
  stockControlLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  stockControlHint: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  contentsSettingRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.22)',
    paddingTop: 10,
    gap: 8,
  },
  contentsEditor: { gap: 8 },
  metaStrip: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  metaContent: { gap: 8 },
  factGrid: { flexDirection: 'row', gap: 10 },
  factTile: {
    flex: 1,
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    justifyContent: 'flex-start',
    gap: 8,
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
  quantityInputCompact: {
    flex: 0,
    width: 52,
  },
  protectedFactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  protectedFactValue: {
    flex: 1,
    fontSize: 19,
    fontWeight: '800',
  },
  inlineEditButton: {
    minHeight: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  inlineEditButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  packHint: {
    fontSize: 12,
    fontWeight: '700',
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
