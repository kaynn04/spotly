/**
 * Container Detail Screen
 *
 * View details for a single container
 * Accessed via /container/[id] dynamic route
 * 
 * Displays all items in the container with management options
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert, Pressable, FlatList, TextInput, Modal, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import type { Space } from '../../src/models/Space';
import type { Item } from '../../src/models/Item';
import type { Container } from '../../src/models/Container';
import { SpaceService } from '../../src/services/SpaceService';
import { ItemService } from '../../src/services/ItemService';
import { ContainerService } from '../../src/services/ContainerService';
import { Breadcrumb, type BreadcrumbItem } from '../../components/breadcrumb';

export default function ContainerDetailScreen() {
  const router = useRouter();
  const { id: containerId } = useLocalSearchParams<{ id: string }>();
  
  const [container, setContainer] = useState<Container | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  
  const [itemName, setItemName] = useState<string>('');
  const [showAddItemModal, setShowAddItemModal] = useState<boolean>(false);
  const [showMoveModal, setShowMoveModal] = useState<boolean>(false);
  const [selectedMoveItemId, setSelectedMoveItemId] = useState<string | null>(null);
  const [showFabMenu, setShowFabMenu] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load container details on mount
  useEffect(() => {
    loadContainer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]);

  // Refresh items when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (container?.id) {
        loadItems();
        loadAllSpaces();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [container?.id])
  );

  async function loadContainer() {
    if (!containerId) return;

    try {
      setIsLoading(true);
      const result = await ContainerService.getContainerById(containerId);
      setContainer(result);
      
      if (result?.spaceId) {
        const spaceResult = await SpaceService.getSpaceById(result.spaceId);
        setSpace(spaceResult);
        await loadItems();
      }
      await loadAllSpaces();
    } catch (error) {
      console.error('Failed to load container:', error);
      Alert.alert('Error', 'Failed to load container. Please try again.');
      setContainer(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadItems() {
    if (!containerId) return;

    try {
      const result = await ItemService.getItemsByContainerId(containerId);
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
      // Refresh items from container
      await loadItems();
    } catch (error) {
      console.error('Failed to move item:', error);
      Alert.alert('Error', 'Failed to move item. Please try again.');
    }
  }

  function handleDeleteItemPress(itemId: string, itemName: string) {
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
      await loadItems();
    } catch (error) {
      console.error('Failed to delete item:', error);
      Alert.alert('Error', 'Failed to delete item. Please try again.');
    }
  }

  async function handleAddItem() {
    if (!containerId || !itemName.trim()) {
      Alert.alert('Error', 'Item name cannot be empty.');
      return;
    }

    try {
      // Create item in this container
      if (!space) return;
      await ItemService.createItem(space.id, itemName, containerId);
      setItemName('');
      setShowAddItemModal(false);
      await loadItems();
    } catch (error) {
      console.error('Failed to add item:', error);
      Alert.alert('Error', 'Failed to add item. Please try again.');
    }
  }

  // Build breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = [
    {
      label: '🏠',
      onPress: () => {
        if (space?.id) {
          router.back();
        }
      },
    },
    {
      label: container?.name || 'Loading...',
      isActive: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />

      {/* Main Content */}
      {container && space ? (
        <View style={styles.contentWrapper}>
          {/* Header */}
          <View style={styles.header}>
            <Button title="Back" onPress={() => router.back()} />
            <Text style={styles.title}>Container Details</Text>
            <Text style={styles.itemCount}>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </Text>
          </View>

          {/* Breadcrumb Navigation */}
          <Breadcrumb items={breadcrumbItems} />

          {/* Items List */}
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
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyState}>No items in this container</Text>
                <Pressable
                  style={styles.emptyStateButton}
                  onPress={() => setShowAddItemModal(true)}
                >
                  <Text style={styles.emptyStateButtonText}>+ Add Item</Text>
                </Pressable>
              </View>
            }
            scrollEnabled={true}
          />

          {/* Floating Action Button (FAB) */}
          <Pressable
            style={styles.fab}
            onPress={() => setShowFabMenu(!showFabMenu)}
          >
            <Text style={styles.fabText}>+</Text>
          </Pressable>

          {/* FAB Menu */}
          {showFabMenu && (
            <View style={styles.fabMenu}>
              <Pressable
                style={styles.fabMenuItem}
                onPress={() => {
                  setShowFabMenu(false);
                  setShowAddItemModal(true);
                }}
              >
                <Text style={styles.fabMenuItemText}>Add Item</Text>
              </Pressable>
            </View>
          )}

          {/* Modal for Adding Item */}
          <Modal
            visible={showAddItemModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowAddItemModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Add Item to {container.name}</Text>

                <TextInput
                  style={styles.modalInput}
                  placeholder="Item name"
                  placeholderTextColor="#999"
                  value={itemName}
                  onChangeText={setItemName}
                  maxLength={100}
                />

                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.button, styles.primaryButton]}
                    onPress={handleAddItem}
                  >
                    <Text style={styles.primaryButtonText}>Add Item</Text>
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
        </View>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading container...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginHorizontal: 12,
  },
  itemCount: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  itemsList: {
    flex: 1,
  },
  itemsListContent: {
    paddingVertical: 8,
  },
  itemCard: {
    marginVertical: 4,
    marginHorizontal: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0a84ff',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  moveButton: {
    backgroundColor: '#e3f2fd',
  },
  moveButtonText: {
    color: '#0a84ff',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteItemButton: {
    backgroundColor: '#ffebee',
  },
  deleteItemButtonText: {
    color: '#d32f2f',
    fontSize: 12,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyState: {
    fontSize: 16,
    color: '#999',
    marginBottom: 16,
  },
  emptyStateButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0a84ff',
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0a84ff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
  fabMenu: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  fabMenuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 16,
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#0a84ff',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  spaceOption: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  spaceOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#999',
  },
});
