import type { LucideIcon } from 'lucide-react';
import { tokens } from '../../styles/tokens';

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
}

export function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing['3xl'],
        textAlign: 'center',
        border: '1px solid rgba(0,0,0,0.04)',
      }}
    >
      <Icon
        style={{
          width: '48px',
          height: '48px',
          color: '#D1D5DB',
          margin: '0 auto 8px',
        }}
      />
      <p style={{ fontSize: tokens.fontSize.base, color: '#6B7280' }}>{message}</p>
    </div>
  );
}
