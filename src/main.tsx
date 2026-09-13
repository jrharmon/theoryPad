import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

// Self-hosted: the app is local-first and must work offline.
import '@fontsource-variable/bricolage-grotesque/standard.css'; // opsz + wdth + wght
import '@fontsource-variable/figtree';
import '@/styles/index.css';

import { router } from '@/app/router';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
