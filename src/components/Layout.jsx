import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { LayoutDashboard, FileText, Plus, Menu, TrendingUp, Building2, LogOut, CalendarDays, BarChart3 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const FIRMS = [
  { label: 'S Steyn Inc', slug: 'ssteyn' },
  { label: 'LHL Attorneys', slug: 'lhl' },
  { label: 'DBVS Attorneys', slug: 'dbvs' },
  { label: 'RH Lawyers', slug: 'rhlawyers' },
  { label: 'A Wolmarans Inc', slug: 'wolmarans' },
];

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/transactions', icon: FileText, label: 'Transactions' },
  { path: '/drawdown/new', icon: Plus, label: 'New Draw-Down' },
  { path: '/calendar', icon: CalendarDays, label: 'Repayment Calendar' },
  { path: '/aging', icon: BarChart3, label: 'Aging Report' },
];

// Bottom nav items for mobile (keep it to 4 key items)
const mobileNavItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/transactions', icon: FileText, label: 'Transactions' },
  { path: '/drawdown/new', icon: Plus, label: 'New' },
  { path: '/calendar', icon: CalendarDays, label: 'Calendar' },
];

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setUserRole(u?.role)).catch(() => {});
  }, []);

  const isFirmUser = userRole === 'firm_user';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — desktop always visible, mobile slide-in */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-space font-700 text-lg text-foreground leading-none">FundaCash</div>
              <div className="text-xs text-muted-foreground mt-0.5">MLF Tracker</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {isFirmUser ? (
            <Link
              to="/portal"
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                location.pathname === '/portal'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              <Building2 className="w-4 h-4 flex-shrink-0" />
              My Firm Portal
            </Link>
          ) : (
            navItems.map(({ path, icon: Icon, label }) => {
              const active = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </Link>
              );
            })
          )}
        </nav>

        {/* Law Firms */}
        {!isFirmUser && (
        <div className="px-4 pb-2">
          <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Law Firms</p>
          <div className="space-y-0.5">
            {FIRMS.map(({ label, slug }) => {
              const active = location.pathname === `/firm/${slug}`;
              return (
                <Link
                  key={slug}
                  to={`/firm/${slug}`}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={() => base44.auth.logout()}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar — mobile only */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 border-b border-border bg-card flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <div className="font-space font-semibold text-foreground">FundaCash</div>
        </header>

        {/* Page content — leaves room for mobile bottom nav */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-20 lg:pb-8">
          <Outlet />
        </main>

        {/* Bottom nav — mobile only */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border flex items-stretch safe-area-inset-bottom">
          {mobileNavItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 text-[10px] font-medium transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-primary' : ''}`} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}