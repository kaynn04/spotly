# Quickstart: Dashboard Navigation Implementation

**Feature**: Feature 008 - Dashboard Navigation Structure  
**Phase**: 1 (Implementation Walkthrough)  
**Time Estimate**: ~4-6 hours for core implementation

## Quick Overview

This feature refactors the app from a single-screen interface to a multi-tab dashboard using Expo Router's built-in tabs layout. The implementation is straightforward:

1. Create tab routing structure with Expo Router
2. Create home dashboard screen
3. Move spaces feature into a tab
4. Add placeholder screens for Lending/Outside
5. Ensure back button from nested views returns to Spaces tab

**No database changes. No service rewrites. No component redesigns.**

---

## Step-by-Step Implementation Path

### Step 1: Create Tab Layout (15 min)

**File**: `app/(tabs)/_layout.tsx`

```typescript
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarPosition: 'bottom',
        tabBarStyle: {
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarActiveTintColor: '#0a84ff',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
      }}
    >
      {/* Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>🏠</Text>,
        }}
      />

      {/* Spaces Tab */}
      <Tabs.Screen
        name="spaces"
        options={{
          title: 'Spaces',
          tabBarLabel: 'Spaces',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>📚</Text>,
        }}
      />

      {/* Lending Tab */}
      <Tabs.Screen
        name="lending"
        options={{
          title: 'Lending',
          tabBarLabel: 'Lending',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>🤝</Text>,
        }}
      />

      {/* Outside Tab */}
      <Tabs.Screen
        name="outside"
        options={{
          title: 'Outside',
          tabBarLabel: 'Outside',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>🧳</Text>,
        }}
      />
    </Tabs>
  );
}
```

