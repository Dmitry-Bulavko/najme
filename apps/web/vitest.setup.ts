import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import '@testing-library/jest-dom/vitest';

// @testing-library/react's auto-cleanup relies on a global `afterEach`, which the shared Vitest
// base config disables (`globals: false`); register it explicitly so DOM from one test doesn't
// leak into the next.
afterEach(() => {
  cleanup();
});

// jsdom lacks a few browser APIs that Radix UI primitives (Popper, Select-like menus) rely on.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
