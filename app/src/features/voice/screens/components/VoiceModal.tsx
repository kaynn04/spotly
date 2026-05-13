/**
 * VoiceModal
 *
 * Full-screen modal for the voice-input flow.
 *
 * State machine:
 *   idle → listening → processing → confirming → success
 *                    ↘ error ←─────────────────┘
 *   (any phase) → [Cancel] → modal closes, no item created
 *   (error|confirming) → [Try Again] → listening
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faMicrophone,
  faTimes,
  faCheck,
  faChevronDown,
  faSearch,
  faMapMarkerAlt,
} from '@fortawesome/free-solid-svg-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { VoiceParserService } from '../../services/VoiceParserService';
import { VoiceMatcherService } from '../../services/VoiceMatcherService';
import type { ParsedVoiceCommand, VoiceSessionState } from '../../models/VoiceCommand';
import type { Space } from '@/src/models/Space';
import type { Container } from '@/src/models/Container';
import type { Item } from '@/src/models/Item';
import { SpaceService } from '@/src/services/SpaceService';
import { ContainerService } from '@/src/services/ContainerService';
import { ItemService } from '@/src/services/ItemService';
import { LendingService } from '@/src/features/lending/services/LendingService';
import { LendingRepository } from '@/src/features/lending/repositories/LendingRepository';
import { ItemRepository } from '@/src/repositories/ItemRepository';
import { OutsideService } from '@/src/features/outside/services/OutsideService';
import { useColorScheme } from '@/hooks/use-color-scheme';

const PRIMARY = '#6b7f99';
const SUCCESS = '#6b9e7a';
const DESTRUCTIVE = '#d32f2f';
const LISTEN_TIMEOUT_MS = 10_000;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful item creation so the parent can refresh */
  onItemAdded?: () => void;
  /** Called when user wants to navigate to an item from search results */
  onNavigateToItem?: (itemId: string) => void;
  /** Called after a successful space creation so the parent can refresh */
  onSpaceCreated?: () => void;
}

