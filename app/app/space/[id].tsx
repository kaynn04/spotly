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
  const [showAddItemModal, setShowAddItemModal] = useState<boolean>(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState<boolean>(false);

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
      setShowAddItemModal(false);
      await loadItems();
    } catch (error) {
      console.error('Failed to add item:', error);
      Alert.alert('Error', 'Failed to add item. Please try again.');
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Button title="Back" onPress={() => router.back()} />
        <Text style={styles.title}>Space Detail</Text>
        <Pressable 
          style={styles.headerMenuButton}
          onPress={() => setShowHeaderMenu(true)}
        >
          <Text style={styles.headerMenuText}>⋮</Text>
        </Pressable>
      </View>

      {/* Main Content - Full Height */}
      <View style={styles.contentWrapper}>
        {space ? (
          <>
            {/* Fixed Top Section */}
            <View style={styles.fixedSection}>
              {/* Space Title */}
              <View style={styles.titleSection}>
                <Text style={styles.spaceName}>{space.name}</Text>
                <Text style={styles.createdDate}>
                  Created {new Date(space.createdAt).toLocaleDateString()}
                </Text>
              </View>

              {/* Section Header */}
              <Text style={styles.itemsHeader}>Items</Text>
            </View>

            {/* Scrollable Items List */}
            <FlatList
              style={styles.itemsList}
              contentContainerStyle={styles.itemsListContent}
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.itemCard}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <View style={styles.itemActions}>
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
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyState}>No items yet</Text>
              }
              scrollEnabled={true}
            />

            {/* Floating Action Button (FAB) */}
            <Pressable
              style={styles.fab}
              onPress={() => setShowAddItemModal(true)}
            >
              <Text style={styles.fabText}>+</Text>
            </Pressable>

            {/* Modal for Moving Items */}
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

            {/* Header Menu Modal */}
            <Modal
              visible={showHeaderMenu}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowHeaderMenu(false)}
            >
              <Pressable 
                style={styles.modalOverlay}
                onPress={() => setShowHeaderMenu(false)}
              >
                <View style={styles.headerMenuContent}>
                  <Pressable
                    style={styles.headerMenuOption}
                    onPress={() => {
                      setShowHeaderMenu(false);
                      handleDeletePress();
                    }}
                  >
                    <Text style={styles.headerMenuOptionText}>Delete Space</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Modal>

            {/* Modal for Adding Item with Input */}
            <Modal
              visible={showAddItemModal}
              transparent={true}
              animationType="slide"
              onRequestClose={() => {
                setShowAddItemModal(false);
                setItemName('');
              }}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Add Item</Text>
                  <TextInput
                    style={styles.itemInput}
                    placeholder="Enter item name"
                    value={itemName}
                    onChangeText={setItemName}
                    placeholderTextColor="#999"
                    autoFocus={true}
                  />
                  <View style={styles.modalButtonContainer}>
                    <Pressable
                      style={[styles.button, styles.addButton]}
                      onPress={handleAddItem}
                    >
                      <Text style={styles.addButtonText}>Add Item</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.button, styles.cancelButton]}
                      onPress={() => {
                        setShowAddItemModal(false);
                        setItemName('');
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </Pressable>
                  </View>
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
  headerMenuButton: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  headerMenuText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  contentWrapper: {
    flex: 1,
    flexDirection: 'column',
    position: 'relative',
  },
  fixedSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  titleSection: {
    marginBottom: 20,
  },
  spaceName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
  },
  createdDate: {
    fontSize: 14,
    color: '#888',
    fontWeight: '400',
  },
  itemsHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    marginTop: 8,
  },
  itemsList: {
    flex: 1,
  },
  itemsListContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 100,
  },
  itemCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  itemName: {
    fontSize: 15,
    color: '#333',
    marginBottom: 10,
    fontWeight: '500',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  emptyState: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 48,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveButton: {
    backgroundColor: '#4444ff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    flex: 0,
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
  deleteItemButton: {
    backgroundColor: '#ff3333',
    paddingVertical: 6,
    paddingHorizontal: 12,
    flex: 0,
  },
  deleteItemButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4444ff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
    lineHeight: 40,
  },
  itemInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#4444ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  notFound: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 24,
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
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxHeight: '65%',
  },
  headerMenuContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 60,
    marginRight: 16,
    width: 150,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  headerMenuOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerMenuOptionText: {
    fontSize: 14,
    color: '#ff3333',
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#222',
  },
  spaceOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 10,
  },
  spaceOptionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
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
});
