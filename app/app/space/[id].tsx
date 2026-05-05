/**
 * Space Detail Screen
 *
 * View details for a single space
 * Accessed via /space/[id] dynamic route
 *
 * Implementation: T005 - Display space details in SpaceDetailScreen
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert, Pressable, FlatList, TextInput, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import type { Space } from '../../src/models/Space';
import type { Item } from '../../src/models/Item';
import { SpaceService } from '../../src/services/SpaceService';
import { ItemService } from '../../src/services/ItemService';

export default function SpaceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [space, setSpace] = useState<Space | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [itemName, setItemName] = useState<string>('');
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [showMoveModal, setShowMoveModal] = useState<boolean>(false);
  const [selectedMoveItemId, setSelectedMoveItemId] = useState<string | null>(null);

  // Fetch space details on mount
  useEffect(() => {
    loadSpace();
  }, [id]);

  // Refresh items when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (space?.id) {
        loadItems();
      }
    }, [space?.id])
  );

  async function loadSpace() {
    if (!id) return;

    try {
      const result = await SpaceService.getSpaceById(id);
      setSpace(result);
      if (result?.id) {
        loadItems();
      }
      loadAllSpaces();
    } catch (error) {
      console.error('Failed to load space:', error);
      setSpace(null);
    }
  }

  async function loadItems() {
    if (!id) return;

    try {
      const result = await ItemService.getItemsBySpaceId(id);
      setItems(result);
    } catch (error) {
      console.error('Failed to load items:', error);
      setItems([]);
    }
  }

  async function loadAllSpaces() {
    try {
      const result = await SpaceService.getAllSpaces();
      setAllSpaces(result);
    } catch (error) {
      console.error('Failed to load spaces:', error);
      setAllSpaces([]);
    }
  }

  function handleMovePress(itemId: string) {
    setSelectedMoveItemId(itemId);
    setShowMoveModal(true);
  }

  async function handleSelectTargetSpace(targetSpaceId: string) {
    if (!selectedMoveItemId || !space) return;

    try {
      await ItemService.moveItem(selectedMoveItemId, space.id, targetSpaceId);
      setShowMoveModal(false);
      setSelectedMoveItemId(null);
      // Refresh items from current space
      await loadItems();
    } catch (error) {
      console.error('Failed to move item:', error);
      Alert.alert('Error', 'Failed to move item. Please try again.');
    }
  }

  function handleDeleteItemPress(itemId: string, itemName: string) {
    // Show confirmation dialog
    Alert.alert(
      'Delete Item',
      `Delete '${itemName}'? This cannot be undone.`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => await deleteItem(itemId),
          style: 'destructive',
        },
      ]
    );
  }

  async function deleteItem(itemId: string) {
    try {
      await ItemService.deleteItem(itemId);
      await loadItems(); // Refresh list
    } catch (error) {
      console.error('Failed to delete item:', error);
      Alert.alert('Error', 'Failed to delete item. Please try again.');
    }
  }

  function handleDeletePress() {
    if (!space) return;

    // Show confirmation dialog
    Alert.alert(
      'Delete Space',
      `Delete '${space.name}'? This cannot be undone.`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Delete',
          onPress: () => deleteSpace(),
          style: 'destructive',
        },
      ]
    );
  }

  async function deleteSpace() {
    if (!id) return;

    try {
      await SpaceService.deleteSpace(id);
      // Navigate back to space list after successful deletion
      router.back();
    } catch (error) {
      console.error('Failed to delete space:', error);
      Alert.alert('Error', 'Failed to delete space. Please try again.');
    }
  }

  async function handleAddItem() {
    if (!id) return;

    if (!itemName.trim()) {
      Alert.alert('Error', 'Item name cannot be empty.');
      return;
    }

    try {
      await ItemService.createItem(id, itemName);
      setItemName('');
      await loadItems();
    } catch (error) {
      console.error('Failed to add item:', error);
      Alert.alert('Error', 'Failed to add item. Please try again.');
    }
  }

  return (
    <View style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <Button title="Back" onPress={() => router.back()} />
        <Text style={styles.title}>Space Detail</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {space ? (
          <>
            <Text style={styles.name}>{space.name}</Text>
            <Text style={styles.label}>Created:</Text>
            <Text style={styles.value}>
              {new Date(space.createdAt).toLocaleDateString()}
            </Text>

            {/* Delete Button */}
            <Pressable
              style={[styles.button, styles.deleteButton]}
              onPress={handleDeletePress}
            >
              <Text style={styles.deleteButtonText}>Delete Space</Text>
            </Pressable>

            {/* Items List */}
            <Text style={styles.itemsHeader}>Items:</Text>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Pressable
                    style={[
                      styles.button,
                      styles.moveButton,
                      allSpaces.length < 2 && styles.disabledButton,
                    ]}
                    onPress={() => handleMovePress(item.id)}
                    disabled={allSpaces.length < 2}
                  >
                    <Text style={styles.moveButtonText}>Move</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.button, styles.deleteItemButton]}
                    onPress={() => handleDeleteItemPress(item.id, item.name)}
                  >
                    <Text style={styles.deleteItemButtonText}>Delete</Text>
                  </Pressable>
                </View>
              )}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={styles.noItems}>No items yet</Text>
              }
            />

            {/* Add Item Input */}
            <View style={styles.addItemContainer}>
              <TextInput
                style={styles.itemInput}
                placeholder="Enter item name"
                value={itemName}
                onChangeText={setItemName}
                placeholderTextColor="#999"
              />
              <Pressable
                style={[styles.button, styles.addButton]}
                onPress={handleAddItem}
              >
                <Text style={styles.addButtonText}>Add Item</Text>
              </Pressable>
            </View>

            {/* Move Item Modal */}
            <Modal
              visible={showMoveModal}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowMoveModal(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Move to space</Text>
                  
                  <FlatList
                    data={allSpaces.filter((s) => s.id !== space?.id)}
                    keyExtractor={(s) => s.id}
                    renderItem={({ item: targetSpace }) => (
                      <Pressable
                        style={styles.spaceOption}
                        onPress={() => handleSelectTargetSpace(targetSpace.id)}
                      >
                        <Text style={styles.spaceOptionText}>{targetSpace.name}</Text>
                      </Pressable>
                    )}
                    scrollEnabled={true}
                  />

                  <Pressable
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => setShowMoveModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          </>
        ) : (
          <Text style={styles.notFound}>Space not found</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  notFound: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  deleteButton: {
    backgroundColor: '#ff4444',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  itemsHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
  },
  itemName: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    marginBottom: 8,
  },
  noItems: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  moveButton: {
    backgroundColor: '#4444ff',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  moveButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
    opacity: 0.5,
  },
  addItemContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  itemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#4444ff',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  spaceOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    marginBottom: 8,
  },
  spaceOptionText: {
    fontSize: 14,
    color: '#333',
  },
  cancelButton: {
    backgroundColor: '#999',
    marginTop: 16,
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteItemButton: {
    backgroundColor: '#ff3333',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  deleteItemButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
