import { NavLink, Outlet } from 'react-router';
import { NAV_ITEMS } from '@/app/nav';

export function AppShell() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="flex items-center gap-6 border-b-(length:--rule-section-w) border-divider bg-nav px-6 py-3 text-nav-ink">
        <NavLink to="/home" className="face-title mr-auto text-[18px] tracking-tight">
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
                  isActive ? 'font-semibold text-nav-active' : 'hover:text-nav-active',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div
          aria-hidden
          className="grid size-7 place-items-center bg-avatar text-[11px] font-extrabold text-avatar-ink"
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
