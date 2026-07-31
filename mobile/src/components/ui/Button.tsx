import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const variantStyles: Record<
  ButtonVariant,
  { button: ViewStyle; text: TextStyle; disabled: ViewStyle }
> = {
  primary: {
    button: { backgroundColor: '#1a73e8' },
    text: { color: '#FFFFFF' },
    disabled: { backgroundColor: '#93C5FD' },
  },
  secondary: {
    button: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1.5,
      borderColor: '#1a73e8',
    },
    text: { color: '#1a73e8' },
    disabled: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  },
  danger: {
    button: { backgroundColor: '#EF4444' },
    text: { color: '#FFFFFF' },
    disabled: { backgroundColor: '#FCA5A5' },
  },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const { button, text, disabled: disabledStyle } = variantStyles[variant];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        button,
        isDisabled && disabledStyle,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' ? '#1a73e8' : '#FFFFFF'}
          size="small"
        />
      ) : (
        <Text style={[styles.text, text, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  },
});
