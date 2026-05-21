/**
 * ToolsPage
 *
 * General tools hub — lists all available and upcoming tools.
 * Each tool is a tappable card that navigates to its own screen.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faSuitcase,
  faQrcode,
  faBarcode,
  faClipboardList,
  faTag,
  faShield,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useScrollHide } from '@/hooks/use-scroll-hide';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';

const PRIMARY = '#6b7f99';

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: any;
  iconColor: string;
  route?: string;
  available: boolean;
}

const TOOLS: Tool[] = [
  {
    id: 'outside',
    title: 'Outside Sessions',
    description: "Track items you've taken out of the house with a checklist.",
    icon: faSuitcase,
    iconColor: PRIMARY,
    route: '/outside',
    available: true,
  },
  {
    id: 'qrcode',
    title: 'QR scanner',
    description: 'Create printable QR labels and scan QR or product barcodes.',
    icon: faQrcode,
    iconColor: '#9b7fd4',
    route: '/tools/label-qr',
    available: true,
  },
  {
    id: 'barcode',
    title: 'Barcode Scanner',
    description: 'Save item details once, then scan the barcode again to find them instantly.',
    icon: faBarcode,
    iconColor: '#e07b54',
    route: '/tools/barcode-scanner',
    available: true,
  },
  {
    id: 'packinglist',
    title: 'Packing List Builder',
    description: 'Select a space or container and generate a ready-to-share packing list.',
    icon: faClipboardList,
    iconColor: '#5ba08a',
    available: false,
  },
  {
    id: 'inventoryvalue',
    title: 'Inventory Value Summary',
    description: 'Estimate the total value of your belongings for insurance purposes.',
    icon: faTag,
    iconColor: '#c08a3a',
    available: false,
  },
  {
    id: 'warranty',
    title: 'Warranty Tracker',
    description: 'Attach warranty expiry dates to items and get notified before they expire.',
    icon: faShield,
    iconColor: '#e09b3a',
    route: '/tools/warranty-tracker',
    available: true,
  },
];

export default function ToolsPage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const { handleScroll } = useScrollHide();
  const tabBarPadding = useTabBarPadding();

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  const availableTools = TOOLS.filter((t) => t.available);
  const comingSoonTools = TOOLS.filter((t) => !t.available);

  const handlePress = (tool: Tool) => {
    if (!tool.available || !tool.route) return;
    router.push(tool.route as any);
  };

  const renderToolCard = (tool: Tool) => (
    <TouchableOpacity
      key={tool.id}
      style={[styles.card, { backgroundColor: cardBg, borderColor }, !tool.available && styles.cardDisabled]}
      onPress={() => handlePress(tool)}
      activeOpacity={tool.available ? 0.7 : 1}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${tool.iconColor}18` }]}>
        <FontAwesomeIcon icon={tool.icon} size={22} color={tool.available ? tool.iconColor : subtleText} />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: tool.available ? colors.text : subtleText }]}>
            {tool.title}
          </Text>
          {!tool.available && (
            <View style={[styles.badge, { backgroundColor: isDark ? '#2c2c2e' : '#f0f0f5' }]}>
              <Text style={[styles.badgeText, { color: subtleText }]}>Soon</Text>
            </View>
          )}
        </View>
        <Text style={[styles.cardDescription, { color: subtleText }]} numberOfLines={2}>
          {tool.description}
        </Text>
      </View>

      {tool.available && (
        <FontAwesomeIcon icon={faChevronRight} size={13} color={subtleText} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPadding }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Tools</Text>
          <Text style={[styles.subtitle, { color: subtleText }]}>Utilities connected to your inventory</Text>
        </View>

        {/* Available Tools */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: subtleText }]}>Available</Text>
          {availableTools.map(renderToolCard)}
        </View>

        {/* Coming Soon */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: subtleText }]}>Coming Soon</Text>
          {comingSoonTools.map(renderToolCard)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16 },

  header: {
    marginBottom: 24,
  },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },

  section: {
    marginBottom: 24,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  cardDisabled: {
    opacity: 0.6,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },

  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
