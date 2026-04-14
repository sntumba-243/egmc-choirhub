import type { LucideIcon } from 'lucide-react';
import { tokens } from '../../styles/tokens';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  onClick?: () => void;
  trend?: React.ReactNode;
}

export function StatCard({ label, value, icon: Icon, iconBg, iconColor, onClick, trend }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'white',
        borderRadius: tokens.radius.xl,
        padding: tokens.spacing.lg,
        boxShadow: tokens.shadow.sm,
        border: '1px solid rgba(0,0,0,0.04)',
        textAlign: 'left',
        width: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
      }}
      className="hover:shadow-md"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: tokens.spacing.sm }}>
        <div
          style={{
            background: iconBg,
            padding: tokens.spacing.sm,
            borderRadius: tokens.radius.lg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon style={{ width: '18px', height: '18px', color: iconColor }} />
        </div>
        {trend}
      </div>
      <p style={{ fontSize: tokens.fontSize['2xl'], fontWeight: tokens.fontWeight.bold, color: '#111827' }}>
        {value}
      </p>
      <p style={{ fontSize: tokens.fontSize.sm, color: '#6B7280' }}>{label}</p>
    </button>
  );
}
