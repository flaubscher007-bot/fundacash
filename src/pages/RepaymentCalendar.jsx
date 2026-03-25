import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

const FIRM_COLORS = {
  'S STEYN INCORPORATED':     { bg: 'bg-chart-1/20', border: 'border-chart-1/60', text: 'text-chart-1', dot: 'bg-chart-1' },
  'LHL ATTORNEYS':            { bg: 'bg-chart-2/20', border: 'border-chart-2/60', text: 'text-chart-2', dot: 'bg-chart-2' },
  'DBVS ATTORNEYS':           { bg: 'bg-chart-3/20', border: 'border-chart-3/60', text: 'text-chart-3', dot: 'bg-chart-3' },
  'RH LAWYERS':               { bg: 'bg-chart-4/20', border: 'border-chart-4/60', text: 'text-chart-4', dot: 'bg-chart-4' },
  'A WOLMARANS INCORPORATED': { bg: 'bg-chart-5/20', border: 'border-chart-5/60', text: 'text-chart-5', dot: 'bg-chart-5' },
};

const FIRM_LABELS = {
  'S STEYN INCORPORATED': 'S Steyn',
  'LHL ATTORNEYS': 'LHL',
  'DBVS ATTORNEYS': 'DBVS',
  'RH LAWYERS': 'RH',
  'A WOLMARANS INCORPORATED': 'Wolmarans',
};

