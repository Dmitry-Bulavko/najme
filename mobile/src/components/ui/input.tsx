import { View, Text, TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { Colors, Radius } from '@/constants/colors';
import { forwardRef } from 'react';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  rightSlot?: React.ReactNode;
};

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, rightSlot, style, ...props }, ref) => {
    return (
      <View style={styles.wrapper}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View style={[styles.field, error ? styles.fieldError : null]}>
          <TextInput
            ref={ref}
            placeholderTextColor={Colors.text03}
            style={[styles.input, style]}
            {...props}
          />
          {rightSlot}
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  },
);
Input.displayName = 'Input';

const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  label: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: Colors.text01,
    lineHeight: 20,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.base01,
    borderWidth: 1,
    borderColor: Colors.base04,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  fieldError: { borderColor: Colors.accent },
  input: {
    flex: 1,
    height: 56,
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: Colors.text01,
  },
  error: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.accent,
  },
});
