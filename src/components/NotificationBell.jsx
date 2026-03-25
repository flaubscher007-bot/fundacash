import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, CheckCheck, CheckCircle2, AlertTriangle, TrendingDown, X } from 'lucide-react';

const TYPE_META = {
  payment_approved: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  payment_rejected: { icon: X, color: 'text-red-400', bg: 'bg-red-400/10' },
  low_balance_threshold: { icon: TrendingDown, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  proof_uploaded: { icon: CheckCircle2, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  overdue_alert: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
};

const fmtTime = (d) => {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function NotificationBell({ userEmail }) {
  const [notifs, setNotifs] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!userEmail) return;
    base44.entities.Notification.filter({ recipient_email: userEmail }, '-created_date', 50).then(setNotifs);
  }, [userEmail]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifs.filter(n => !n.is_read).length;

  const markAllRead = async () => {
    const unreadNotifs = notifs.filter(n => !n.is_read);
    await Promise.all(unreadNotifs.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markRead = async (id) => {
    await base44.entities.Notification.update(id, { is_read: true });
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-space font-semibold text-sm text-foreground">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
            {notifs.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">No notifications yet.</p>
            )}
            {notifs.map(n => {
              const meta = TYPE_META[n.type] || TYPE_META.payment_approved;
              const Icon = meta.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${n.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{fmtTime(n.created_date)}</p>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}