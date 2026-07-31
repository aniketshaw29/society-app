import React, { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotices } from '@/hooks/useNotices';
import { NoticeBoard } from '@/components/shared/NoticeBoard';

// ---------------------------------------------------------------------------
// Resident notices screen
// ---------------------------------------------------------------------------

export default function ResidentNoticesScreen() {
  const { notices, loading, refresh } = useNotices('resident');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NoticeBoard
        notices={notices}
        loading={loading}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});
