import { tokens } from '../../styles/tokens';

interface LoadingSkeletonProps {
  variant?: 'dashboard' | 'card' | 'list';
}

function Bone({ width = '100%', height = '16px', radius = tokens.radius.md }: { width?: string; height?: string; radius?: string }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
      }}
    />
  );
}

export function LoadingSkeleton({ variant = 'dashboard' }: LoadingSkeletonProps) {
  if (variant === 'card') {
    return (
      <div style={{ background: 'white', borderRadius: tokens.radius.xl, padding: tokens.spacing.xl, boxShadow: tokens.shadow.sm }}>
        <Bone width="40px" height="40px" radius={tokens.radius.lg} />
        <div style={{ marginTop: '12px' }}>
          <Bone width="60%" height="24px" />
        </div>
        <div style={{ marginTop: '8px' }}>
          <Bone width="40%" height="14px" />
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ background: 'white', borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, display: 'flex', alignItems: 'center', gap: tokens.spacing.md, boxShadow: tokens.shadow.sm }}>
            <Bone width="40px" height="40px" radius={tokens.radius.lg} />
            <div style={{ flex: 1 }}>
              <Bone width="70%" height="16px" />
              <div style={{ marginTop: '6px' }}>
                <Bone width="40%" height="12px" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // dashboard variant
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.md }}>
        <Bone width="40px" height="40px" radius={tokens.radius.lg} />
        <div>
          <Bone width="180px" height="24px" />
          <div style={{ marginTop: '6px' }}>
            <Bone width="120px" height="14px" />
          </div>
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: tokens.spacing.md }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ background: 'white', borderRadius: tokens.radius.xl, padding: tokens.spacing.xl, boxShadow: tokens.shadow.sm }}>
            <Bone width="36px" height="36px" radius={tokens.radius.lg} />
            <div style={{ marginTop: '12px' }}>
              <Bone width="50%" height="28px" />
            </div>
            <div style={{ marginTop: '6px' }}>
              <Bone width="60%" height="12px" />
            </div>
          </div>
        ))}
      </div>

      {/* List skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ background: 'white', borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, display: 'flex', alignItems: 'center', gap: tokens.spacing.md, boxShadow: tokens.shadow.sm }}>
            <Bone width="44px" height="44px" radius={tokens.radius.lg} />
            <div style={{ flex: 1 }}>
              <Bone width="65%" height="16px" />
              <div style={{ marginTop: '6px' }}>
                <Bone width="35%" height="12px" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
