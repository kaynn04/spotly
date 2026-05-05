# Quickstart: Delete Item Implementation

**Feature**: Delete Item  
**Created**: 2026-05-06

## Overview

Implement permanent delete for items in a space. Users press a delete button, confirm via alert, and the item is removed from the database and UI immediately.

## Step-by-Step Implementation

### Step 1: Add ItemRepository.deleteItem()

**File**: `app/src/repositories/ItemRepository.ts`

**What to Add**:
```typescript
async deleteItem(itemId: string): Promise<void> {
  try {
    const statement = await this.db.prepareAsync(
      'DELETE FROM items WHERE id = ?'
    );
    await statement.executeAsync(itemId);
    await statement.finalizeAsync();
  } catch (error) {
    console.error('Delete item failed:', error);
    throw new ServiceError('DB_ERROR', 'Failed to delete item');
  }
}
```

**Pattern**: Matches existing repository methods (parameterized query, error handling)

### Step 2: Add ItemService.deleteItem()

**File**: `app/src/services/ItemService.ts`

**What to Add**:
```typescript
async deleteItem(itemId: string): Promise<void> {
  try {
    await this.itemRepository.deleteItem(itemId);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error('Delete item failed:', error);
    throw new ServiceError('DB_ERROR', 'Failed to delete item');
  }
}
```

**Pattern**: Pass-through validation (no business logic validation needed for delete)

### Step 3: Add Delete Button to SpaceDetailScreen

**File**: `app/app/space/[id].tsx`

**What to Add**:

1. **Add delete handler function**:
```typescript
function handleDeletePress(itemId: string) {
  Alert.alert(
    'Delete Item',
    'Are you sure? This cannot be undone.',
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
```

2. **Update FlatList renderItem** to include Delete button:
```typescript
renderItem={({ item }) => (
  <View style={styles.itemRow}>
    <Text style={styles.itemName}>{item.name}</Text>
    <Pressable
      style={[styles.button, styles.moveButton]}
      onPress={() => handleMovePress(item.id)}
      disabled={allSpaces.length < 2}
    >
      <Text style={styles.moveButtonText}>Move</Text>
    </Pressable>
    <Pressable
      style={[styles.button, styles.deleteButton]}
      onPress={() => handleDeletePress(item.id)}
    >
      <Text style={styles.deleteButtonText}>Delete</Text>
    </Pressable>
  </View>
)}
```

### Step 4: Add Styles

**File**: `app/app/space/[id].tsx` → StyleSheet.create()

**What to Add**:
```typescript
deleteButton: {
  backgroundColor: '#ff3333',
  paddingVertical: 6,
  paddingHorizontal: 12,
},
deleteButtonText: {
  color: '#fff',
  fontSize: 12,
  fontWeight: '600',
},
```

## Testing Checklist

- [ ] Delete button appears on each item (inline with Move button)
- [ ] Pressing delete shows confirmation alert
- [ ] Pressing "Cancel" closes alert without deleting
- [ ] Pressing "Delete" removes item from database
- [ ] Item immediately disappears from list after deletion
- [ ] Error alert appears if deletion fails
- [ ] Space continues to exist even if all items are deleted
- [ ] App restart shows item is permanently deleted (not in database)

## Common Issues

**Issue**: Delete button doesn't appear
- Check: Make sure handleDeletePress is wired to button onPress
- Check: Make sure deleteButton style is in StyleSheet

**Issue**: Item doesn't disappear after deletion
- Check: Make sure loadItems() is called after successful deletion
- Check: Make sure error is not being silently swallowed

**Issue**: "Failed to delete item" error appears
- Check: Item ID is correct and valid
- Check: Database connection is open
- Check: ServiceError is properly thrown in repository