export default function VoiceModal({ visible, onClose, onItemAdded, onNavigateToItem, onSpaceCreated }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = buildStyles(isDark);
  const [sessionState, setSessionState] = useState<VoiceSessionState>({ phase: 'idle' });

  // Confirmation-phase mutable state (overrides for unresolved fields)
  const [confirmedSpaceId, setConfirmedSpaceId] = useState<string | null>(null);
  const [confirmedContainerId, setConfirmedContainerId] = useState<string | null | undefined>(undefined);
  // undefined = not yet decided; null = explicitly no container; string = picked
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [spaceContainers, setSpaceContainers] = useState<Container[]>([]);
  const [showSpacePicker, setShowSpacePicker] = useState(false);
  const [showContainerPicker, setShowContainerPicker] = useState(false);
  const [itemNameOverride, setItemNameOverride] = useState<string | null>(null);
  // Ref to always hold the latest edited item name (avoids closure issues)
  const itemNameRef = useRef<string>('');
  // For multi-add: array of item names
  const [itemNamesOverride, setItemNamesOverride] = useState<string[]>([]);
  // For create-space: editable space name
  const [spaceNameOverride, setSpaceNameOverride] = useState<string>('');
  // For create-container: editable container name + resolved space
  const [containerNameOverride, setContainerNameOverride] = useState<string>('');
  const [confirmedContainerSpaceId, setConfirmedContainerSpaceId] = useState<string | null>(null);
  const [showContainerSpacePicker, setShowContainerSpacePicker] = useState(false);
  // For lend action: editable item name + borrower name
  const [lendItemOverride, setLendItemOverride] = useState<string>('');
  const [lendBorrowerOverride, setLendBorrowerOverride] = useState<string>('');
  const [lendMatchedItem, setLendMatchedItem] = useState<Item | null>(null);
  // For return action: resolved lending details
  const [returnLendingId, setReturnLendingId] = useState<string | null>(null);
  const [returnItemName, setReturnItemName] = useState<string>('');
  const [returnBorrowerName, setReturnBorrowerName] = useState<string>('');
  // For move action: the resolved item to move
  const [matchedItem, setMatchedItem] = useState<Item | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Speech recognition events ────────────────────────────────────────────

  useSpeechRecognitionEvent('result', (event) => {
    clearListenTimeout();
    const transcript = event.results[0]?.transcript ?? '';
    if (!transcript.trim()) {
      setSessionState({ phase: 'error', message: "Didn't catch that — try again" });
      return;
    }
    processTranscript(transcript);
  });

  useSpeechRecognitionEvent('end', () => {
    // 'end' always fires last — safe signal that the recognizer is fully released
    clearListenTimeout();
  });

  useSpeechRecognitionEvent('error', (event) => {
    clearListenTimeout();

    // 'aborted' is expected when we call abort() ourselves (timeout/cancel) — ignore it
    if (event.error === 'aborted') return;
    // 'no-speech' means silence was detected — show friendly message
    if (event.error === 'no-speech') {
      setSessionState({ phase: 'error', message: "Didn't catch anything — tap to try again" });
      return;
    }
    // Language pack not yet downloaded
    const msg = event.message || event.error || '';
    if (msg.toLowerCase().includes('not yet downloaded') || event.error === 'language-not-supported') {
      ExpoSpeechRecognitionModule.abort()?.catch(() => {});
      setSessionState({ phase: 'needs-language' });
      return;
    }

    // For any other error, stop the recognizer to clear audio feedback
    ExpoSpeechRecognitionModule.abort()?.catch(() => {});
    setSessionState({ phase: 'error', message: msg || 'Unknown error — try again' });
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const clearListenTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const startListening = useCallback(async () => {
    resetConfirmState();
    setSessionState({ phase: 'listening' });
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        setSessionState({ phase: 'needs-permission' });
        return;
      }

      const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (!available) {
        setSessionState({ phase: 'needs-install' });
        return;
      }

      const defaultService = ExpoSpeechRecognitionModule.getDefaultRecognitionService();

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: false,
        continuous: false,
        androidRecognitionServicePackage: defaultService?.packageName,
      });
      timeoutRef.current = setTimeout(() => {
        ExpoSpeechRecognitionModule.abort();
        setSessionState({ phase: 'error', message: 'Listening timed out — try again' });
      }, LISTEN_TIMEOUT_MS);
    } catch {
      // Silently handle system-level errors; show user-friendly message instead
      setSessionState({ phase: 'error', message: 'Could not start microphone — try again' });
    }
  }, []);

  const resetConfirmState = () => {
    setConfirmedSpaceId(null);
    setConfirmedContainerId(undefined);
    setItemNameOverride(null);
    itemNameRef.current = '';
    setItemNamesOverride([]);
    setSpaceNameOverride('');
    setContainerNameOverride('');
    setConfirmedContainerSpaceId(null);
    setShowContainerSpacePicker(false);
    setLendItemOverride('');
    setLendBorrowerOverride('');
    setLendMatchedItem(null);
    setReturnLendingId(null);
    setReturnItemName('');
    setReturnBorrowerName('');
    setMatchedItem(null);
    setAllSpaces([]);
    setSpaceContainers([]);
    setShowSpacePicker(false);
    setShowContainerPicker(false);
  };

  const processTranscript = async (transcript: string) => {
    setSessionState({ phase: 'processing' });
    try {
      const spaces = await SpaceService.getAllSpaces();
      setAllSpaces(spaces);

      const lendingService = new LendingService(new LendingRepository(), new ItemRepository());
      const parts = VoiceParserService.parse(transcript, spaces.map(s => s.name));

      // For create-space action: show confirmation with editable name
      if (parts.action === 'create-space') {
        const name = parts.spokenSpace ?? '';
        if (!name) {
          setSessionState({ phase: 'error', message: "Couldn't catch the space name — try again", transcript, detectedAction: 'create-space' });
          return;
        }
        // Capitalise first letter of each word
        const formatted = name.replace(/\b\w/g, c => c.toUpperCase());
        setSpaceNameOverride(formatted);
        setSessionState({ phase: 'confirming-space', spaceName: formatted });
        return;
      }

      if (!parts.itemName && !parts.itemNames) {
        setSessionState({ phase: 'error', message: "Couldn't understand — try saying it differently", transcript, detectedAction: parts.action });
        return;
      }

      // For multi-add: multiple items in one utterance — stored in session state (not separate state)
      // to avoid React Native state batching issues causing isConfirmEnabled to compute stale values.

      // For lend action: fuzzy-find item, pre-fill borrower
      if (parts.action === 'lend') {
        const allItems = await ItemService.getAllItems();
        const spokenItem = parts.itemName ?? '';
        let foundItem: Item | null = null;

        if (spokenItem) {
          foundItem = allItems.find(i => i.name.toLowerCase() === spokenItem.toLowerCase()) ?? null;
          if (!foundItem) {
            const fuzzysort = (await import('fuzzysort')).default;
            const results = fuzzysort.go(spokenItem, allItems, { key: 'name', limit: 1, threshold: -5000 });
            if (results.length > 0) foundItem = results[0].obj;
          }
        }

        // Check item isn't already lent or in an outside session
        if (foundItem) {
          const activeLendings = await lendingService.getActiveLendings();
          if (activeLendings.some(l => l.item_id === foundItem!.id)) {
            setSessionState({ phase: 'error', message: `"${foundItem.name}" is already lent out — mark as returned first`, transcript, detectedAction: 'lend' });
            return;
          }
          const outsideService = new OutsideService();
          const outsideIds = await outsideService.getActiveSessionItemIds();
          if (outsideIds.has(foundItem.id)) {
            setSessionState({ phase: 'error', message: `"${foundItem.name}" is in an active outside session`, transcript, detectedAction: 'lend' });
            return;
          }
        }

        const borrowerName = parts.spokenSpace ?? '';
        setLendItemOverride(foundItem?.name ?? spokenItem);
        setLendBorrowerOverride(borrowerName.replace(/\b\w/g, c => c.toUpperCase()));
        setLendMatchedItem(foundItem);
        setSessionState({ phase: 'confirming-lend', itemName: foundItem?.name ?? spokenItem, borrowerName: borrowerName.replace(/\b\w/g, c => c.toUpperCase()), matchedItem: foundItem });
        return;
      }

      // For return action: find active lending by item name
      if (parts.action === 'return') {
        const spokenItem = parts.itemName ?? '';
        if (!spokenItem) {
          setSessionState({ phase: 'error', message: "Couldn't catch the item name — try again", transcript, detectedAction: 'return' });
          return;
        }
        const activeLendings = await lendingService.getActiveLendingsWithItemNames();
        if (activeLendings.length === 0) {
          setSessionState({ phase: 'error', message: 'No items are currently lent out', transcript, detectedAction: 'return' });
          return;
        }
        // Exact match first
        let matched = activeLendings.find(l => l.item_name.toLowerCase() === spokenItem.toLowerCase()) ?? null;
        if (!matched) {
          const fuzzysort = (await import('fuzzysort')).default;
          const results = fuzzysort.go(spokenItem, activeLendings, { key: 'item_name', limit: 1, threshold: -5000 });
          if (results.length > 0) matched = results[0].obj;
        }
        if (!matched) {
          setSessionState({ phase: 'error', message: `No active lending found for "${spokenItem}"`, transcript, detectedAction: 'return' });
          return;
        }
        setReturnLendingId(matched.id);
        setReturnItemName(matched.item_name);
        setReturnBorrowerName(matched.borrower_name);
        setSessionState({ phase: 'confirming-return', lendingId: matched.id, itemName: matched.item_name, borrowerName: matched.borrower_name });
        return;
      }

      // For create-container action: fuzzy-match space, show confirmation
      if (parts.action === 'create-container') {
        const containerName = parts.itemName;
        if (!containerName) {
          setSessionState({ phase: 'error', message: "Couldn't catch the container name — try again", transcript, detectedAction: 'create-container' });
          return;
        }
        const formatted = containerName.replace(/\b\w/g, c => c.toUpperCase());
        setContainerNameOverride(formatted);

        // Resolve space if spoken
        let spaceResult: import('@/src/features/voice/models/VoiceCommand').MatchResult<Space>;
        if (parts.spokenSpace) {
          const match = VoiceMatcherService.resolve(
            { ...parts, action: 'add', itemName: 'dummy' },
            spaces,
            []
          ).space;
          spaceResult = match;
          if (match.status === 'exact') setConfirmedContainerSpaceId(match.record.id);
        } else {
          spaceResult = { status: 'none', spoken: '' };
        }

        setSessionState({ phase: 'confirming-container', containerName: formatted, spaceResult });
        return;
      }

      // For find action: search items by name and show results
      if (parts.action === 'find') {
        const allItems = await ItemService.getAllItems();
        const spokenItem = parts.itemName.toLowerCase();

        // Exact matches first
        const exactMatches = allItems.filter(i => i.name.toLowerCase() === spokenItem);
        if (exactMatches.length > 0) {
          setSessionState({ phase: 'found', items: exactMatches });
          return;
        }

        // Fuzzy match
        const fuzzysort = (await import('fuzzysort')).default;
        const results = fuzzysort.go(parts.itemName, allItems, { key: 'name', limit: 5, threshold: -5000 });
        if (results.length > 0) {
          setSessionState({ phase: 'found', items: results.map(r => r.obj) });
          return;
        }

        setSessionState({ phase: 'error', message: `No items matching "${parts.itemName}" found`, transcript, detectedAction: 'find' });
        return;
      }

      // For move action: find the existing item by fuzzy name match
      if (parts.action === 'move') {
        const allItems = await ItemService.getAllItems();
        const spokenItem = parts.itemName.toLowerCase();
        const exactItem = allItems.find(i => i.name.toLowerCase() === spokenItem);
        let foundItem: Item | null = null;
        if (exactItem) {
          foundItem = exactItem;
        } else {
          // Fuzzy match item name
          const fuzzysort = (await import('fuzzysort')).default;
          const results = fuzzysort.go(parts.itemName, allItems, { key: 'name', limit: 1, threshold: -5000 });
          if (results.length > 0) {
            foundItem = results[0].obj;
          } else {
            setSessionState({ phase: 'error', message: `Item "${parts.itemName}" not found \u2014 try again`, transcript, detectedAction: 'move' });
            return;
          }
        }

        // Validate: item must not be lent out or in an active outside session
        const activeLendings = await lendingService.getActiveLendings();
        if (activeLendings.some(l => l.item_id === foundItem!.id)) {
          setSessionState({ phase: 'error', message: `"${foundItem!.name}" is currently lent out \u2014 mark as returned first` });
          return;
        }

        const outsideService = new OutsideService();
        const outsideIds = await outsideService.getActiveSessionItemIds();
        if (outsideIds.has(foundItem!.id)) {
          setSessionState({ phase: 'error', message: `"${foundItem!.name}" is in an active outside session \u2014 complete the session first` });
          return;
        }

        setMatchedItem(foundItem);
      }
      // Resolve space first
      const tempParsed = VoiceMatcherService.resolve(parts, spaces, []);
      const resolvedSpaceId =
        tempParsed.space.status === 'exact' ? tempParsed.space.record.id : null;

      // If space was exactly resolved, load its containers for container matching
      let containers: Container[] = [];
      if (resolvedSpaceId) {
        containers = await ContainerService.getContainersBySpaceId(resolvedSpaceId);
        setSpaceContainers(containers);
      }

      const parsed = VoiceMatcherService.resolve(parts, spaces, containers);

      // Pre-populate confirmed IDs for exact matches
      if (parsed.space.status === 'exact') {
        setConfirmedSpaceId(parsed.space.record.id);
        if (!resolvedSpaceId) {
          const cs = await ContainerService.getContainersBySpaceId(parsed.space.record.id);
          setSpaceContainers(cs);
        }
      }
      if (parsed.container !== 'absent' && parsed.container.status === 'exact') {
        setConfirmedContainerId(parsed.container.record.id);
      } else if (parsed.container === 'absent') {
        setConfirmedContainerId(null);
      }

      const multiItemNames = parts.action === 'add' && parts.itemNames && parts.itemNames.length > 0
        ? parts.itemNames
        : undefined;
      if (multiItemNames) setItemNamesOverride(multiItemNames);
      // Initialize the ref with the parsed item name for single-item edits
      itemNameRef.current = parsed.itemName ?? '';
      setItemNameOverride(parsed.itemName);
      setSessionState({ phase: 'confirming', parsed, itemNames: multiItemNames, editedItemName: parsed.itemName ?? undefined });
    } catch {
      setSessionState({ phase: 'error', message: 'Something went wrong — try again', transcript, detectedAction: parts.action });
    }
  };

  const handleAcceptFuzzySpace = (spaceId: string) => {
    setConfirmedSpaceId(spaceId);
    // Load containers for the accepted space
    ContainerService.getContainersBySpaceId(spaceId).then(setSpaceContainers).catch(() => {});
  };

  const handleAcceptFuzzyContainer = (containerId: string) => {
    setConfirmedContainerId(containerId);
  };

  const handleConfirmReturn = async () => {
    if (!returnLendingId) return;
    try {
      const svc = new LendingService(new LendingRepository(), new ItemRepository());
      await svc.markAsReturned(returnLendingId);
      setSessionState({ phase: 'success', action: 'return', itemName: returnItemName, location: returnBorrowerName });
      onItemAdded?.();
      setTimeout(() => { onClose(); setSessionState({ phase: 'idle' }); }, 1500);
    } catch {
      setSessionState({ phase: 'error', message: 'Failed to mark as returned — try again' });
    }
  };

  const handleConfirmLend = async () => {
    const borrower = lendBorrowerOverride.trim();
    const item = lendMatchedItem;
    if (!borrower || !item) return;
    try {
      const svc = new LendingService(new LendingRepository(), new ItemRepository());
      await svc.createLending({ item_id: item.id, borrower_name: borrower });
      setSessionState({ phase: 'success', action: 'lend', itemName: item.name, location: borrower });
      onItemAdded?.();
      setTimeout(() => { onClose(); setSessionState({ phase: 'idle' }); }, 1500);
    } catch {
      setSessionState({ phase: 'error', message: 'Failed to lend item — try again' });
    }
  };

  const handleConfirmContainer = async () => {
    const name = containerNameOverride.trim();
    if (!name || !confirmedContainerSpaceId) return;
    try {
      await ContainerService.createContainer(name, confirmedContainerSpaceId);
      const space = allSpaces.find(s => s.id === confirmedContainerSpaceId);
      setSessionState({ phase: 'success', action: 'create-container', itemName: name, location: space?.name ?? '' });
      onItemAdded?.(); // refresh parent (dashboard)
      setTimeout(() => {
        onClose();
        setSessionState({ phase: 'idle' });
      }, 1500);
    } catch {
      setSessionState({ phase: 'error', message: 'Failed to create container — try again' });
    }
  };

  const handleConfirmSpace = async () => {    const name = spaceNameOverride.trim();
    if (!name) return;
    try {
      await SpaceService.createSpace(name);
      setSessionState({ phase: 'success', action: 'create-space', itemName: name, location: '' });
      onSpaceCreated?.();
      setTimeout(() => {
        onClose();
        setSessionState({ phase: 'idle' });
      }, 1500);
    } catch {
      setSessionState({ phase: 'error', message: 'Failed to create space — try again' });
    }
  };

  const handleConfirm = async () => {
    if (sessionState.phase !== 'confirming') return;
    const { parsed } = sessionState;    const finalSpaceId = confirmedSpaceId;
    const finalContainerId =
      confirmedContainerId === undefined ? null : confirmedContainerId;

    try {
      // Check if this is multi-add — prefer itemNamesOverride (user-edited) over sessionState.itemNames (original)
      const multiItems = itemNamesOverride.length > 0 ? itemNamesOverride : (sessionState.itemNames ?? null);
      const isMultiAdd = (multiItems?.length ?? 0) > 0;
      if (isMultiAdd) {
        // Add multiple items
        for (const name of multiItems!) {
          const trimmed = name.trim();
          if (trimmed) {
            await ItemService.createItem(finalSpaceId, trimmed, finalContainerId, '', 1);
          }
        }
        const space = allSpaces.find(s => s.id === finalSpaceId);
        const container = spaceContainers.find(c => c.id === finalContainerId);
        const location = container ? `${space?.name} › ${container.name}` : (space?.name ?? '');
        setSessionState({ phase: 'success', action: 'add', itemName: `${multiItems!.length} items`, location });
        onItemAdded?.();
        setTimeout(() => { onClose(); setSessionState({ phase: 'idle' }); }, 1500);
        return;
      }

      // Single item flow — read from ref to avoid stale closure issues
      const finalItemName = itemNameRef.current.trim() || parsed.itemName;
      if (!finalSpaceId || !finalItemName) return;

      if (parsed.action === 'move' && matchedItem) {
        // Move existing item to new location
        if (finalContainerId) {
          await ItemService.moveItemToContainer(matchedItem.id, finalSpaceId, finalContainerId);
        } else {
          await ItemService.moveItem(matchedItem.id, matchedItem.spaceId, finalSpaceId);
        }
      } else {
        // Add new item
        await ItemService.createItem(finalSpaceId, finalItemName, finalContainerId, '', 1);
      }

      // Build success location label
      const space = allSpaces.find(s => s.id === finalSpaceId);
      const container = spaceContainers.find(c => c.id === finalContainerId);
      const location = container ? `${space?.name} › ${container.name}` : (space?.name ?? '');

      setSessionState({ phase: 'success', action: parsed.action, itemName: finalItemName, location });
      onItemAdded?.();

      setTimeout(() => {
        onClose();
        setSessionState({ phase: 'idle' });
      }, 1500);
    } catch {
      const errorMsg = isMultiAdd
        ? 'Failed to add items — try again'
        : sessionState.phase === 'confirming'
        ? (sessionState.parsed.action === 'move'
          ? 'Failed to move item — try again'
          : 'Failed to add item — try again')
        : 'Operation failed — try again';
      setSessionState({ phase: 'error', message: errorMsg });
    }
  };

  const handleCancel = () => {
    clearListenTimeout();
    ExpoSpeechRecognitionModule.abort();
    setSessionState({ phase: 'idle' });
    resetConfirmState();
    onClose();
  };

  const handleRetry = () => {
    startListening();
  };

  // Clean up recognizer when modal closes to stop any lingering audio feedback
  useEffect(() => {
    if (!visible) {
      clearListenTimeout();
      ExpoSpeechRecognitionModule.abort()?.catch(() => {});
    }
  }, [visible]);

  // ─── Derived state for the confirmation card ───────────────────────────────

  const isConfirmEnabled = (() => {
    if (sessionState.phase !== 'confirming') return false;
    const { parsed } = sessionState;
    // Read itemNames from session state (source of truth) to avoid stale closure issues
    const isMultiAdd = (sessionState.itemNames?.length ?? 0) > 0 || itemNamesOverride.length > 0;
    if (!isMultiAdd && !parsed.itemName && !itemNameOverride) return false;
    if (!confirmedSpaceId) return false;
    // Container: if absent, ok. If not absent, must be resolved (not undefined)
    if (parsed.container !== 'absent' && confirmedContainerId === undefined) {
      // Check if space actually has containers
      if (spaceContainers.length > 0) return false;
    }
    return true;
  })();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCancel}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Voice Input</Text>
          <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <FontAwesomeIcon icon={faTimes} size={18} color="#8e8e93" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* ── IDLE ─────────────────────────────────────────── */}
          {sessionState.phase === 'idle' && (
            <View style={styles.idleContent}>
              <TouchableOpacity style={styles.micButton} onPress={startListening} activeOpacity={0.8}>
                <FontAwesomeIcon icon={faMicrophone} size={32} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.hintText}>Tap to start listening</Text>

              <View style={styles.commandList}>
                {[
                  { label: 'Add item',       example: '"Add drill to Garage"',               color: '#6b9e7a' },
                  { label: 'Add multiple',   example: '"Add pen and ruler and eraser to Office"', color: '#6b9e7a' },
                  { label: 'Move item',      example: '"Move scissors to Kitchen"',           color: '#6b7f99' },
                  { label: 'Find item',      example: '"Where is my charger?"',               color: '#6b7f99' },
                  { label: 'Lend item',      example: '"Lend drill to John"',                 color: '#8b6db8' },
                  { label: 'Mark returned',  example: '"Drill is back"',                      color: '#8b6db8' },
                  { label: 'New space',      example: '"Create space Tool Shed"',             color: '#c08b4a' },
                  { label: 'New container',  example: '"New shelf in Garage"',                color: '#c08b4a' },
                ].map(({ label, example, color }) => (
                  <View key={label} style={styles.commandRow}>
                    <View style={[styles.commandBadge, { backgroundColor: `${color}22` }]}>
                      <Text style={[styles.commandLabel, { color }]}>{label}</Text>
                    </View>
                    <Text style={styles.commandExample}>{example}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── LISTENING ────────────────────────────────────── */}
          {sessionState.phase === 'listening' && (
            <View style={styles.centeredContent}>
              <View style={styles.listeningRing}>
                <View style={styles.micButtonActive}>
                  <FontAwesomeIcon icon={faMicrophone} size={32} color="#fff" />
                </View>
              </View>
              <Text style={styles.listeningText}>Listening…</Text>
              <Text style={styles.hintText}>Speak clearly, up to 10 seconds</Text>
              <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
                <Text style={styles.cancelLinkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── PROCESSING ───────────────────────────────────── */}
          {sessionState.phase === 'processing' && (
            <View style={styles.centeredContent}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={styles.hintText}>Processing…</Text>
            </View>
          )}

          {/* ── NEEDS PERMISSION ─────────────────────────────── */}
          {sessionState.phase === 'needs-permission' && (
            <View style={styles.guideCard}>
              <View style={[styles.guideIconCircle, { backgroundColor: `${PRIMARY}18` }]}>
                <FontAwesomeIcon icon={faMicrophone} size={28} color={PRIMARY} />
              </View>
              <Text style={[styles.guideTitle, { color: isDark ? '#ffffff' : '#1a1a1a' }]}>
                Microphone access needed
              </Text>
              <Text style={styles.guideBody}>
                Synop needs microphone access to hear your voice commands. Tap below to open Settings and enable it.
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openSettings()}>
                <Text style={styles.primaryButtonText}>Open Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
                <Text style={styles.cancelLinkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── NEEDS INSTALL ────────────────────────────────── */}
          {sessionState.phase === 'needs-install' && (
            <View style={styles.guideCard}>
              <View style={[styles.guideIconCircle, { backgroundColor: `${PRIMARY}18` }]}>
                <FontAwesomeIcon icon={faMicrophone} size={28} color={PRIMARY} />
              </View>
              <Text style={[styles.guideTitle, { color: isDark ? '#ffffff' : '#1a1a1a' }]}>
                Speech recognition not available
              </Text>
              <Text style={styles.guideBody}>
                Voice input requires{' '}
                <Text style={{ fontWeight: '700' }}>Speech Recognition &amp; Synthesis</Text>{' '}
                to be installed on your device.
              </Text>
              <View style={styles.guideSteps}>
                <Text style={styles.guideStep}>1. Open the Play Store</Text>
                <Text style={styles.guideStep}>2. Search “Speech Recognition &amp; Synthesis”</Text>
                <Text style={styles.guideStep}>3. Install or update, then come back</Text>
              </View>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => Linking.openURL('https://play.google.com/store/search?q=Speech+Recognition+%26+Synthesis&c=apps')}
              >
                <Text style={styles.primaryButtonText}>Open Play Store</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
                <Text style={styles.cancelLinkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── NEEDS LANGUAGE ──────────────────────────────── */}
          {sessionState.phase === 'needs-language' && (
            <View style={styles.guideCard}>
              <View style={[styles.guideIconCircle, { backgroundColor: `${PRIMARY}18` }]}>
                <FontAwesomeIcon icon={faMicrophone} size={28} color={PRIMARY} />
              </View>
              <Text style={[styles.guideTitle, { color: isDark ? '#ffffff' : '#1a1a1a' }]}>
                Voice setup required
              </Text>
              <Text style={styles.guideBody}>
                {'Follow these steps to enable voice input on your device:'}
              </Text>
              <View style={styles.guideSteps}>
                <Text style={styles.guideStep}>{'1. Install \u201cSpeech Recognition & Synthesis\u201d from the Play Store'}</Text>
                <Text style={styles.guideStep}>{'2. Open your device Settings \u2192 Apps'}</Text>
                <Text style={styles.guideStep}>{'3. Find \u201cSpeech Recognition & Synthesis\u201d'}</Text>
                <Text style={styles.guideStep}>{'4. Tap Permissions \u2192 Microphone \u2192 Allow while using'}</Text>
                <Text style={styles.guideStep}>{'5. Come back and tap \u201cTry Again\u201d'}</Text>
              </View>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => Linking.openURL('https://play.google.com/store/search?q=Speech+Recognition+%26+Synthesis&c=apps')}
              >
                <Text style={styles.primaryButtonText}>Open Play Store</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: PRIMARY, marginTop: 0 }]} onPress={handleRetry}>
                <Text style={[styles.primaryButtonText, { color: PRIMARY }]}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
                <Text style={styles.cancelLinkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── ERROR ────────────────────────────────────────── */}
          {sessionState.phase === 'error' && (
            <View style={styles.centeredContent}>
              <View style={[styles.micButton, { backgroundColor: DESTRUCTIVE }]}>
                <FontAwesomeIcon icon={faTimes} size={28} color="#fff" />
              </View>
              <Text style={styles.errorText}>{sessionState.message}</Text>
              {sessionState.transcript ? (
                <Text style={{ color: isDark ? '#8e8e93' : '#666', fontSize: 13, marginTop: 4, marginBottom: 16, textAlign: 'center', fontStyle: 'italic' }}>
                  Heard: "{sessionState.transcript}"
                </Text>
              ) : null}
              <TouchableOpacity style={styles.primaryButton} onPress={handleRetry}>
                <Text style={styles.primaryButtonText}>Try Again</Text>
              </TouchableOpacity>

              {/* Context-aware suggestions based on detected action */}
              <View style={{ marginTop: 24, width: '100%' }}>
                <Text style={{ color: isDark ? '#8e8e93' : '#666', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
                  Try saying something like:
                </Text>
                {(() => {
                  const action = sessionState.detectedAction;
                  if (action === 'lend') return [
                    { text: '"Lend drill to John"', color: '#8b6db8' },
                    { text: '"Loan charger to Sarah"', color: '#8b6db8' },
                    { text: '"Give scissors to Mike"', color: '#8b6db8' },
                    { text: '"Let John borrow my drill"', color: '#8b6db8' },
                  ];
                  if (action === 'return') return [
                    { text: '"Drill is back"', color: '#8b6db8' },
                    { text: '"Return drill"', color: '#8b6db8' },
                    { text: '"Charger returned"', color: '#8b6db8' },
                    { text: '"Got back my scissors"', color: '#8b6db8' },
                  ];
                  if (action === 'move') return [
                    { text: '"Move drill to Garage"', color: '#6b7f99' },
                    { text: '"Move scissors to Kitchen"', color: '#6b7f99' },
                    { text: '"Transfer charger to Bedroom"', color: '#6b7f99' },
                  ];
                  if (action === 'find') return [
                    { text: '"Where is my drill?"', color: '#6b7f99' },
                    { text: '"Find charger"', color: '#6b7f99' },
                    { text: '"Locate my scissors"', color: '#6b7f99' },
                  ];
                  if (action === 'create-space') return [
                    { text: '"Create space Garage"', color: '#c08b4a' },
                    { text: '"New space Kitchen"', color: '#c08b4a' },
                    { text: '"Make room Tool Shed"', color: '#c08b4a' },
                  ];
                  if (action === 'create-container') return [
                    { text: '"New shelf in Garage"', color: '#c08b4a' },
                    { text: '"Create box in Kitchen"', color: '#c08b4a' },
                    { text: '"Add drawer in Bedroom"', color: '#c08b4a' },
                  ];
                  // Default: show all actions (add or unknown)
                  return [
                    { text: '"Add pen to Garage"', color: '#6b9e7a' },
                    { text: '"Lend drill to John"', color: '#8b6db8' },
                    { text: '"Move scissors to Kitchen"', color: '#6b7f99' },
                    { text: '"Where is my charger?"', color: '#6b7f99' },
                    { text: '"Drill is back"', color: '#8b6db8' },
                    { text: '"Create space Tool Shed"', color: '#c08b4a' },
                  ];
                })().map(({ text, color }) => (
                  <Text key={text} style={{ color, fontSize: 14, marginBottom: 8, textAlign: 'center' }}>{text}</Text>
                ))}
              </View>

              <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
                <Text style={styles.cancelLinkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── CONFIRMING ───────────────────────────────────── */}
          {sessionState.phase === 'confirming' && (() => {
            const { parsed } = sessionState;
            const isMultiAdd = (sessionState.itemNames?.length ?? 0) > 0 || itemNamesOverride.length > 0;
            return (
              <View style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>
                  {parsed.action === 'move' ? 'Confirm move' : isMultiAdd ? 'Confirm items' : 'Confirm item'}
                </Text>

                {/* Item(s) section */}
                {isMultiAdd ? (
                  // Multi-add: show list of items
                  <View>
                    <Text style={styles.fieldLabel} style={{marginBottom: 8}}>Items</Text>
                    {itemNamesOverride.map((name, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: isDark ? '#2c2c2e' : '#f5f5f5', borderRadius: 8 }}>
                        <Text style={{marginRight: 8, fontWeight: 'bold', color: '#999'}}>{idx + 1}.</Text>
                        <TextInput
                          value={name}
                          onChangeText={(text) => {
                            const updated = [...itemNamesOverride];
                            updated[idx] = text;
                            setItemNamesOverride(updated);
                          }}
                          style={{flex: 1, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: isDark ? '#3a3a3c' : '#ffffff', borderRadius: 4, color: isDark ? '#ffffff' : '#000000'}}
                          placeholderTextColor="#999"
                        />
                      </View>
                    ))}
                  </View>
                ) : (
                  // Single item: editable field (same as multi-add items)
                  <View>
                    <Text style={styles.fieldLabel}>Item</Text>
                    <TextInput
                      value={itemNameOverride ?? parsed.itemName ?? ''}
                      onChangeText={(text) => {
                        itemNameRef.current = text;
                        setItemNameOverride(text);
                      }}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        backgroundColor: isDark ? '#3a3a3c' : '#ffffff',
                        borderRadius: 8,
                        color: isDark ? '#ffffff' : '#000000',
                        fontSize: 16,
                        marginBottom: 16,
                      }}
                      placeholder="Item name"
                      placeholderTextColor={isDark ? '#999' : '#ccc'}
                    />
                  </View>
                )}

                {/* Space field */}
                <SpaceField
                  parsed={parsed}
                  confirmedSpaceId={confirmedSpaceId}
                  allSpaces={allSpaces}
                  showPicker={showSpacePicker}
                  onTogglePicker={() => setShowSpacePicker(v => !v)}
                  onAcceptFuzzy={handleAcceptFuzzySpace}
                  onPickSpace={(id) => { setConfirmedSpaceId(id); setShowSpacePicker(false); handleAcceptFuzzySpace(id); }}
                />

                {/* Container field */}
                {parsed.container !== 'absent' || spaceContainers.length > 0 ? (
                  <ContainerField
                    parsed={parsed}
                    confirmedContainerId={confirmedContainerId}
                    spaceContainers={spaceContainers}
                    showPicker={showContainerPicker}
                    onTogglePicker={() => setShowContainerPicker(v => !v)}
                    onAcceptFuzzy={handleAcceptFuzzyContainer}
                    onPickContainer={(id) => { setConfirmedContainerId(id); setShowContainerPicker(false); }}
                    onSkip={() => setConfirmedContainerId(null)}
                  />
                ) : null}

                {/* Actions */}
                <TouchableOpacity
                  style={[styles.primaryButton, !isConfirmEnabled && styles.primaryButtonDisabled]}
                  onPress={handleConfirm}
                  disabled={!isConfirmEnabled}
                >
                  <FontAwesomeIcon icon={faCheck} size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>
                    {parsed.action === 'move' ? 'Move Item' : 'Add Item'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
                  <Text style={styles.secondaryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            );
          })()}

          {/* ── SUCCESS ──────────────────────────────────────── */}
          {sessionState.phase === 'success' && (
            <View style={styles.centeredContent}>
              <View style={[styles.micButton, { backgroundColor: SUCCESS }]}>
                <FontAwesomeIcon icon={faCheck} size={28} color="#fff" />
              </View>
              <Text style={styles.successTitle}>
                {sessionState.action === 'move' ? 'Moved!'
                  : sessionState.action === 'create-space' ? 'Space Created!'
                  : sessionState.action === 'create-container' ? 'Container Created!'
                  : sessionState.action === 'lend' ? 'Lent!'
                  : sessionState.action === 'return' ? 'Returned!'
                  : 'Added!'}
              </Text>
              <Text style={styles.hintText}>{sessionState.itemName}</Text>
              {!!sessionState.location && (
                <Text style={styles.successLocation}>
                  {sessionState.action === 'lend' ? `to ${sessionState.location}`
                    : sessionState.action === 'return' ? `from ${sessionState.location}`
                    : sessionState.location}
                </Text>
              )}
            </View>
          )}

          {/* ── CONFIRMING-RETURN ────────────────────────────── */}
          {sessionState.phase === 'confirming-return' && (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Mark as returned</Text>

              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>Item</Text>
                <Text style={styles.fieldValue}>{sessionState.itemName}</Text>
              </View>

              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>Borrowed by</Text>
                <Text style={[styles.fieldValue, { color: '#9b72cb' }]}>{sessionState.borrowerName}</Text>
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleConfirmReturn}>
                <FontAwesomeIcon icon={faCheck} size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Confirm Return</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
                <Text style={styles.secondaryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── CONFIRMING-LEND ──────────────────────────────── */}
          {sessionState.phase === 'confirming-lend' && (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Lend item</Text>

              {/* Item */}
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>Item</Text>
                {lendMatchedItem ? (
                  <Text style={[styles.fieldValue, { color: SUCCESS }]}>{lendMatchedItem.name}</Text>
                ) : (
                  <Text style={[styles.fieldValue, { color: DESTRUCTIVE }]}>
                    {lendItemOverride || '—'}{'\n'}
                    <Text style={{ fontSize: 12, fontWeight: '400', color: '#8e8e93' }}>
                      Item not found — please add it first
                    </Text>
                  </Text>
                )}
                {lendMatchedItem?.space && (
                  <View style={styles.foundLocationRow}>
                    <FontAwesomeIcon icon={faMapMarkerAlt} size={11} color="#8e8e93" />
                    <Text style={styles.foundLocationText}>
                      {lendMatchedItem.space.name}
                      {lendMatchedItem.container?.name ? ` › ${lendMatchedItem.container.name}` : ''}
                    </Text>
                  </View>
                )}
              </View>

              {/* Borrower */}
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>Borrower</Text>
                <TextInput
                  style={styles.nameInput}
                  value={lendBorrowerOverride}
                  onChangeText={setLendBorrowerOverride}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleConfirmLend}
                  placeholder="Enter borrower name"
                  placeholderTextColor="#a0aec0"
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton,
                  (!lendMatchedItem || !lendBorrowerOverride.trim()) && styles.primaryButtonDisabled]}
                onPress={handleConfirmLend}
                disabled={!lendMatchedItem || !lendBorrowerOverride.trim()}
              >
                <FontAwesomeIcon icon={faCheck} size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Lend Item</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
                <Text style={styles.secondaryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── CONFIRMING-CONTAINER ────────────────────────── */}
          {sessionState.phase === 'confirming-container' && (() => {
            const { spaceResult } = sessionState;
            return (
              <View style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>Create container</Text>

                {/* Container name */}
                <View style={styles.fieldSection}>
                  <Text style={styles.fieldLabel}>Container name</Text>
                  <TextInput
                    style={styles.nameInput}
                    value={containerNameOverride}
                    onChangeText={setContainerNameOverride}
                    autoFocus
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>

                {/* Space picker */}
                <View style={styles.fieldSection}>
                  <Text style={styles.fieldLabel}>Space</Text>

                  {confirmedContainerSpaceId ? (
                    <Text style={[styles.fieldValue, { color: SUCCESS }]}>
                      {allSpaces.find(s => s.id === confirmedContainerSpaceId)?.name}
                    </Text>
                  ) : (
                    <>
                      {spaceResult.status === 'fuzzy' && !showContainerSpacePicker && (
                        <View>
                          <Text style={styles.didYouMeanLabel}>Did you mean:</Text>
                          {spaceResult.candidates.map(s => (
                            <TouchableOpacity key={s.id} style={styles.suggestionRow}
                              onPress={() => { setConfirmedContainerSpaceId(s.id); }}>
                              <Text style={styles.suggestionText}>{s.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      <TouchableOpacity style={styles.pickerToggle}
                        onPress={() => setShowContainerSpacePicker(v => !v)}>
                        <Text style={[styles.pickerToggleText,
                          spaceResult.status === 'none' && { color: DESTRUCTIVE }]}>
                          {spaceResult.status === 'none' && (spaceResult as any).spoken
                            ? `"${(spaceResult as any).spoken}" not found — select space`
                            : 'Select a space'}
                        </Text>
                        <FontAwesomeIcon icon={faChevronDown} size={12} color={spaceResult.status === 'none' ? DESTRUCTIVE : PRIMARY} />
                      </TouchableOpacity>
                    </>
                  )}

                  {showContainerSpacePicker && (
                    <View style={styles.pickerList}>
                      {allSpaces.map(s => (
                        <TouchableOpacity key={s.id} style={styles.pickerItem}
                          onPress={() => { setConfirmedContainerSpaceId(s.id); setShowContainerSpacePicker(false); }}>
                          <Text style={styles.pickerItemText}>{s.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton,
                    (!containerNameOverride.trim() || !confirmedContainerSpaceId) && styles.primaryButtonDisabled]}
                  onPress={handleConfirmContainer}
                  disabled={!containerNameOverride.trim() || !confirmedContainerSpaceId}
                >
                  <FontAwesomeIcon icon={faCheck} size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>Create Container</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
                  <Text style={styles.secondaryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            );
          })()}

          {/* ── CONFIRMING-SPACE ───────────────────────── */}
          {sessionState.phase === 'confirming-space' && (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Create space</Text>
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>Space name</Text>
                <TextInput
                  style={styles.nameInput}
                  value={spaceNameOverride}
                  onChangeText={setSpaceNameOverride}
                  autoFocus
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleConfirmSpace}
                />
              </View>
              <TouchableOpacity
                style={[styles.primaryButton, !spaceNameOverride.trim() && styles.primaryButtonDisabled]}
                onPress={handleConfirmSpace}
                disabled={!spaceNameOverride.trim()}
              >
                <FontAwesomeIcon icon={faCheck} size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Create Space</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
                <Text style={styles.secondaryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── FOUND (search results) ───────────────────────── */}
          {sessionState.phase === 'found' && (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>
                {sessionState.items.length === 1 ? 'Item found' : `${sessionState.items.length} items found`}
              </Text>
              {sessionState.items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.foundItemRow}
                  onPress={() => {
                    onClose();
                    setSessionState({ phase: 'idle' });
                    onNavigateToItem?.(item.id);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldValue}>{item.name}</Text>
                    <View style={styles.foundLocationRow}>
                      <FontAwesomeIcon icon={faMapMarkerAlt} size={11} color="#8e8e93" />
                      <Text style={styles.foundLocationText}>
                        {item.space?.name ?? 'Unknown space'}
                        {item.container?.name ? ` › ${item.container.name}` : ''}
                      </Text>
                    </View>
                  </View>
                  <FontAwesomeIcon icon={faChevronDown} size={12} color={PRIMARY} style={{ transform: [{ rotate: '-90deg' }] }} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
                <Text style={styles.secondaryButtonText}>Search Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
                <Text style={styles.cancelLinkText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface SpaceFieldProps {
  parsed: ParsedVoiceCommand;
  confirmedSpaceId: string | null;
  allSpaces: Space[];
  showPicker: boolean;
  onTogglePicker: () => void;
  onAcceptFuzzy: (id: string) => void;
  onPickSpace: (id: string) => void;
}

function SpaceField({
  parsed, confirmedSpaceId, allSpaces, showPicker, onTogglePicker, onAcceptFuzzy, onPickSpace,
}: SpaceFieldProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = buildStyles(isDark);
  const { space } = parsed;
  const isResolved = !!confirmedSpaceId;
  const resolvedSpace = allSpaces.find(s => s.id === confirmedSpaceId);

  return (
    <View style={styles.fieldSection}>
      <Text style={styles.fieldLabel}>Space</Text>

      {/* Exact match */}
      {isResolved && space.status === 'exact' && (
        <Text style={[styles.fieldValue, { color: SUCCESS }]}>{resolvedSpace?.name}</Text>
      )}

      {/* Fuzzy — show suggestions */}
      {!isResolved && space.status === 'fuzzy' && (
        <View>
          <Text style={styles.didYouMeanLabel}>Did you mean:</Text>
          {space.candidates.map(s => (
            <TouchableOpacity key={s.id} style={styles.suggestionRow} onPress={() => onAcceptFuzzy(s.id)}>
              <Text style={styles.suggestionText}>{s.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.pickerToggle} onPress={onTogglePicker}>
            <Text style={styles.pickerToggleText}>Choose from list</Text>
            <FontAwesomeIcon icon={faChevronDown} size={12} color={PRIMARY} />
          </TouchableOpacity>
        </View>
      )}

      {/* Fuzzy match resolved */}
      {isResolved && space.status === 'fuzzy' && (
        <Text style={[styles.fieldValue, { color: SUCCESS }]}>{resolvedSpace?.name}</Text>
      )}

      {/* Not found / no space spoken */}
      {!isResolved && (space.status === 'none') && (
        <TouchableOpacity style={styles.pickerToggle} onPress={onTogglePicker}>
          <Text style={[styles.pickerToggleText, { color: DESTRUCTIVE }]}>
            {(space as { spoken?: string }).spoken
              ? `"${(space as { spoken: string }).spoken}" not found — select space`
              : 'Select a space'}
          </Text>
          <FontAwesomeIcon icon={faChevronDown} size={12} color={DESTRUCTIVE} />
        </TouchableOpacity>
      )}

      {/* Picker list */}
      {showPicker && (
        <View style={styles.pickerList}>
          {allSpaces.map(s => (
            <TouchableOpacity key={s.id} style={styles.pickerItem} onPress={() => onPickSpace(s.id)}>
              <Text style={styles.pickerItemText}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

interface ContainerFieldProps {
  parsed: ParsedVoiceCommand;
  confirmedContainerId: string | null | undefined;
  spaceContainers: Container[];
  showPicker: boolean;
  onTogglePicker: () => void;
  onAcceptFuzzy: (id: string) => void;
  onPickContainer: (id: string) => void;
  onSkip: () => void;
}

function ContainerField({
  parsed, confirmedContainerId, spaceContainers, showPicker, onTogglePicker, onAcceptFuzzy, onPickContainer, onSkip,
}: ContainerFieldProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = buildStyles(isDark);
  const container = parsed.container;
  const isResolved = confirmedContainerId !== undefined && confirmedContainerId !== null;
  const isSkipped = confirmedContainerId === null;
  const resolvedContainer = spaceContainers.find(c => c.id === confirmedContainerId);

  // If space has no containers and user didn't mention one, hide the field
  if (container === 'absent' && spaceContainers.length === 0) return null;

  return (
    <View style={styles.fieldSection}>
      <Text style={styles.fieldLabel}>Container</Text>

      {/* Exact match */}
      {container !== 'absent' && container.status === 'exact' && (
        <Text style={[styles.fieldValue, { color: SUCCESS }]}>{resolvedContainer?.name ?? container.record.name}</Text>
      )}

      {/* Fuzzy suggestions */}
      {container !== 'absent' && container.status === 'fuzzy' && !isResolved && !isSkipped && (
        <View>
          <Text style={styles.didYouMeanLabel}>Did you mean:</Text>
          {container.candidates.map(c => (
            <TouchableOpacity key={c.id} style={styles.suggestionRow} onPress={() => onAcceptFuzzy(c.id)}>
              <Text style={styles.suggestionText}>{c.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.pickerToggle} onPress={onTogglePicker}>
            <Text style={styles.pickerToggleText}>Choose from list</Text>
            <FontAwesomeIcon icon={faChevronDown} size={12} color={PRIMARY} />
          </TouchableOpacity>
        </View>
      )}

      {/* Fuzzy resolved */}
      {isResolved && container !== 'absent' && container.status !== 'exact' && (
        <Text style={[styles.fieldValue, { color: SUCCESS }]}>{resolvedContainer?.name}</Text>
      )}

      {/* Not found */}
      {container !== 'absent' && container.status === 'none' && !isSkipped && (
        <TouchableOpacity style={styles.pickerToggle} onPress={onTogglePicker}>
          <Text style={[styles.pickerToggleText, { color: DESTRUCTIVE }]}>
            {`"${container.spoken}" not found — select container`}
          </Text>
          <FontAwesomeIcon icon={faChevronDown} size={12} color={DESTRUCTIVE} />
        </TouchableOpacity>
      )}

      {/* Absent: user didn't mention a container but space has some */}
      {container === 'absent' && spaceContainers.length > 0 && !isResolved && !isSkipped && (
        <View>
          <TouchableOpacity style={styles.pickerToggle} onPress={onTogglePicker}>
            <Text style={styles.pickerToggleText}>Select a container (optional)</Text>
            <FontAwesomeIcon icon={faChevronDown} size={12} color={PRIMARY} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onSkip}>
            <Text style={[styles.pickerToggleText, { color: '#8e8e93', marginTop: 4 }]}>Add to space root instead</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Skipped */}
      {isSkipped && (
        <Text style={[styles.fieldValue, { color: '#8e8e93' }]}>None (space root)</Text>
      )}

      {/* Picker list */}
      {showPicker && (
        <View style={styles.pickerList}>
          {spaceContainers.map(c => (
            <TouchableOpacity key={c.id} style={styles.pickerItem} onPress={() => onPickContainer(c.id)}>
              <Text style={styles.pickerItemText}>{c.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.pickerItem} onPress={onSkip}>
            <Text style={[styles.pickerItemText, { color: '#8e8e93' }]}>No container (space root)</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function buildStyles(isDark: boolean) {
  const bg = isDark ? '#000000' : '#f8f9fa';
  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const border = isDark ? '#2c2c2e' : '#e2e6ea';
  const textPrimary = isDark ? '#ffffff' : '#1a1a1a';
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: textPrimary },
  body: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24 },
  centeredContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 40 },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listeningRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: `${PRIMARY}60`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listeningText: { fontSize: 20, fontWeight: '700', color: textPrimary },
  hintText: { fontSize: 14, color: '#8e8e93', textAlign: 'center' },
  exampleText: { fontSize: 13, color: '#a0aec0', textAlign: 'center', fontStyle: 'italic' },
  idleContent: { alignItems: 'center', paddingTop: 8, paddingBottom: 16, width: '100%' },
  commandList: { width: '100%', marginTop: 20, gap: 10 },
  commandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  commandBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, minWidth: 110 },
  commandLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  commandExample: { flex: 1, fontSize: 13, color: '#8e8e93', fontStyle: 'italic' },
  errorText: { fontSize: 16, color: DESTRUCTIVE, textAlign: 'center', fontWeight: '600' },
  successTitle: { fontSize: 22, fontWeight: '700', color: SUCCESS },
  successLocation: { fontSize: 13, color: '#8e8e93' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  primaryButtonDisabled: { opacity: 0.4 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  secondaryButtonText: { fontSize: 15, color: PRIMARY, fontWeight: '500' },
  cancelLink: { paddingVertical: 8 },
  cancelLinkText: { fontSize: 14, color: '#8e8e93' },
  // Confirm card
  confirmCard: { gap: 4 },
  confirmTitle: { fontSize: 20, fontWeight: '700', color: textPrimary, marginBottom: 12 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  fieldSection: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: border },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  fieldValue: { fontSize: 17, fontWeight: '600', color: textPrimary },
  didYouMeanLabel: { fontSize: 13, color: '#8e8e93', marginBottom: 6 },
  suggestionRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: `${PRIMARY}12`,
    marginBottom: 6,
  },
  suggestionText: { fontSize: 15, fontWeight: '600', color: PRIMARY },
  pickerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  pickerToggleText: { fontSize: 14, color: PRIMARY, fontWeight: '500' },
  pickerList: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: border,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: border,
    backgroundColor: cardBg,
  },
  pickerItemText: { fontSize: 15, color: textPrimary },
  // Name input for create-space confirmation
  nameInput: {
    fontSize: 18,
    fontWeight: '600',
    color: textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    paddingVertical: 6,
    marginTop: 4,
  },
  // Found items (search results)
  guideCard: {
    alignItems: 'center',
    paddingTop: 32,
    gap: 12,
  },
  guideIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  guideTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  guideBody: {
    fontSize: 15,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  guideSteps: {
    alignSelf: 'stretch',
    backgroundColor: isDark ? '#1c1c1e' : '#f0f1f3',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  guideStep: {
    fontSize: 14,
    color: isDark ? '#ebebf5cc' : '#374151',
    lineHeight: 20,
  },
  foundItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: cardBg,
    borderWidth: 1,
    borderColor: border,
    marginBottom: 8,
  },
  foundLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  foundLocationText: { fontSize: 13, color: '#8e8e93' },
  });
}
