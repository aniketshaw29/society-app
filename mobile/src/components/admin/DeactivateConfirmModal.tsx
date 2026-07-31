import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ============================================================
// Types
// ============================================================

interface DeactivateConfirmModalProps {
  visible: boolean;
  name: string;
  type: 'resident' | 'guard';
  onConfirm(): void;
  onCancel(): void;
  loading?: boolean;
}

// ============================================================
// Component
// ============================================================

export function DeactivateConfirmModal({
  visible,
  name,
  type,
  onConfirm,
  onCancel,
  loading = false,
}: DeactivateConfirmModalProps) {
  const label = type === 'resident' ? 'Resident' : 'Guard';
  const iconName = type === 'resident' ? 'person-remove-outline' : 'shield-outline';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Icon */}
          <View style={styles.iconWrapper}>
            <Ionicons name={iconName} size={30} color="#DC2626" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Deactivate {label}</Text>

          {/* Body */}
          <Text style={styles.body}>
            Are you sure you want to deactivate{' '}
            <Text style={styles.nameHighlight}>{name}</Text>
            {'? '}
            {type === 'resident'
              ? 'They will lose access to the app and will not be able to log in.'
              : 'The guard will be marked inactive and their login will be blocked.'}
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
              onPress={onConfirm}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.confirmText}>
                {loading ? 'Deactivating...' : 'Deactivate'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  nameHighlight: {
    fontWeight: '700',
    color: '#111827',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#FCA5A5',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
