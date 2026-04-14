import { tokens } from '../../styles/tokens';

interface RoleBadgeProps {
  role: 'member' | 'admin' | 'super_admin' | 'guest';
}

const config: Record<string, { label: string; bg: string; color: string; ring: string }> = {
  member: { label: 'Choir Member', bg: '#DCFCE7', color: '#166534', ring: '#BBF7D0' },
  admin: { label: 'Administrator', bg: tokens.accents.admin.primaryLight, color: tokens.accents.admin.primary, ring: '#BFDBFE' },
  super_admin: { label: 'Super Admin', bg: tokens.accents.superAdmin.primaryLight, color: tokens.accents.superAdmin.primary, ring: '#C7D2E8' },
  guest: { label: 'Guest', bg: '#DBEAFE', color: '#1E40AF', ring: '#BFDBFE' },
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const c = config[role] || config.member;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        borderRadius: tokens.radius.full,
        fontSize: tokens.fontSize.sm,
        fontWeight: tokens.fontWeight.semibold,
        background: c.bg,
        color: c.color,
        boxShadow: `inset 0 0 0 1px ${c.ring}`,
      }}
    >
      {c.label}
    </span>
  );
}
