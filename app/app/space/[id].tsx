/**
 * Space Detail Screen
 *
 * View details for a single space
 * Accessed via /space/[id] dynamic route
 *
 * Implementation: T005 - Display space details in SpaceDetailScreen
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

export default function SpaceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [space, setSpace] = useState<Space | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [itemName, setItemName] = useState<string>('');
  const [containerName, setContainerName] = useState<string>('');
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [showMoveModal, setShowMoveModal] = useState<boolean>(false);
  const [selectedMoveItemId, setSelectedMoveItemId] = useState<string | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState<boolean>(false);
  const [showAddContainerModal, setShowAddContainerModal] = useState<boolean>(false);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState<boolean>(false);
  const [showFabMenu, setShowFabMenu] = useState<boolean>(false);
  const [selectedItemMenuId, setSelectedItemMenuId] = useState<string | null>(null);

  // Fetch space details on mount
  useEffect(() => {
    loadSpace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Refresh items and containers when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (space?.id) {
        loadItems();
        loadContainers();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function loadContainers() {
    if (!id) return;

    try {
      const result = await ContainerService.getContainersBySpaceId(id);
      setContainers(result);
    } catch (error) {
      console.error('Failed to load containers:', error);
      setContainers([]);
    }
  }

  function handleMovePress(itemId: string) {
    setSelectedMoveItemId(itemId);
    setShowMoveModal(true);
  }

  /**
   * Get items at space level (not in any container)
   */
  function getSpaceLevelItems() {
    return items.filter((item) => !item.containerId);
  }

  /**
   * Navigate to container detail page
   */
  function handleContainerPress(containerId: string) {
    router.push({
      pathname: '../container/[id]',
      params: { id: containerId }
    });
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
      await ItemService.createItem(id, itemName, selectedContainerId);
      setItemName('');
      setShowAddItemModal(false);
      setSelectedContainerId(null);
      await loadItems();
    } catch (error) {
      console.error('Failed to add item:', error);
      Alert.alert('Error', 'Failed to add item. Please try again.');
    }
  }

  function handleFabMenuItemPress() {
    setShowFabMenu(false);
    setSelectedContainerId(null);
    setShowAddItemModal(true);
  }

  function handleFabMenuContainerPress() {
    setShowFabMenu(false);
    setShowAddContainerModal(true);
  }

  async function handleCreateContainer() {
    if (!id || !containerName.trim()) {
      Alert.alert('Error', 'Container name cannot be empty.');
      return;
    }

    try {
      await ContainerService.createContainer(containerName, id);
      setContainerName('');
      setShowAddContainerModal(false);
      await loadContainers();
      await loadItems();
    } catch (error) {
      console.error('Failed to create container:', error);
      if (error && typeof error === 'object' && 'code' in error) {
        const err = error as any;
        Alert.alert('Error', err.message || 'Failed to create container.');
      } else {
        Alert.alert('Error', 'Failed to create container. Please try again.');
      }
    }
  }

  // Build breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = [
    {
      label: '🏠',
      isActive: true,
    },
  ];

  const spaceLevelItems = getSpaceLevelItems();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />

      {/* Header */}
      <View style={styles.header}>
        <Button title="Back" onPress={() => router.back()} />
        <Text style={styles.title}>Space Details</Text>
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
            {/* Fixed Top Section with Space Info */}
            <View style={styles.fixedSection}>
              {/* Space Title */}
              <View style={styles.titleSection}>
                <Text style={styles.spaceName}>{space.name}</Text>
                <Text style={styles.createdDate}>
                  Created {new Date(space.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>

            {/* Breadcrumb Navigation */}
            <View style={styles.breadcrumbSection}>
              <Breadcrumb items={breadcrumbItems} />
            </View>

            {/* Scrollable Containers and Items List */}
            <FlatList
              style={styles.itemsList}
              contentContainerStyle={styles.itemsListContent}
              data={[
                ...containers.map(c => ({ type: 'container' as const, data: c })),
                ...items.map(i => ({ type: 'item' as const, data: i })),
              ]}
              keyExtractor={(item, index) => {
                if ('type' in item) {
                  if (item.type === 'container') return `container-${(item as any).data.id}`;
                  if (item.type === 'item') return `item-${(item as any).data.id}`;
                }
                return String(index);
              }}
              renderItem={({ item }) => {
                if ('type' in item) {
                  const typedItem = item as any;
                  if (typedItem.type === 'container') {
                    const container = typedItem.data as Container;
                    const itemCount = items.filter(i => i.containerId === container.id).length;
                    return (
                      <Pressable
                        style={styles.containerCard}
                        onPress={() => handleContainerPress(container.id)}
                      >
                        <View style={styles.containerHeader}>
                          <View style={styles.containerInfo}>
                            <Text style={styles.containerBadge}>📁 Container</Text>
                            <Text style={styles.containerName}>{container.name}</Text>
                            <Text style={styles.containerItemCount}>
                              {itemCount} {itemCount === 1 ? 'item' : 'items'}
                            </Text>
                          </View>
                          <Text style={styles.containerArrow}>›</Text>
                        </View>
                      </Pressable>
                    );
                  }
                  if (typedItem.type === 'item') {
                    const item = typedItem.data as Item;
                    const container = containers.find(c => c.id === item.containerId);
                    return (
                      <View style={styles.itemCard}>
                        <View style={styles.itemHeader}>
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            {container && (
                              <Text style={styles.itemContainerLabel}>in {container.name}</Text>
                            )}
                          </View>
                          <Pressable
                            style={styles.itemMenu}
                            onPress={() => setSelectedItemMenuId(selectedItemMenuId === item.id ? null : item.id)}
                          >
                            <Text style={styles.itemMenuText}>⋯</Text>
                          </Pressable>
                        </View>
                        {selectedItemMenuId === item.id && (
                          <View style={styles.itemMenuDropdown}>
                            <Pressable
                              style={styles.itemMenuOption}
                              onPress={() => {
                                setSelectedItemMenuId(null);
                                handleMovePress(item.id);
                              }}
                            >
                              <Text style={styles.itemMenuOptionText}>Move</Text>
                            </Pressable>
                            <Pressable
                              style={[styles.itemMenuOption, styles.itemMenuOptionDelete]}
                              onPress={() => {
                                setSelectedItemMenuId(null);
                                handleDeleteItemPress(item.id, item.name);
                              }}
                            >
                              <Text style={styles.itemMenuOptionDeleteText}>Delete</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    );
                  }
                }
                return null;
              }}
              ListEmptyComponent={
                <Text style={styles.emptyState}>No containers or items yet</Text>
              }
              scrollEnabled={true}
            />

            {/* Floating Action Button (FAB) with Menu */}
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
                  onPress={handleFabMenuItemPress}
                >
                  <Text style={styles.fabMenuItemText}>Add Item</Text>
                </Pressable>
                <Pressable
                  style={styles.fabMenuItem}
                  onPress={handleFabMenuContainerPress}
                >
                  <Text style={styles.fabMenuItemText}>Add Container</Text>
                </Pressable>
              </View>
            )}

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

            {/* Modal for Adding Item */}
            <Modal
              visible={showAddItemModal}
              transparent={true}
              animationType="slide"
              onRequestClose={() => {
                setShowAddItemModal(false);
                setItemName('');
                setSelectedContainerId(null);
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
                        setSelectedContainerId(null);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Modal for Adding Container */}
            <Modal
              visible={showAddContainerModal}
              transparent={true}
              animationType="slide"
              onRequestClose={() => {
                setShowAddContainerModal(false);
                setContainerName('');
              }}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Add Container</Text>
                  <TextInput
                    style={styles.itemInput}
                    placeholder="Enter container name"
                    value={containerName}
                    onChangeText={setContainerName}
                    placeholderTextColor="#999"
                    autoFocus={true}
                  />
                  <View style={styles.modalButtonContainer}>
                    <Pressable
                      style={[styles.button, styles.addButton]}
                      onPress={handleCreateContainer}
                    >
                      <Text style={styles.addButtonText}>Add Container</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.button, styles.cancelButton]}
                      onPress={() => {
                        setShowAddContainerModal(false);
                        setContainerName('');
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
    </SafeAreaView>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginHorizontal: 12,
    color: '#333',
  },
  headerMenuButton: {
    padding: 8,
  },
  headerMenuText: {
    fontSize: 20,
    color: '#333',
  },
  contentWrapper: {
    flex: 1,
  },
  fixedSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  titleSection: {
    marginBottom: 8,
  },
  spaceName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  createdDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  breadcrumbWrapper: {
    marginTop: 8,
  },
  breadcrumbSection: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemsList: {
    flex: 1,
  },
  itemsListContent: {
    paddingVertical: 8,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    marginTop: 8,
  },
  containerCard: {
    marginVertical: 4,
    marginHorizontal: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0a84ff',
  },
  containerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  containerInfo: {
    flex: 1,
  },
  containerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a84ff',
    marginBottom: 4,
  },
  containerItemCount: {
    fontSize: 12,
    color: '#666',
  },
  containerArrow: {
    fontSize: 20,
    color: '#999',
    marginLeft: 8,
  },
  containerBadge: {
    fontSize: 11,
    color: '#0a84ff',
    fontWeight: '500',
    marginBottom: 4,
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
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    color: '#333',
  },
  itemContainerLabel: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  itemMenu: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  itemMenuText: {
    fontSize: 18,
    color: '#666',
  },
  itemMenuDropdown: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
  },
  itemMenuOption: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 4,
    backgroundColor: '#f5f5f5',
  },
  itemMenuOptionDelete: {
    backgroundColor: '#ffebee',
  },
  itemMenuOptionText: {
    fontSize: 14,
    color: '#0a84ff',
    fontWeight: '500',
  },
  itemMenuOptionDeleteText: {
    fontSize: 14,
    color: '#d32f2f',
    fontWeight: '500',
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
  emptyState: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginVertical: 32,
  },
  notFound: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginVertical: 32,
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
  itemInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 16,
    color: '#333',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#0a84ff',
  },
  addButtonText: {
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
  headerMenuContent: {
    position: 'absolute',
    top: 60,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  headerMenuOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerMenuOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#d32f2f',
  },
});
