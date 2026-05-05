# Quickstart: Implementing Nested Containers

**Feature**: [008-nested-containers](spec.md)  
**Phase**: Phase 1 Design  
**Date**: May 6, 2026  

This document walks through implementation of all MVP tasks with code examples.

---

## Task 1: Create Container Model & Database Migration

### 1.1 Create Container Model

**File**: `app/src/models/Container.ts`

```typescript
/**
 * Container model
 * Represents a logical grouping of items within a space
 */
export interface Container {
  id: string;           // UUID
  spaceId: string;      // Foreign key to Space
  name: string;         // Container name (1-50 characters)
  createdAt: string;    // ISO 8601 timestamp
}

/**
 * Database row type for Container
 * (same as Container for this entity - no normalization needed)
 */
export type ContainerRow = Container;
```

### 1.2 Database Migration

**File**: `app/src/db/migrations.ts` (add to existing migrations)

```typescript
/**
 * Migration: Add containers table and containerId to items
 * Executed during database initialization if not already present
 */
export async function createContainersTable(db: SQLiteDatabase): Promise<void> {
  try {
    // Create containers table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS containers (
        id TEXT PRIMARY KEY,
        spaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (spaceId) REFERENCES spaces(id)
      );
      CREATE INDEX IF NOT EXISTS idx_containers_spaceId ON containers(spaceId);
    `);

    // Add containerId column to items if it doesn't exist
    await db.execAsync(`
      PRAGMA table_info(items);
    `);

    // Check if column exists before adding (items may already have it)
    const result = await db.getAllAsync('PRAGMA table_info(items)');
    const hasContainerId = (result as any[]).some((col: any) => col.name === 'containerId');

    if (!hasContainerId) {
      await db.execAsync(`
        ALTER TABLE items ADD COLUMN containerId TEXT NULLABLE;
        CREATE INDEX idx_items_containerId ON items(containerId);
      `);
    }

    console.log('Containers table and schema updated successfully');
  } catch (error) {
    console.error('Failed to create containers table:', error);
    throw error;
  }
}

// Call this in your database initialization function:
// export async function initializeDatabase(): Promise<void> {
//   const db = getDatabase();
//   await createContainersTable(db);
//   // ... other migrations
// }
```

---

## Task 2: ContainerRepository & Database Methods

**File**: `app/src/repositories/ContainerRepository.ts` (NEW)

```typescript
import { getDatabase, SQLiteDatabase } from '../db/client';
import type { ContainerRow } from '../models/Container';

export class ContainerRepository {
  /**
   * Create a new container
   *
   * @param spaceId - ID of space to create container in
   * @param name - Container name
   * @returns Container ID (UUID)
   * @throws Error if insert fails
   */
  static async createContainer(
    spaceId: string,
    name: string
  ): Promise<string> {
    const db = getDatabase();
    const containerId = crypto.randomUUID();

    try {
      await db.runAsync(
        `INSERT INTO containers (id, spaceId, name, createdAt)
         VALUES (?, ?, ?, ?)`,
        [containerId, spaceId, name, new Date().toISOString()]
      );
      return containerId;
    } catch (error) {
      console.error('Failed to create container:', error);
      throw error;
    }
  }

  /**
   * Get all containers for a space
   *
   * @param spaceId - ID of space
   * @returns Array of containers
   */
  static async getContainersBySpaceId(
    spaceId: string
  ): Promise<ContainerRow[]> {
    const db = getDatabase();

    try {
      const result = await db.getAllAsync<ContainerRow>(
        `SELECT id, spaceId, name, createdAt
         FROM containers
         WHERE spaceId = ?
         ORDER BY createdAt ASC`,
        [spaceId]
      );
      return result || [];
    } catch (error) {
      console.error('Failed to fetch containers:', error);
      throw error;
    }
  }

  /**
   * Get items in a container
   *
   * @param containerId - ID of container
   * @returns Array of item IDs in container
   */
  static async getItemsByContainerId(
    containerId: string
  ): Promise<Array<{ id: string; name: string; containerId: string }>> {
    const db = getDatabase();

    try {
      const result = await db.getAllAsync<{
        id: string;
        name: string;
        containerId: string;
      }>(
        `SELECT id, name, containerId
         FROM items
         WHERE containerId = ?
         ORDER BY createdAt ASC`,
        [containerId]
      );
      return result || [];
    } catch (error) {
      console.error('Failed to fetch container items:', error);
      throw error;
    }
  }

  /**
   * Get space-level items (no container)
   *
   * @param spaceId - ID of space
   * @returns Array of space-level items
   */
  static async getSpaceLevelItems(
    spaceId: string
  ): Promise<Array<{ id: string; name: string }>> {
    const db = getDatabase();

    try {
      const result = await db.getAllAsync<{
        id: string;
        name: string;
      }>(
        `SELECT id, name
         FROM items
         WHERE spaceId = ? AND containerId IS NULL
         ORDER BY createdAt ASC`,
        [spaceId]
      );
      return result || [];
    } catch (error) {
      console.error('Failed to fetch space-level items:', error);
      throw error;
    }
  }
}
```

---

## Task 3: ContainerService with Validation

**File**: `app/src/services/ContainerService.ts` (NEW)

```typescript
import { ContainerRepository } from '../repositories/ContainerRepository';
import type { Container } from '../models/Container';

interface ServiceError {
  code: string;
  message: string;
}

