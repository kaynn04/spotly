/**
 * Breadcrumb Navigation Component
 * 
 * Displays navigation path with clickable parent segments
 * Example: Space Name > Container Name (Container Name not clickable)
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

export interface BreadcrumbItem {
  label: string;
  onPress?: () => void;
  isActive?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isClickable = !isLast && item.onPress;
        const isActive = item.isActive;

        return (
          <View key={index} style={styles.segmentWrapper}>
            {index > 0 && <Text style={styles.separator}>/</Text>}

            {isClickable ? (
              <Pressable onPress={item.onPress} style={styles.clickableSegment}>
                <Text style={styles.clickableSegmentText}>{item.label}</Text>
              </Pressable>
            ) : isActive ? (
              <View style={styles.activeSegmentBox}>
                <Text style={styles.activeSegmentText}>{item.label}</Text>
              </View>
            ) : (
              <Text style={[styles.segment]}>
                {item.label}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  segmentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separator: {
    marginHorizontal: 4,
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  segment: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeSegment: {
    color: '#0a84ff',
    fontWeight: '600',
  },
  activeSegmentBox: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#0a84ff',
  },
  activeSegmentText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  clickableSegment: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#e8e8e8',
  },
  clickableSegmentText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
});
