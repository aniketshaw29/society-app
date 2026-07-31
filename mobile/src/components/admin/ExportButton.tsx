import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExportButtonProps {
  onPress: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExportButton({ onPress, loading, disabled }: ExportButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, (loading || disabled) && styles.buttonDisabled]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Ionicons name="download-outline" size={16} color="#FFFFFF" />
      )}
      <Text style={styles.label}>
        {loading ? 'Exporting…' : 'Export CSV'}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1B6B3A',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  buttonDisabled: { opacity: 0.55 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