**Notes**:
- Tabs positioned at bottom
- Icons use emojis (🏠 📚 🤝 🧳) as per spec clarifications
- Active color blue (#0a84ff), inactive gray (#999)
- Screen names correspond to file names

---

### Step 2: Create Home Dashboard Screen (45 min)

**File**: `app/(tabs)/index.tsx`

```typescript
import { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, FlatList, StyleSheet, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DashboardService from '@/src/services/DashboardService';

export default function HomeScreen() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(() => {
    loadDashboard();
  });

  async function loadDashboard() {
    try {
      setLoading(true);
      const data = await DashboardService.getFullDashboard();
      setDashboard(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!dashboard || dashboard.isEmpty) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No spaces yet</Text>
          <Text style={styles.emptySubtext}>Create one to get started!</Text>
          <Text style={styles.emptyHint}>Tap the "Spaces" tab to begin</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
      </View>

      <FlatList
        data={[
          { id: 'stats', type: 'stats' },
          { id: 'recent', type: 'recent' },
        ]}
        renderItem={({ item }) => {
          if (item.type === 'stats') {
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Statistics</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{dashboard.stats.totalItems}</Text>
                    <Text style={styles.statLabel}>Items</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{dashboard.stats.totalSpaces}</Text>
                    <Text style={styles.statLabel}>Spaces</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{dashboard.stats.totalContainers}</Text>
                    <Text style={styles.statLabel}>Containers</Text>
                  </View>
                </View>
              </View>
            );
          }

          if (item.type === 'recent') {
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recently Added</Text>
                {dashboard.recentItems.length === 0 ? (
                  <Text style={styles.noItems}>No recent items</Text>
                ) : (
                  dashboard.recentItems.map((item) => (
                    <View key={item.id} style={styles.recentItem}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemContext}>• {item.spaceName}</Text>
                    </View>
                  ))
                )}
              </View>
            );
          }

          return null;
        }}
        keyExtractor={(item) => item.id}
        scrollEnabled={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0a84ff',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  recentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
  },
  itemName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  itemContext: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  noItems: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  emptyHint: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});
```

---

### Step 3: Create Spaces Tab (10 min)

**File**: `app/(tabs)/spaces.tsx`

```typescript
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import SpaceScreen from '../(tabs)/index'; // Reuse existing spaces screen

export default function SpacesTab() {
  return <SpaceScreen />;
}
```

**Alternative** (if modifying existing spaces screen):
- Move all space-related logic to this file
- Ensure back button from space detail navigates to this tab (not app root)

---

### Step 4: Create Placeholder Screens (10 min)

**File**: `app/(tabs)/lending.tsx`

```typescript
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';

export default function LendingScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lending</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.placeholder}>🤝</Text>
        <Text style={styles.title}>Coming Soon</Text>
        <Text style={styles.description}>Track items you've lent to others</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    fontSize: 64,
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
});
```

**File**: `app/(tabs)/outside.tsx` (duplicate of lending.tsx with 🧳 icon and "Outside" text)

---

### Step 5: Create DashboardService (30 min)

**File**: `src/services/DashboardService.ts`

```typescript
import ItemService from './ItemService';
import ItemRepository from '../repositories/ItemRepository';
import SpaceRepository from '../repositories/SpaceRepository';
import ContainerRepository from '../repositories/ContainerRepository';

interface DashboardData {
  recentItems: any[];
  stats: {
    totalItems: number;
    totalSpaces: number;
    totalContainers: number;
  };
  isEmpty: boolean;
}

class DashboardService {
  async getRecentItems(limit: number = 5) {
    try {
      return await ItemRepository.getRecentItems(limit);
    } catch (error) {
      console.error('Failed to get recent items:', error);
      return [];
    }
  }

  async getDashboardStats() {
    try {
      const totalItems = await ItemRepository.countItems();
      const totalSpaces = await SpaceRepository.countSpaces();
      const totalContainers = await ContainerRepository.countContainers();

      return {
        totalItems,
        totalSpaces,
        totalContainers,
      };
    } catch (error) {
      console.error('Failed to get dashboard stats:', error);
      return { totalItems: 0, totalSpaces: 0, totalContainers: 0 };
    }
  }

  async getFullDashboard(): Promise<DashboardData> {
    try {
      const recentItems = await this.getRecentItems(5);
      const stats = await this.getDashboardStats();
      const isEmpty = stats.totalSpaces === 0;

      return {
        recentItems,
        stats,
        isEmpty,
      };
    } catch (error) {
      console.error('Failed to get full dashboard:', error);
      return {
        recentItems: [],
        stats: { totalItems: 0, totalSpaces: 0, totalContainers: 0 },
        isEmpty: true,
      };
    }
  }
}

export default new DashboardService();
```

---

### Step 6: Add Repository Methods (20 min)

**Add to ItemRepository.ts**:

```typescript
async getRecentItems(limit: number = 5): Promise<Item[]> {
  try {
    const result = await this.db.getAllAsync(
      `SELECT i.id, i.name, s.name as spaceName, i.created_at
       FROM items i
       JOIN spaces s ON i.space_id = s.id
       ORDER BY i.created_at DESC
       LIMIT ?`,
      [limit]
    );
    return (result as any[]).map(row => ({
      id: row.id,
      name: row.name,
      spaceName: row.spaceName,
      createdAt: new Date(row.created_at),
    }));
  } catch (error) {
    console.error('Failed to get recent items:', error);
    throw error;
  }
}

async countItems(): Promise<number> {
  try {
    const result = await this.db.getFirstAsync(
      `SELECT COUNT(*) as count FROM items`
    );
    return (result as any).count || 0;
  } catch (error) {
    console.error('Failed to count items:', error);
    return 0;
  }
}
```

**Add to SpaceRepository.ts**:

```typescript
async countSpaces(): Promise<number> {
  try {
    const result = await this.db.getFirstAsync(
      `SELECT COUNT(*) as count FROM spaces`
    );
    return (result as any).count || 0;
  } catch (error) {
    console.error('Failed to count spaces:', error);
    return 0;
  }
}
```

**Add to ContainerRepository.ts**:

```typescript
async countContainers(): Promise<number> {
  try {
    const result = await this.db.getFirstAsync(
      `SELECT COUNT(*) as count FROM containers`
    );
    return (result as any).count || 0;
  } catch (error) {
    console.error('Failed to count containers:', error);
    return 0;
  }
}
```

---

### Step 7: Update Root Layout (10 min)

**File**: `app/_layout.tsx`

Verify that the root layout properly wraps the (tabs) group. Example:

```typescript
export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="space/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="container/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
```

---

### Step 8: Fix Back Button Navigation (15 min)

**In space/[id].tsx**:

Ensure back button returns to Spaces tab root, not app root:

```typescript
const handleBackPress = () => {
  // Navigate to spaces tab instead of using router.back()
  router.push('/(tabs)/spaces');
};
```

Similarly for `container/[id].tsx`.

---

## Testing Checklist

- [ ] App opens to Home dashboard by default
- [ ] Home dashboard displays recent items (or empty state if no items)
- [ ] Statistics card shows correct counts
- [ ] Tapping Spaces tab displays spaces list
- [ ] Tapping a space from Spaces tab opens space detail
- [ ] Back button from space detail returns to Spaces tab (not app root)
- [ ] Tapping container detail from space works correctly
- [ ] Back button from container detail returns to Spaces tab
- [ ] Tapping Lending tab shows placeholder
- [ ] Tapping Outside tab shows placeholder
- [ ] Switching between tabs preserves state (scroll position, etc.)
- [ ] All existing space/container/item operations work identically to before

---

## Performance Tips

1. **Memoize Dashboard Components**: Wrap components in React.memo to prevent unnecessary re-renders
2. **Lazy Load Recent Items**: If dashboard takes >1s to load, consider showing stats first, then items
3. **Tab State Caching**: Expo Router preserves tab state; no additional caching needed unless performance issues arise
4. **Pull-to-Refresh**: Consider adding RefreshControl to dashboard for manual refresh

---

## Common Pitfalls

- ❌ Forgetting to set `tabBarPosition: 'bottom'` in TabsLayout options
- ❌ Using `router.back()` from nested views (goes to previous screen, not tab root)
- ❌ Not wrapping recent items query with space join
- ❌ Forgetting to call `useFocusEffect` on home dashboard to reload data
- ❌ Tab names in options don't match file names (e.g., "index" instead of "home")

---

## Estimated Time

| Step | Time |
|------|------|
| 1. Tab layout | 15 min |
| 2. Home dashboard | 45 min |
| 3. Spaces tab | 10 min |
| 4. Placeholder screens | 10 min |
| 5. DashboardService | 30 min |
| 6. Repository methods | 20 min |
| 7. Root layout update | 10 min |
| 8. Back button fix | 15 min |
| **Total** | **~2.5-3 hours core** |
| Testing & polish | +1-2 hours |
| **Overall** | **4-6 hours** |

---

## Next Steps After Implementation

1. Run manual testing on both iOS and Android emulators
2. Verify all existing space/container/item flows still work
3. Test edge cases: empty database, rapid tab switching, backgrounding
4. Performance profiling on home dashboard with 500+ items
5. Code review and cleanup
6. Commit to branch
