import { NavLink } from 'react-router-dom';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Boxes,
  LayoutDashboard,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: Permission;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Products', to: '/products', icon: Package },
      { label: 'Categories', to: '/categories', icon: Tags },
      { label: 'Suppliers', to: '/suppliers', icon: Truck },
      { label: 'Stock movements', to: '/stock', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'Purchasing',
    items: [{ label: 'Purchase orders', to: '/orders', icon: ShoppingCart, permission: 'order:read' }],
  },
  {
    label: 'Insights',
    items: [{ label: 'Reports', to: '/reports', icon: BarChart3, permission: 'analytics:read' }],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Notifications', to: '/notifications', icon: Bell },
      { label: 'Users & roles', to: '/users', icon: Users, permission: 'user:manage' },
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
];

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
      <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-500/15 ring-1 ring-inset ring-brand-400/25">
        <Boxes className="h-5 w-5 text-brand-400" aria-hidden="true" />
      </span>
      {!collapsed ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-white">SmartStock</p>
          <p className="truncate text-[11px] font-medium text-slate-500">Inventory control</p>
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  mobile = false,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const { hasPermission } = useAuth();
  const { status } = useSocket();

  const statusLabel =
    status === 'connected' ? 'Live sync active' : status === 'connecting' ? 'Connecting…' : 'Offline';
  const statusDot =
    status === 'connected'
      ? 'bg-emerald-400'
      : status === 'connecting'
        ? 'bg-amber-400 animate-pulse'
        : 'bg-slate-500';

  return (
    <aside
      className={`flex h-full flex-col border-r border-white/5 bg-navy-950 text-slate-300 ${
        mobile ? 'w-72' : collapsed ? 'w-20' : 'w-[264px]'
      }`}
      aria-label="Primary navigation"
    >
      <div
        className={`flex h-16 shrink-0 items-center border-b border-white/5 ${
          collapsed ? 'justify-center px-3' : 'justify-between gap-2 px-4'
        }`}
      >
        <Brand collapsed={collapsed} />
        {!mobile && onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-white ${
              collapsed ? 'hidden' : ''
            }`}
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => {
          const visible = section.items.filter(
            (item) => !item.permission || hasPermission(item.permission),
          );
          if (visible.length === 0) return null;
          return (
            <div key={section.label} className="mb-5 last:mb-0">
              {!collapsed ? (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  {section.label}
                </p>
              ) : (
                <div className="mx-auto mb-2 h-px w-8 bg-white/5" aria-hidden="true" />
              )}
              <ul className="space-y-1">
                {visible.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={onNavigate}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${
                            collapsed ? 'justify-center' : ''
                          } ${
                            isActive
                              ? 'bg-white/[0.08] text-white'
                              : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive ? (
                              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-400" />
                            ) : null}
                            <Icon
                              className={`h-[18px] w-[18px] shrink-0 ${
                                isActive ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300'
                              }`}
                              aria-hidden="true"
                            />
                            {!collapsed ? <span className="truncate">{item.label}</span> : null}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/5 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
            <span className={`relative flex h-2 w-2 shrink-0 ${statusDot} rounded-full`}>
              {status === 'connected' ? (
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-40" />
              ) : null}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-200">{statusLabel}</p>
              <p className="truncate text-[10px] text-slate-500">SmartStock v1.0</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title={statusLabel}>
            <span className={`h-2.5 w-2.5 rounded-full ${statusDot}`} />
          </div>
        )}
        {!mobile && collapsed && onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mt-2 flex h-8 w-full items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-white"
          >
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </aside>
  );
}
