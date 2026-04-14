import type { CSSProperties, ReactNode } from 'react';
import { tokens } from '../../styles/tokens';

interface PageCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  as?: 'div' | 'button';
}

export function PageCard({ children, className = '', style, onClick, as = 'div' }: PageCardProps) {
  const Tag = as;
  return (
    <Tag
      className={className}
      onClick={onClick}
      style={{
        background: 'white',
        borderRadius: tokens.radius.xl,
        boxShadow: tokens.shadow.sm,
        border: '1px solid rgba(0,0,0,0.04)',
        ...(as === 'button' ? { textAlign: 'left' as const, width: '100%' } : {}),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
