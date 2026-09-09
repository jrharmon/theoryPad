import { NavLink, Outlet } from 'react-router';
import { NAV_ITEMS } from '@/app/nav';

export function AppShell() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="flex items-center gap-6 border-b-2 border-divider px-6 py-3">
        <NavLink to="/home" className="mr-auto text-[18px] font-extrabold tracking-tight">
          THEORYPAD
        </NavLink>

        <nav className="flex items-center gap-5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'text-[14px] transition-colors',
                  isActive ? 'font-semibold text-accent-700' : 'hover:text-accent-700',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div
          aria-hidden
          className="grid size-7 place-items-center bg-ink text-[11px] font-extrabold text-bg"
        >
          JH
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
