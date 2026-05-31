import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type TouchableOpacityProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Colors, Radius } from '@/constants/colors';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

type ButtonProps = TouchableOpacityProps & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  label: string;
  fullWidth?: boolean;
  icon?: React.ReactNode;
};

const containerStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.secondary },
  ghost: { backgroundColor: 'transparent' },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
};

const textStyles: Record<Variant, TextStyle> = {
  primary: { color: Colors.base01 },
  secondary: { color: Colors.primary },
  ghost: { color: Colors.text01 },
  outline: { color: Colors.primary },
};

const sizeStyles: Record<Size, { container: ViewStyle; text: TextStyle }> = {
  sm: { container: { height: 36, paddingHorizontal: 12, borderRadius: Radius.sm }, text: { fontSize: 13 } },
  md: { container: { height: 48, paddingHorizontal: 20, borderRadius: Radius.md }, text: { fontSize: 15 } },
  lg: { container: { height: 56, paddingHorizontal: 24, borderRadius: Radius.md }, text: { fontSize: 16 } },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  label,
  fullWidth = false,
  icon,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const s = sizeStyles[size];
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      style={[
        styles.base,
        containerStyles[variant],
        s.container,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style as ViewStyle,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? Colors.base01 : Colors.primary} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, textStyles[variant], s.text, icon ? styles.textWithIcon : null]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  text: { fontFamily: 'Manrope_800ExtraBold', letterSpacing: 0.2 },
  textWithIcon: { marginLeft: 4 },
});
