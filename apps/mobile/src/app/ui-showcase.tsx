import { Redirect } from 'expo-router';
import type { ReactElement } from 'react';

type ShowcaseModule = typeof import('@/components/ui/showcase');

/**
 * The showcase is only loaded through a `__DEV__` ternary. In production bundles `__DEV__` is
 * statically false, so Metro constant-folds the `require` away before collecting dependencies and
 * the showcase module is not shipped; the route then just redirects to the tabs.
 */
const UiShowcase: ShowcaseModule['UiShowcase'] | null = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/components/ui/showcase') as ShowcaseModule).UiShowcase
  : null;

export default function UiShowcaseRoute(): ReactElement {
  return UiShowcase ? <UiShowcase /> : <Redirect href="/" />;
}
