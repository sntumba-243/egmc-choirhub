const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds
const RETRY_INTERVAL = 60000; // Check every 60 seconds
const FAILOVER_CACHE_KEY = 'database_failover_status';

interface FailoverStatus {
  usingNeon: boolean;
  lastCheck: number;
  supabaseHealthy: boolean;
}

export class AutoFailover {
  private static instance: AutoFailover;
  private status: FailoverStatus;
  private checkInterval: number | null = null;

  private constructor() {
    // Load cached status
    const cached = localStorage.getItem(FAILOVER_CACHE_KEY);
    this.status = cached ? JSON.parse(cached) : {
      usingNeon: false,
      lastCheck: 0,
      supabaseHealthy: true
    };
  }

  static getInstance(): AutoFailover {
    if (!AutoFailover.instance) {
      AutoFailover.instance = new AutoFailover();
    }
    return AutoFailover.instance;
  }

  async checkSupabaseHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok || response.status === 401; // 401 is ok, means Supabase is up
    } catch (error) {
      console.warn('⚠️ Supabase health check failed:', error);
      return false;
    }
  }

  async initialize(): Promise<boolean> {
    console.log('🔍 Checking database health...');
    
    const isHealthy = await this.checkSupabaseHealth();
    
    this.status = {
      usingNeon: !isHealthy,
      lastCheck: Date.now(),
      supabaseHealthy: isHealthy
    };

    this.saveStatus();

    if (!isHealthy) {
      console.log('🔄 Supabase unreachable - failing over to Neon');
      this.showFailoverNotification();
      this.startPeriodicCheck();
    } else {
      console.log('✅ Using Supabase (primary database)');
    }

    return !isHealthy; // Return true if using Neon
  }

  private showFailoverNotification() {
    if (typeof window !== 'undefined') {
      const notification = document.createElement('div');
      notification.id = 'failover-notification';
      Object.assign(notification.style, {
        position: 'fixed', top: '20px', right: '20px',
        background: '#FFA500', color: 'white', padding: '16px 20px',
        borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: '9999', maxWidth: '350px',
        fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '14px',
        display: 'flex', alignItems: 'center', gap: '10px',
      });

      const icon = document.createElement('span');
      icon.style.fontSize = '20px';
      icon.textContent = '\u26A0\uFE0F';

      const text = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = 'Running on Backup Database';
      const desc = document.createElement('div');
      Object.assign(desc.style, { fontSize: '12px', marginTop: '4px', opacity: '0.9' });
      desc.textContent = 'Primary database unavailable. Using Neon backup.';
      text.appendChild(title);
      text.appendChild(desc);

      notification.appendChild(icon);
      notification.appendChild(text);

      // Remove after 10 seconds
      setTimeout(() => {
        document.getElementById('failover-notification')?.remove();
      }, 10000);

      document.body.appendChild(notification);
    }
  }

  private startPeriodicCheck() {
    // Check Supabase health every minute
    this.checkInterval = window.setInterval(async () => {
      const isHealthy = await this.checkSupabaseHealth();
      
      if (isHealthy && this.status.usingNeon) {
        console.log('✅ Supabase recovered! Reloading to switch back...');
        this.status.usingNeon = false;
        this.status.supabaseHealthy = true;
        this.saveStatus();
        
        // Show recovery notification
        if (confirm('Primary database is back online! Reload to switch back?')) {
          window.location.reload();
        }
      }
    }, RETRY_INTERVAL);
  }

  private saveStatus() {
    localStorage.setItem(FAILOVER_CACHE_KEY, JSON.stringify(this.status));
  }

  isUsingNeon(): boolean {
    return this.status.usingNeon;
  }

  cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

export const autoFailover = AutoFailover.getInstance();
