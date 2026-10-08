import { tokens } from '@najme/ui-tokens';
import type { ReactElement, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView (default). Disable for screens with their own list. */
  scroll?: boolean;
  /** Apply the standard token padding (default). */
  padded?: boolean;
  edges?: readonly Edge[];
  /** Optional pull-to-refresh control (ScrollView only). */
  refreshControl?: ReactElement<RefreshControlProps>;
}

const DEFAULT_EDGES: readonly Edge[] = ['top', 'bottom', 'left', 'right'];

/**
 * Screen container: safe-area insets (position-aware, so it composes with navigator headers and
 * tab bars), keyboard avoidance, optional scrolling and token-based padding.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = DEFAULT_EDGES,
  refreshControl,
}: ScreenProps): ReactElement {
  return (
    <SafeAreaView edges={edges} style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, padded && styles.padded]}
            contentInsetAdjustmentBehavior="automatic"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, padded && styles.padded]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  padded: { padding: tokens.spacing.lg, gap: tokens.spacing.lg },
});