export class ContainerService {
  /**
   * Create a new container
   *
   * @param spaceId - ID of space
   * @param name - Container name (validated: 1-50 chars, not empty)
   * @returns Created container
   * @throws ServiceError on validation or database failure
   */
  static async createContainer(
    spaceId: string,
    name: string
  ): Promise<Container> {
    try {
      // Validation
      if (!name || !name.trim()) {
        throw {
          code: 'VALIDATION_ERROR',
          message: 'Container name cannot be empty.',
        } as ServiceError;
      }

      if (name.trim().length > 50) {
        throw {
          code: 'VALIDATION_ERROR',
          message: 'Container name must be 50 characters or less.',
        } as ServiceError;
      }

      // Create via repository
      const containerId = await ContainerRepository.createContainer(
        spaceId,
        name.trim()
      );

      // Return created container
      return {
        id: containerId,
        spaceId,
        name: name.trim(),
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      // Re-throw if already a ServiceError
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }
      // Convert other errors to ServiceError
      console.error('Error creating container:', error);
      throw {
        code: 'DB_ERROR',
        message: 'Failed to create container. Please try again.',
      } as ServiceError;
    }
  }

  /**
   * Get all containers for a space
   *
   * @param spaceId - ID of space
   * @returns Array of containers
   * @throws ServiceError on database failure
   */
  static async getContainersBySpaceId(spaceId: string): Promise<Container[]> {
    try {
      return await ContainerRepository.getContainersBySpaceId(spaceId);
    } catch (error) {
      console.error('Error fetching containers:', error);
      throw {
        code: 'DB_ERROR',
        message: 'Failed to load containers.',
      } as ServiceError;
    }
  }
}
```

---

## Task 4: ItemService Update for Container Support

**File**: `app/src/services/ItemService.ts` (MODIFY)

```typescript
// Add this method to existing ItemService class

/**
 * Create item in space or container
 *
 * @param spaceId - ID of space item belongs to
 * @param name - Item name
 * @param containerId - Optional: ID of container (if item is in a container)
 * @returns Created item
 */
static async createItem(
  spaceId: string,
  name: string,
  containerId?: string
): Promise<Item> {
  try {
    // Existing validation
    if (!name || !name.trim()) {
      throw {
        code: 'VALIDATION_ERROR',
        message: 'Item name cannot be empty.',
      } as ServiceError;
    }

    // Create via repository with optional containerId
    const itemId = await ItemRepository.createItem(
      spaceId,
      name.trim(),
      containerId
    );

    return {
      id: itemId,
      spaceId,
      name: name.trim(),
      containerId: containerId || null,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }
    console.error('Error creating item:', error);
    throw {
      code: 'DB_ERROR',
      message: 'Failed to create item. Please try again.',
    } as ServiceError;
  }
}
```

---

## Task 5 & 6: UI Updates - SpaceDetailScreen

**File**: `app/app/space/[id].tsx` (MODIFY)

```typescript
// Add to state
const [containers, setContainers] = useState<Container[]>([]);
const [showAddContainerModal, setShowAddContainerModal] =
  useState<boolean>(false);
const [containerName, setContainerName] = useState<string>('');
const [selectedAddItemContainer, setSelectedAddItemContainer] =
  useState<string | null>(null);

// Add functions
async function loadContainers() {
  if (!space?.id) return;
  try {
    const result = await ContainerService.getContainersBySpaceId(space.id);
    setContainers(result);
  } catch (error) {
    console.error('Failed to load containers:', error);
  }
}

async function handleCreateContainer() {
  if (!space?.id) return;
  if (!containerName.trim()) {
    Alert.alert('Error', 'Container name cannot be empty.');
    return;
  }

  try {
    await ContainerService.createContainer(space.id, containerName);
    setContainerName('');
    setShowAddContainerModal(false);
    await loadContainers();
  } catch (error) {
    console.error('Failed to create container:', error);
    Alert.alert('Error', 'Failed to create container. Please try again.');
  }
}

// Update return JSX:
// Add Containers section before Items section
<View style={styles.containersSection}>
  <View style={styles.sectionHeaderRow}>
    <Text style={styles.sectionHeader}>Containers</Text>
    <Pressable
      style={styles.addContainerButton}
      onPress={() => setShowAddContainerModal(true)}
    >
      <Text style={styles.addButtonText}>+</Text>
    </Pressable>
  </View>

  {containers.map((container) => (
    <View key={container.id} style={styles.containerSection}>
      <Text style={styles.containerName}>{container.name}</Text>
      <Pressable
        style={styles.addItemToContainerButton}
        onPress={() => {
          setSelectedAddItemContainer(container.id);
          setShowAddItemModal(true);
        }}
      >
        <Text style={styles.smallButtonText}>Add Item</Text>
      </Pressable>
      {/* Items in this container render here */}
    </View>
  ))}
</View>

// Add Container Modal
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
        placeholder="Container name"
        value={containerName}
        onChangeText={setContainerName}
        autoFocus={true}
      />
      <View style={styles.modalButtonContainer}>
        <Pressable
          style={[styles.button, styles.addButton]}
          onPress={handleCreateContainer}
        >
          <Text style={styles.addButtonText}>Create</Text>
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
```

---

## Summary of Changes

| File | Type | Change |
|------|------|--------|
| `Container.ts` | NEW | Model type definitions |
| `migrations.ts` | MODIFY | Add containers table + containerId to items |
| `ContainerRepository.ts` | NEW | Database access layer |
| `ContainerService.ts` | NEW | Business logic & validation |
| `ItemService.ts` | MODIFY | Support optional containerId parameter |
| `SpaceDetailScreen.tsx` | MODIFY | UI: containers section, modals, grouped display |

**Estimated Implementation Time**: 2-3 hours for experienced developer
