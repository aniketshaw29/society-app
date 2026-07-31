import { View, Text, StyleSheet } from 'react-native';

const STEPS = ['Society', 'Buildings', 'Flats', 'Residents'];

interface OnboardingProgressProps {
  currentStep: 0 | 1 | 2 | 3; // 0 = Society, 1 = Buildings, 2 = Flats, 3 = Residents/Guards
}

/**
 * 4-step progress bar for the admin onboarding flow.
 */
export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <View style={styles.container}>
      {STEPS.map((label, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const isLast = index === STEPS.length - 1;

        return (
          <View key={label} style={styles.stepWrapper}>
            <View style={styles.stepRow}>
              {/* Circle */}
              <View
                style={[
                  styles.circle,
                  isCompleted && styles.circleCompleted,
                  isActive && styles.circleActive,
                ]}
              >
                {isCompleted ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      isActive && styles.stepNumberActive,
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>

              {/* Connector line */}
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    isCompleted && styles.lineCompleted,
                  ]}
                />
              )}
            </View>

            {/* Label */}
            <Text
              style={[
                styles.label,
                isActive && styles.labelActive,
                isCompleted && styles.labelCompleted,
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  stepWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCompleted: {
    borderColor: '#1a73e8',
    backgroundColor: '#1a73e8',
  },
  circleActive: {
    borderColor: '#1a73e8',
    backgroundColor: '#FFFFFF',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  stepNumberActive: {
    color: '#1a73e8',
  },
  checkmark: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: -4,
  },
  lineCompleted: {
    backgroundColor: '#1a73e8',
  },
  label: {
    marginTop: 4,
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  labelActive: {
    color: '#1a73e8',
    fontWeight: '700',
  },
  labelCompleted: {
    color: '#1a73e8',
  },
});
