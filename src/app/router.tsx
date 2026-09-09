import { createHashRouter, Navigate } from 'react-router';
import { AppShell } from '@/app/AppShell';
import { Placeholder } from '@/routes/Placeholder';

/**
 * Hash routing: GitHub Pages serves from a subpath and has no SPA fallback,
 * and this app has no SEO concerns. See docs/plan/01-ARCHITECTURE.md.
 *
 * Every screen is a placeholder until its milestone lands. The route table is
 * complete from M0 so navigation is real and later work only swaps elements.
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      {
        path: 'home',
        element: (
          <Placeholder
            title="Home"
            milestone="Milestone 5"
            summary="Today's routine, your other routines, the practice heatmap and personal bests."
          />
        ),
      },
      {
        path: 'routines/:routineId',
        element: (
          <Placeholder
            title="Routine builder"
            milestone="Milestone 5"
            summary="Add, reorder and remove exercises; set rep counts, the inter-exercise gap and the session axis policies."
          />
        ),
      },
      {
        path: 'exercises',
        element: (
          <Placeholder
            title="Exercises"
            milestone="Milestone 2"
            summary="Every exercise in the registry plus your configured instances, filtered by tag."
          />
        ),
      },
      {
        path: 'exercises/:exerciseId',
        element: (
          <Placeholder
            title="Exercise detail"
            milestone="Milestone 2"
            summary="Configure the target tempo, max tempo, reps, params, axis policies and reference video. Start a standalone practice run."
          />
        ),
      },
      {
        path: 'practice/exercise/:exerciseId',
        element: (
          <Placeholder
            title="Practice"
            milestone="Milestone 2"
            summary="The running view: variation brief, axis strip, tab, transport and the neck diagram."
          />
        ),
      },
      {
        path: 'practice/routine/:routineId',
        element: (
          <Placeholder
            title="Run routine"
            milestone="Milestone 5"
            summary="The chained, hands-off session runner."
          />
        ),
      },
      {
        path: 'fretboard',
        element: (
          <Placeholder
            title="Fretboard"
            milestone="Milestone 6"
            summary="The mode across the whole neck, and which positions the roller has never sent you to."
          />
        ),
      },
      {
        path: 'report',
        element: (
          <Placeholder
            title="Practice summary"
            milestone="Milestone 6"
            summary="Exercises, times played, tempos used and total time over a date range."
          />
        ),
      },
      {
        path: 'settings',
        element: (
          <Placeholder
            title="Settings"
            milestone="Milestone 5"
            summary="Instrument, audio, practice defaults, and data export/import."
          />
        ),
      },
      {
        path: '*',
        element: (
          <Placeholder title="Not found" milestone="—" summary="That route does not exist." />
        ),
      },
    ],
  },
]);
