import React from 'react';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../lib/constants';
import { useAppStore } from '../../stores/app-store';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { path: ROUTES.DASHBOARD, icon: '◆', label: 'Dashboard' },
  { path: ROUTES.MAP, icon: '◉', label: 'Map' },
  { path: ROUTES.COUNTRIES, icon: '⊞', label: 'Countries' },
  { path: ROUTES.SETTINGS, icon: '⚙', label: 'Settings' },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, syncStatuses } = useAppStore();

  const isSyncing = syncStatuses.some((s) => s.status === 'syncing');
  const hasError = syncStatuses.some((s) => s.status === 'error');

  const statusColor = hasError
    ? 'bg-odin-red'
    : isSyncing
    ? 'bg-odin-amber'
    : 'bg-odin-green';

  return (
    <aside
      className={`${
        sidebarCollapsed ? 'w-16' : 'w-56'
      } bg-odin-bg-secondary border-r border-odin-border flex flex-col transition-all duration-200`}
    >
      <div className="p-4 border-b border-odin-border">
        <div className="flex items-center gap-3">
          <div className="text-2xl text-odin-cyan" style={{ textShadow: '0 0 10px rgba(0, 229, 255, 0.5)' }}>
            ⬢
          </div>
          {!sidebarCollapsed && (
            <div>
              <h1 className="text-xl font-bold text-odin-cyan tracking-wider">ODIN</h1>
              <p className="text-xs text-odin-text-tertiary font-mono">OSINT Platform</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === ROUTES.DASHBOARD}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 text-sm font-mono transition-colors ${
                isActive
                  ? 'bg-odin-bg-tertiary text-odin-cyan border-l-2 border-odin-cyan'
                  : 'text-odin-text-secondary hover:text-odin-text-primary hover:bg-odin-bg-hover'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {!sidebarCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-odin-border">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${statusColor} animate-pulse-slow`} />
          {!sidebarCollapsed && (
            <span className="text-xs text-odin-text-tertiary font-mono">
              {isSyncing ? 'Syncing...' : hasError ? 'Sync Error' : 'Idle'}
            </span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="mt-3 w-full px-2 py-1 text-xs font-mono text-odin-text-tertiary hover:text-odin-cyan transition-colors"
        >
          {sidebarCollapsed ? '→' : '←'}
        </button>
      </div>
    </aside>
  );
}
