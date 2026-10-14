import { NavLink, Outlet } from 'react-router';
import { useAppearance } from '@/app/appearance';
import { NAV_ITEMS } from '@/app/nav';
import { Logo } from '@/components/ui/logo';

export function AppShell() {
  useAppearance();

  return (
    <div className="min-h-screen bg-graph text-ink">
      <header className="flex items-center gap-6 border-b border-rule bg-nav px-6 py-3 text-nav-ink">
        <NavLink
          to="/home"
          className="face-title mr-auto flex items-center gap-2 text-headline font-extrabold tracking-[-.035em] lowercase"
        >
          <Logo className="size-7" />
          THEORYPAD
        </NavLink>

        <nav className="flex items-center gap-1.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'rounded-full px-[11px] py-[3px] text-body-sm transition-colors',
                  isActive
                    ? 'bg-accent-tint font-semibold text-nav-active'
                    : 'hover:text-nav-active',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div
          aria-hidden
          className="grid size-7 place-items-center rounded-full bg-avatar text-caption font-extrabold text-avatar-ink"
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
