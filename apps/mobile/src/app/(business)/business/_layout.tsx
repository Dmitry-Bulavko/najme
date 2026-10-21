import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

/** Fixed `business/` segment hosting `[businessId]` tabs (#85 review). */
export default function BusinessSegmentLayout(): ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
