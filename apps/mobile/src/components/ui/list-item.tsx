import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@najme/ui-tokens';
import { Children, Fragment, type ReactElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityRole } from 'react-native';

import { Divider } from './divider';
import { Text } from './text';
import { ICON_BADGE_SIZE, ICON_SIZE, MIN_TOUCH_TARGET } from './theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Custom trailing content; replaces the chevron/check. */
  trailing?: ReactNode;
  /** Shows a check mark (e.g. the selected option in a group). */
  selected?: boolean;
  onPress?: () => void;
  /** Override for selection lists, e.g. `radio`. Defaults to `button` when pressable. */
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  testID?: string;
}

/** Settings-style row: optional leading icon, title/subtitle, trailing chevron or check. */
export function ListItem({
  title,
  subtitle,
  icon,
  trailing,
  selected,
  onPress,
  accessibilityRole,
  accessibilityLabel,
  testID,
}: ListItemProps): ReactElement {
  const pressable = Boolean(onPress);

  return (
    <Pressable
      accessibilityRole={accessibilityRole ?? (pressable ? 'button' : 'text')}
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      accessibilityState={selected === undefined ? undefined : { selected }}
      disabled={!pressable}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={ICON_SIZE.sm} color={tokens.colors.primary} />
        </View>
      ) : null}
      <View style={styles.body}>
        <Text variant="body">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="text03">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (selected ? (
          <Ionicons name="checkmark" size={ICON_SIZE.md} color={tokens.colors.primary} />
        ) : pressable && selected === undefined ? (
          <Ionicons name="chevron-forward" size={ICON_SIZE.sm} color={tokens.colors.text03} />
        ) : null)}
    </Pressable>
  );
}

/** Rounded container that stacks `ListItem`s with dividers between them. */
export function ListGroup({ children }: { children: ReactNode }): ReactElement {
  const items = Children.toArray(children);
  return (
    <View style={styles.group}>
      {items.map((child, index) => (
        <Fragment key={index}>
          {index > 0 ? <Divider style={styles.divider} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    minHeight: MIN_TOUCH_TARGET + tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
  },
  // Pressed rows sit on `secondary` (#EBEFFF): `text01` is 14.6:1 and the `text03` subtitle
  // (composited, ~#646880) is 4.78:1, both AA, so text colours need no pressed override.
  pressed: { backgroundColor: tokens.colors.secondary },
  iconWrap: {
    width: ICON_BADGE_SIZE.sm,
    height: ICON_BADGE_SIZE.sm,
    borderRadius: tokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.secondary,
  },
  body: { flex: 1 },
  group: {
    backgroundColor: tokens.colors.base01,
    borderRadius: tokens.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.base04,
    overflow: 'hidden',
  },
  divider: { marginLeft: tokens.spacing.lg },
});
