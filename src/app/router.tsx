import { createHashRouter, Navigate } from 'react-router';
import { AppShell } from '@/app/AppShell';
import { Placeholder } from '@/routes/Placeholder';
import { Gallery } from '@/routes/dev/Gallery';
import { ExerciseLibrary } from '@/routes/exercises/ExerciseLibrary';
import { ExerciseDetail } from '@/routes/exercises/ExerciseDetail';
import { PracticeExercise } from '@/routes/practice/PracticeExercise';
import { PracticeRoutine } from '@/routes/practice/PracticeRoutine';
import { Home } from '@/routes/home/Home';
import { RoutineBuilder } from '@/routes/routines/RoutineBuilder';
import { SettingsPage } from '@/routes/settings/SettingsPage';

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
      { path: 'home', element: <Home /> },
      { path: 'routines/:routineId', element: <RoutineBuilder /> },
      { path: 'exercises', element: <ExerciseLibrary /> },
      { path: 'exercises/:exerciseId', element: <ExerciseDetail /> },
      { path: 'practice/exercise/:exerciseId', element: <PracticeExercise /> },
      { path: 'practice/routine/:routineId', element: <PracticeRoutine /> },
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
      { path: 'settings', element: <SettingsPage /> },
      // Development only: the M1 primitives against fixture data.
      { path: 'dev/gallery', element: <Gallery /> },
      {
        path: '*',
        element: (
          <Placeholder title="Not found" milestone="—" summary="That route does not exist." />
        ),
      },
    ],
  },
]);
