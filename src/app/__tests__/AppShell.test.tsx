import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppShell } from '@/app/AppShell';
import { NAV_ITEMS } from '@/app/nav';

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: NAV_ITEMS.map((item) => ({
          path: item.to.slice(1),
          element: <p>{item.label} screen</p>,
        })),
      },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

describe('AppShell', () => {
  it('renders the brand and every nav item', () => {
    renderAt('/home');
    expect(screen.getByText('THEORYPAD')).toBeInTheDocument();
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole('link', { name: item.label })).toBeInTheDocument();
    }
  });

  it('renders the matched child route', () => {
    renderAt('/fretboard');
    expect(screen.getByText('Fretboard screen')).toBeInTheDocument();
  });

  it('marks only the current nav item as active', () => {
    renderAt('/report');
    const active = screen.getByRole('link', { name: 'Report' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });
});
