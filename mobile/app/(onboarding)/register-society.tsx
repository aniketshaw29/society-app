import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SocietyForm, SocietyFormData, SocietyFormErrors } from '@/components/SocietyForm';
import { useSocietyRegistration } from '@/hooks/useSocietyRegistration';

// ============================================================
// Validation
// ============================================================

function validateStep1(data: SocietyFormData): SocietyFormErrors {
  const errors: SocietyFormErrors = {};
  if (!data.name.trim()) errors.name = 'Society name is required';
  if (!data.address.trim()) errors.address = 'Address is required';
  if (!data.city.trim()) errors.city = 'City is required';
  if (!data.state.trim()) errors.state = 'State is required';
  if (!data.pincode.trim()) errors.pincode = 'Pincode is required';
  else if (!/^\d{6}$/.test(data.pincode)) errors.pincode = 'Pincode must be exactly 6 digits';
  return errors;
}

const EMPTY_FORM: SocietyFormData = {
  name: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
};

// ============================================================
// Screen
// ============================================================

export default function RegisterSocietyScreen() {
  const router = useRouter();
  const { loading, error, duplicateWarning, registerSociety, clearError, clearWarning } =
    useSocietyRegistration();

  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<SocietyFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<SocietyFormErrors>({});
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);

  const handleChange = (field: keyof SocietyFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    clearError();
  };

  const handleStep1Next = () => {
    const errors = validateStep1(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setStep(2);
  };

  const handleSubmit = async () => {
    const society = await registerSociety({
      name: formData.name,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
    });

    if (society) {
      setCreatedInviteCode(society.invite_code);
    }
  };

  const handleDuplicateIgnore = async () => {
    clearWarning();
    // Force creation even with duplicate (user acknowledges warning)
    const society = await registerSociety({
      name: formData.name,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
    });
    if (society) {
      setCreatedInviteCode(society.invite_code);
    }
  };

  const handleGoToBuildings = () => {
    router.replace('/(admin)/onboarding/buildings');
  };

  // ============================================================
  // Invite code display (post-creation)
  // ============================================================

  if (createdInviteCode) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.successScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Society Created!</Text>
            <Text style={styles.successSubtitle}>{formData.name}</Text>

            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteLabel}>Share this code with residents:</Text>
              <Text style={styles.inviteCode}>{createdInviteCode}</Text>
              <Text style={styles.inviteHint}>
                Residents will use this code to join your society
              </Text>
            </View>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleGoToBuildings}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>Continue Setup →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============================================================
  // Duplicate warning modal-ish
  // ============================================================

  if (duplicateWarning) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.warningContainer}>
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Society May Already Exist</Text>
            <Text style={styles.warningBody}>
              A society named &ldquo;<Text style={styles.bold}>{duplicateWarning.existingSociety.name}</Text>
              &rdquo; in{' '}
              <Text style={styles.bold}>{duplicateWarning.existingSociety.city}</Text> with pincode{' '}
              <Text style={styles.bold}>{duplicateWarning.existingSociety.pincode}</Text> already exists.
            </Text>
            <Text style={styles.warningPrompt}>Do you still want to create a new society?</Text>

            <View style={styles.warningActions}>
              <TouchableOpacity
                style={[styles.warningBtn, styles.warningBtnSecondary]}
                onPress={() => { clearWarning(); setStep(1); }}
              >
                <Text style={styles.warningBtnSecondaryText}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.warningBtn, styles.warningBtnPrimary]}
                onPress={handleDuplicateIgnore}
              >
                <Text style={styles.warningBtnPrimaryText}>Create Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================
  // Main form
  // ============================================================

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
          <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>Step 1 of 2</Text>
              <Text style={styles.heading}>Society Details</Text>
              <Text style={styles.subheading}>
                Enter the basic information about your housing society.
              </Text>

              <SocietyForm
                data={formData}
                errors={formErrors}
                onChange={handleChange}
                onSubmit={handleStep1Next}
                submitLabel="Next: Review"
                loading={false}
              />
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.stepTitle}>Step 2 of 2</Text>
              <Text style={styles.heading}>Review & Create</Text>
              <Text style={styles.subheading}>
                Confirm the details before creating your society.
              </Text>

              <View style={styles.reviewCard}>
                <ReviewRow label="Society Name" value={formData.name} />
                <ReviewRow label="Address" value={formData.address} />
                <ReviewRow label="City" value={formData.city} />
                <ReviewRow label="State" value={formData.state} />
                <ReviewRow label="Pincode" value={formData.pincode} />
              </View>

              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.editLink}
                onPress={() => setStep(1)}
              >
                <Text style={styles.editLinkText}>← Edit Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? 'Creating...' : 'Create Society'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 0,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  stepDotActive: {
    backgroundColor: '#1a73e8',
  },
  stepLine: {
    width: 48,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#1a73e8',
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  stepTitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subheading: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 22,
  },
  reviewCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  reviewLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  reviewValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    maxWidth: '55%',
    textAlign: 'right',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 14,
  },
  editLink: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 16,
  },
  editLinkText: {
    color: '#1a73e8',
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  // Success screen
  successScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 17,
    color: '#6B7280',
    marginBottom: 28,
    textAlign: 'center',
  },
  inviteCodeBox: {
    width: '100%',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  inviteLabel: {
    fontSize: 13,
    color: '#1a73e8',
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inviteCode: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 8,
    marginBottom: 10,
  },
  inviteHint: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  continueButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  // Duplicate warning
  warningContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  warningCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 12,
  },
  warningBody: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12,
  },
  bold: { fontWeight: '700' },
  warningPrompt: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 20,
  },
  warningActions: {
    flexDirection: 'row',
    gap: 12,
  },
  warningBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  warningBtnSecondary: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  warningBtnPrimary: {
    backgroundColor: '#1a73e8',
  },
  warningBtnSecondaryText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 15,
  },
  warningBtnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
