import type { ReactNode } from 'react';
import { tokens } from '../../styles/tokens';

interface SectionTitleProps {
  children: ReactNode;
  icon?: ReactNode;
}

export function SectionTitle({ children, icon }: SectionTitleProps) {
  return (
    <h2
      style={{
        fontSize: tokens.fontSize.md,
        fontWeight: tokens.fontWeight.bold,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
      }}
    >
      {icon}
      <span>{children}</span>
    </h2>
  );
}
