import { tokens } from '@najme/ui-tokens';
import { useState, type ReactElement } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Text } from './text';
import { fontFamilies } from './theme';

export interface AvatarProps {
  name: string;
  uri?: string | null;
  /** Diameter in dp. */
  size?: number;
}

/** Up to two initials from the first and last words of a name. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Round avatar: shows the image, or initials when there is no image or it fails to load. */
export function Avatar({ name, uri, size = 48 }: AvatarProps): ReactElement {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = Boolean(uri) && failedUri !== uri;
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View accessibilityRole="image" accessibilityLabel={name} style={[styles.base, dimension]}>
      {showImage ? (
        <Image
          source={{ uri: uri as string }}
          style={dimension}
          onError={() => setFailedUri(uri ?? null)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text
          variant="body"
          color="primary"
          style={{ fontFamily: fontFamilies.bold, fontSize: size * 0.38, lineHeight: size * 0.5 }}
          allowFontScaling={false}
        >
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: tokens.colors.secondary,
  },
});
