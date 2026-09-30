import { tokens } from '@najme/ui-tokens';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ListItem } from './list-item';
import { Text } from './text';
import { CONTROL_BORDER_WIDTH, CONTROL_HEIGHT, fontFamilies, MIN_TOUCH_TARGET } from './theme';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const { colors, spacing, radius } = tokens;

/** Labelled select that opens a bottom-sheet list of options. */
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  error,
  containerStyle,
  testID,
}: SelectProps): ReactElement {
  const { t } = useTranslation('mobile');
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const display = selected?.label ?? placeholder ?? t('ui.selectPlaceholder');
  const hasError = Boolean(error);

  return (
    <View style={containerStyle} testID={testID}>
      <Text variant="caption" color="text02" style={styles.label}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={selected ? selected.label : (placeholder ?? t('ui.selectPlaceholder'))}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          hasError && styles.triggerError,
          disabled && styles.triggerDisabled,
        ]}
      >
        <Text
          variant="body"
          color={selected ? 'text01' : 'text03'}
          numberOfLines={1}
          style={styles.triggerText}
        >
          {display}
        </Text>
      </Pressable>
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert" style={styles.message}>
          {error}
        </Text>
      ) : null}

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
        accessibilityViewIsModal
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('ui.close')}
          style={styles.backdrop}
          onPress={() => setOpen(false)}
        />
        <View style={styles.sheet} accessibilityRole="menu">
          <Text variant="title" style={styles.sheetTitle}>
            {label}
          </Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <ListItem
                title={item.label}
                selected={item.value === value}
                accessibilityRole="menuitem"
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
              />
            )}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('ui.cancel')}
            onPress={() => setOpen(false)}
            style={styles.cancel}
          >
            <Text variant="body" color="primary" style={styles.cancelText}>
              {t('ui.cancel')}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs },
  trigger: {
    minHeight: CONTROL_HEIGHT.md,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: CONTROL_BORDER_WIDTH,
    borderColor: colors.base04,
    backgroundColor: colors.base01,
    paddingHorizontal: spacing.lg,
  },
  triggerError: { borderColor: colors.danger },
  triggerDisabled: { backgroundColor: colors.background, opacity: 0.6 },
  triggerText: { fontFamily: fontFamilies.medium },
  message: { marginTop: spacing.xs },
  backdrop: {
    flex: 1,
    // text01 at 40% opacity — same overlay treatment as the web Sheet/Dialog.
    backgroundColor: `${colors.text01}66`,
  },
  sheet: {
    maxHeight: '55%',
    backgroundColor: colors.base01,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.lg,
  },
  sheetTitle: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  cancel: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  cancelText: { fontFamily: fontFamilies.bold },
});