const fmt = (n) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function RepaymentCalendar() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(null);
  const [view, setView] = useState('calendar'); // 'calendar' | 'timeline'

  useEffect(() => {
    base44.entities.Transaction.list('-drawdown_date', 5000).then(data => {
      setTransactions(data);
      setLoading(false);
    });
  }, []);

  // Build settlement event map: date string -> array of transactions
  const eventMap = useMemo(() => {
    const map = {};
    transactions.forEach(txn => {
      // Use settlement_payment_date if available, else estimate from payment_terms
      const dateStr = txn.settlement_payment_date || txn.drawdown_payment_date;
      if (!dateStr) return;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(txn);
    });
    return map;
  }, [transactions]);

  // For timeline: group events by month for the next 12 months
  const timelineMonths = useMemo(() => {
    const months = [];
    for (let i = -1; i <= 11; i++) {
      const monthStart = addMonths(startOfMonth(new Date()), i);
      const year = monthStart.getFullYear();
      const month = monthStart.getMonth();
      const events = [];
      Object.entries(eventMap).forEach(([dateStr, txns]) => {
        const d = new Date(dateStr);
        if (d.getFullYear() === year && d.getMonth() === month) {
          events.push({ date: d, dateStr, txns });
        }
      });
      events.sort((a, b) => a.date - b.date);
      if (events.length > 0) months.push({ year, month, monthStart, events });
    }
    return months;
  }, [eventMap]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const days = daysInMonth(year, month);
    const grid = [];
    for (let i = 0; i < firstDay; i++) grid.push(null);
    for (let d = 1; d <= days; d++) grid.push(new Date(year, month, d));
    return grid;
  }, [currentMonth]);

  // Summary stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = useMemo(() => {
    const items = [];
    Object.entries(eventMap).forEach(([dateStr, txns]) => {
      const d = new Date(dateStr);
      if (d >= today) items.push({ date: d, dateStr, txns });
    });
    return items.sort((a, b) => a.date - b.date).slice(0, 8);
  }, [eventMap]);

  const totalExpected = useMemo(() => upcoming.reduce((sum, { txns }) =>
    sum + txns.reduce((s, t) => s + (Number(t.new_capital_amount) || Number(t.drawdown_amount) || 0), 0), 0), [upcoming]);

  const overdueItems = useMemo(() => {
    const items = [];
    Object.entries(eventMap).forEach(([dateStr, txns]) => {
      const d = new Date(dateStr);
      if (d < today) {
        txns.forEach(t => {
          if (t.payment_status !== 'PAID') items.push({ ...t, expectedDate: d });
        });
      }
    });
    return items.sort((a, b) => a.expectedDate - b.expectedDate);
  }, [eventMap]);

  const selectedEvents = selectedDay ? (eventMap[selectedDay.toISOString().split('T')[0]] || []) : [];

  const monthName = currentMonth.toLocaleString('en-ZA', { month: 'long', year: 'numeric' });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-space text-2xl font-bold text-foreground">Repayment Calendar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Expected settlement dates & cash flow overview</p>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setView('calendar')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${view === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
            <Calendar className="w-4 h-4" /> Calendar
          </button>
          <button onClick={() => setView('timeline')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${view === 'timeline' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
            <TrendingUp className="w-4 h-4" /> Timeline
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Upcoming Settlements</p>
              <p className="text-xl font-space font-bold text-foreground">{upcoming.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-400/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Expected Inflow</p>
              <p className="text-xl font-space font-bold text-foreground">{fmt(totalExpected)}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${overdueItems.length > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
              <AlertCircle className={`w-4 h-4 ${overdueItems.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Overdue Unpaid</p>
              <p className={`text-xl font-space font-bold ${overdueItems.length > 0 ? 'text-destructive' : 'text-foreground'}`}>{overdueItems.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Overdue Alert */}
      {overdueItems.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive">{overdueItems.length} Overdue Settlement{overdueItems.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {overdueItems.slice(0, 4).map(txn => (
              <Link key={txn.id} to={`/drawdown/${txn.id}`} className="flex items-center justify-between p-2 bg-destructive/5 border border-destructive/20 rounded-lg hover:bg-destructive/10 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-destructive/80 flex-shrink-0">{txn.trace_no}</span>
                  <span className="text-sm text-foreground truncate">{txn.client_name}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className="text-xs text-muted-foreground">{txn.expectedDate.toLocaleDateString('en-ZA')}</span>
                  <span className="text-sm font-medium text-destructive">{fmt(txn.new_capital_amount || txn.drawdown_amount)}</span>
                </div>
              </Link>
            ))}
            {overdueItems.length > 4 && <p className="text-xs text-muted-foreground pl-2">+{overdueItems.length - 4} more overdue</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main View */}
        <div className="xl:col-span-2">
          {view === 'calendar' ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Month Nav */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <button onClick={() => setCurrentMonth(m => addMonths(m, -1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-space font-semibold text-foreground">{monthName}</span>
                <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-border">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="h-20 border-b border-r border-border/50" />;
                  const dateStr = day.toISOString().split('T')[0];
                  const events = eventMap[dateStr] || [];
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const isPast = day < today;
                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDay(events.length > 0 ? (isSelected ? null : day) : null)}
                      className={`h-20 border-b border-r border-border/50 p-1.5 flex flex-col transition-colors ${events.length > 0 ? 'cursor-pointer' : ''} ${isSelected ? 'bg-primary/10 border-primary/40' : events.length > 0 ? 'hover:bg-muted/40' : ''}`}
                    >
                      <span className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : isPast ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                        {day.getDate()}
                      </span>
                      <div className="space-y-0.5 overflow-hidden flex-1">
                        {events.slice(0, 2).map((txn, i) => {
                          const colors = FIRM_COLORS[txn.law_firm] || FIRM_COLORS['S STEYN INCORPORATED'];
                          return (
                            <div key={txn.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate border ${colors.bg} ${colors.border} ${colors.text} font-medium`}>
                              {txn.client_name || txn.trace_no}
                            </div>
                          );
                        })}
                        {events.length > 2 && (
                          <div className="text-[10px] text-muted-foreground px-1.5">+{events.length - 2} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Timeline View */
            <div className="space-y-6">
              {timelineMonths.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                  <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No settlement dates recorded yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Add settlement dates to transactions to see them here.</p>
                </div>
              ) : timelineMonths.map(({ year, month, monthStart, events }) => {
                const isCurrentMonth = monthStart.getMonth() === new Date().getMonth() && monthStart.getFullYear() === new Date().getFullYear();
                const monthTotal = events.reduce((sum, { txns }) =>
                  sum + txns.reduce((s, t) => s + (Number(t.new_capital_amount) || Number(t.drawdown_amount) || 0), 0), 0);
                return (
                  <div key={`${year}-${month}`} className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className={`px-6 py-4 border-b border-border flex items-center justify-between ${isCurrentMonth ? 'bg-primary/5' : ''}`}>
                      <div className="flex items-center gap-3">
                        {isCurrentMonth && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                        <span className="font-space font-semibold text-foreground">
                          {monthStart.toLocaleString('en-ZA', { month: 'long', year: 'numeric' })}
                        </span>
                        <span className="text-xs text-muted-foreground">{events.length} settlement{events.length !== 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-sm font-space font-semibold text-primary">{fmt(monthTotal)}</span>
                    </div>
                    <div className="p-4 space-y-3">
                      {events.map(({ date, dateStr, txns }) => (
                        <div key={dateStr}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-16 text-xs font-medium text-muted-foreground flex-shrink-0">
                              {date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })}
                            </div>
                            <div className="flex-1 h-px bg-border/60" />
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {fmt(txns.reduce((s, t) => s + (Number(t.new_capital_amount) || Number(t.drawdown_amount) || 0), 0))}
                            </span>
                          </div>
                          <div className="space-y-2 ml-[72px]">
                            {txns.map(txn => {
                              const colors = FIRM_COLORS[txn.law_firm] || FIRM_COLORS['S STEYN INCORPORATED'];
                              const isPaid = txn.payment_status === 'PAID';
                              return (
                                <Link key={txn.id} to={`/drawdown/${txn.id}`} className={`flex items-center justify-between p-3 rounded-lg border transition-colors hover:opacity-80 ${colors.bg} ${colors.border}`}>
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">{txn.client_name || '—'}</p>
                                      <p className="text-xs text-muted-foreground">{txn.trace_no} · {FIRM_LABELS[txn.law_firm] || txn.law_firm}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                                    <span className={`text-sm font-space font-semibold ${colors.text}`}>
                                      {fmt(txn.new_capital_amount || txn.drawdown_amount)}
                                    </span>
                                    {isPaid ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    ) : date < today ? (
                                      <AlertCircle className="w-4 h-4 text-destructive" />
                                    ) : (
                                      <Clock className="w-4 h-4 text-muted-foreground" />
                                    )}
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-5">
          {/* Selected Day Detail */}
          {selectedDay && selectedEvents.length > 0 && (
            <div className="bg-card border border-primary/40 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-primary/5">
                <p className="font-space font-semibold text-foreground">
                  {selectedDay.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedEvents.length} settlement{selectedEvents.length !== 1 ? 's' : ''} · {fmt(selectedEvents.reduce((s, t) => s + (Number(t.new_capital_amount) || Number(t.drawdown_amount) || 0), 0))}</p>
              </div>
              <div className="p-4 space-y-2">
                {selectedEvents.map(txn => {
                  const colors = FIRM_COLORS[txn.law_firm] || FIRM_COLORS['S STEYN INCORPORATED'];
                  return (
                    <Link key={txn.id} to={`/drawdown/${txn.id}`} className={`block p-3 rounded-lg border ${colors.bg} ${colors.border} hover:opacity-80 transition-opacity`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${colors.text}`}>{FIRM_LABELS[txn.law_firm]}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${txn.payment_status === 'PAID' ? 'bg-emerald-400/20 text-emerald-400' : txn.payment_status === 'OVERDUE' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                          {txn.payment_status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{txn.client_name}</p>
                      <p className="text-xs text-muted-foreground mb-2">{txn.trace_no}</p>
                      <p className={`text-base font-space font-bold ${colors.text}`}>{fmt(txn.new_capital_amount || txn.drawdown_amount)}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Settlements */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-space font-semibold text-foreground">Upcoming Settlements</h3>
            </div>
            <div className="divide-y divide-border/50">
              {upcoming.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground text-center">No upcoming settlements.</p>
              ) : upcoming.map(({ date, dateStr, txns }) => {
                const daysDiff = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
                const total = txns.reduce((s, t) => s + (Number(t.new_capital_amount) || Number(t.drawdown_amount) || 0), 0);
                return (
                  <div key={dateStr} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground font-medium">
                        {date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-xs text-muted-foreground">{txns.length} matter{txns.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-space font-semibold text-primary">{fmt(total)}</p>
                      <p className="text-xs text-muted-foreground">{daysDiff === 0 ? 'Today' : daysDiff === 1 ? 'Tomorrow' : `in ${daysDiff}d`}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-space font-semibold text-foreground text-sm mb-3">Firms</h3>
            <div className="space-y-2">
              {Object.entries(FIRM_LABELS).map(([firm, label]) => {
                const colors = FIRM_COLORS[firm];
                return (
                  <div key={firm} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-border/60 space-y-1.5">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs text-muted-foreground">Paid</span></div>
                <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Pending</span></div>
                <div className="flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 text-destructive" /><span className="text-xs text-muted-foreground">Overdue</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}