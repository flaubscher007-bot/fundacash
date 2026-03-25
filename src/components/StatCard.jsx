export default function StatCard({ title, value, subtitle, icon: Icon, color = 'primary', trend }) {
  const colorMap = {
    primary: 'text-primary bg-primary/10',
    green: 'text-emerald-400 bg-emerald-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
    red: 'text-red-400 bg-red-400/10',
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="mt-1 text-2xl font-space font-semibold text-foreground truncate">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 ${colorMap[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}