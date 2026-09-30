import { Alert, Platform } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Uses the platform destructive style on the confirm action. */
  destructive?: boolean;
}

/**
 * Promise wrapper around `Alert.alert` for confirm / cancel flows.
 * Resolves `true` when the user confirms, `false` when they cancel.
 *
 * On web `Alert.alert` is a no-op, so we fall back to the browser's native `window.confirm`.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const message = [options.title, options.message].filter(Boolean).join('\n');
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      {
        text: options.cancelLabel,
        style: 'cancel',
        onPress: () => resolve(false),
      },
      {
        text: options.confirmLabel,
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
