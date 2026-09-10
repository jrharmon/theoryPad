import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * jsdom does not implement scrollIntoView. The tab auto-scrolls to keep the
 * line being played in view, so it needs to exist; tests that care about it
 * spy on this.
 */
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
});
