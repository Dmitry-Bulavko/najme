import { tokens } from '@najme/ui-tokens';
import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Shared layout for the placeholder tab screens (title + body text, optional extra content). */
export function PlaceholderScreen({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
}): ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: tokens.typography.scale.heading.fontSize,
    color: tokens.colors.text01,
  },
  body: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.scale.body.fontSize,
    color: tokens.colors.text02,
  },
});
