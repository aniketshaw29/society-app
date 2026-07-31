import { View, Text, StyleSheet } from 'react-native';

// ============================================================
// Types
// ============================================================

interface TrendEntry {
  date: string;
  count: number;
}

interface VisitorTrendChartProps {
  data: TrendEntry[];
}

// ============================================================
// Helpers
// ============================================================

function shortDayLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[d.getUTCDay()] ?? '';
}

// ============================================================
// Component
// ============================================================

export function VisitorTrendChart({ data }: VisitorTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No visitor data available</Text>
      </View>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const BAR_MAX_HEIGHT = 80;

  return (
    <View style={styles.container}>
      <View style={styles.barsContainer}>
        {data.map((entry, idx) => {
          const heightPct = entry.count / maxCount;
          const barHeight = Math.max(heightPct * BAR_MAX_HEIGHT, entry.count > 0 ? 4 : 2);
          const isToday = idx === data.length - 1;

          return (
            <View key={entry.date} style={styles.barGroup}>
              {/* Count label above bar */}
              <Text style={[styles.countLabel, isToday && styles.countLabelToday]}>
                {entry.count > 0 ? entry.count : ''}
              </Text>
              {/* Bar */}
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height: barHeight },
                    isToday ? styles.barToday : styles.barDefault,
                    entry.count === 0 && styles.barEmpty,
                  ]}
                />
              </View>
              {/* Day label below bar */}
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {shortDayLabel(entry.date)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  countLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    minHeight: 14,
  },
  countLabelToday: {
    color: '#1a73e8',
  },
  barTrack: {
    height: 80,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '80%',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
  },
  barDefault: {
    backgroundColor: '#BFDBFE',
  },
  barToday: {
    backgroundColor: '#1a73e8',
  },
  barEmpty: {
    backgroundColor: '#E5E7EB',
    height: 2,
    borderRadius: 2,
  },
  dayLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  dayLabelToday: {
    color: '#1a73e8',
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
