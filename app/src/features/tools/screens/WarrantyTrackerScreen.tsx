/**
 * WarrantyTrackerScreen
 *
 * Displays all items with warranty dates, grouped by status:
 *   - Expiring Soon (<= 30 days)
 *   - Active
 *   - Expired
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faShield,
  faChevronLeft,
  faChevronRight,
  faTriangleExclamation,
  faCheckCircle,
  faTimesCircle,
} from '@fortawesome/free-solid-svg-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { ItemRepository } from '@/src/repositories/ItemRepository';
import { toWarrantyItem, type WarrantyItem, type WarrantyStatus } from '../models/WarrantyItem';
import type { Item } from '@/src/models/Item';

const WARRANTY_AMBER = '#e09b3a';
const EXPIRED_RED = '#d95e5e';
const ACTIVE_GREEN = '#4caf50';

interface Section {
  title: string;
  status: WarrantyStatus;
  color: string;
  icon: any;
  items: WarrantyItem[];
}

export default function WarrantyTrackerScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();

  const cardBg = isDark ? '#1e2229' : '#f5f5f5';
  const subtleText = isDark ? '#8a95a3' : '#888';
  const borderColor = isDark ? '#2c3340' : '#e0e0e0';

  const [warrantyItems, setWarrantyItems] = useState<WarrantyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        setLoading(true);
        try {
          const repo = new ItemRepository();
          const all: Item[] = await repo.getAll();
          const withWarranty = all
            .filter((i) => !!i.warrantyExpiry)
            .map(toWarrantyItem);
          if (active) {
            setWarrantyItems(withWarranty);
          }
        } catch (e) {
          console.error('[WarrantyTrackerScreen] load error', e);
        } finally {
          if (active) setLoading(false);
        }
      };
      load();
      return () => { active = false; };
    }, [])
  );

  const sections: Section[] = [
    {
      title: 'Expiring Soon',
      status: 'expiring-soon',
      color: WARRANTY_AMBER,
      icon: faTriangleExclamation,
      items: warrantyItems.filter((i) => i.warrantyStatus === 'expiring-soon'),
    },
    {
      title: 'Active',
      status: 'active',
      color: ACTIVE_GREEN,
      icon: faCheckCircle,
      items: warrantyItems.filter((i) => i.warrantyStatus === 'active'),
    },
    {
      title: 'Expired',
      status: 'expired',
      color: EXPIRED_RED,
      icon: faTimesCircle,
      items: warrantyItems.filter((i) => i.warrantyStatus === 'expired'),
    },
  ];

  const renderDays = (item: WarrantyItem) => {
    if (item.warrantyStatus === 'expired') {
      const d = Math.abs(item.daysRemaining);
      return `Expired ${d} day${d !== 1 ? 's' : ''} ago`;
    }
    if (item.daysRemaining === 0) return 'Expires today';
    if (item.daysRemaining === 1) return 'Expires tomorrow';
    return `Expires in ${item.daysRemaining} days`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Back"
        >
          <FontAwesomeIcon icon={faChevronLeft} size={16} color={WARRANTY_AMBER} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Warranty Tracker</Text>
          <Text style={[styles.subtitle, { color: subtleText }]}>Track warranty dates and upcoming expirations</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={WARRANTY_AMBER} />
        </View>
      ) : warrantyItems.length === 0 ? (
        <View style={styles.centered}>
          <FontAwesomeIcon icon={faShield} size={48} color={borderColor} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No warranties tracked</Text>
          <Text style={[styles.emptySubtitle, { color: subtleText }]}>
            Open an item and set its warranty expiry date to track it here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {sections.map((section) => {
            if (section.items.length === 0) return null;
            return (
              <View key={section.status} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <FontAwesomeIcon icon={section.icon} size={14} color={section.color} />
                  <Text style={[styles.sectionTitle, { color: section.color }]}>
                    {section.title}
                  </Text>
                  <Text style={[styles.sectionCount, { color: subtleText }]}>
                    ({section.items.length})
                  </Text>
                </View>
                {section.items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.card, { backgroundColor: cardBg, borderColor }]}
                    activeOpacity={0.75}
                    onPress={() => router.push(`/item/${item.id}` as any)}
                  >
                    <View style={styles.cardLeft}>
                      <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.cardDays, { color: section.color }]}>
                        {renderDays(item)}
                      </Text>
                      <Text style={[styles.cardExpiry, { color: subtleText }]}>
                        {item.warrantyExpiry}
                      </Text>
                    </View>
                    <FontAwesomeIcon icon={faChevronRight} size={14} color={subtleText} />
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 13, marginTop: 2 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  scroll: {
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 13,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 14,
  },
  cardLeft: {
    flex: 1,
    gap: 3,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
  },
  cardDays: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardExpiry: {
    fontSize: 12,
  },
});
