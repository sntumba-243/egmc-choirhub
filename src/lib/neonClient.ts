const API_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : '/api/neon';

interface Filter {
  column: string;
  operator: string;
  value: any;
}

class NeonQueryBuilder {
  private tableName: string;
  private selectColumns: string = '*';
  private filterList: Filter[] = [];
  private orderConfig: { column: string; ascending: boolean } | null = null;
  private limitValue: number | null = null;
  private isCountQuery: boolean = false;
  private isHeadQuery: boolean = false;
  private isSingle: boolean = false;

  constructor(table: string) {
    this.tableName = table;
  }

  select(columns: string = '*', options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    this.selectColumns = columns;
    if (options?.count) this.isCountQuery = true;
    if (options?.head) this.isHeadQuery = true;
    return this;
  }

  eq(column: string, value: any) {
    this.filterList.push({ column, operator: '=', value });
    return this;
  }

  neq(column: string, value: any) {
    this.filterList.push({ column, operator: '!=', value });
    return this;
  }

  gt(column: string, value: any) {
    this.filterList.push({ column, operator: '>', value });
    return this;
  }

  gte(column: string, value: any) {
    this.filterList.push({ column, operator: '>=', value });
    return this;
  }

  lt(column: string, value: any) {
    this.filterList.push({ column, operator: '<', value });
    return this;
  }

  lte(column: string, value: any) {
    this.filterList.push({ column, operator: '<=', value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filterList.push({ column, operator: 'IN', value: values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderConfig = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  single() {
    this.isSingle = true;
    this.limitValue = 1;
    return this;
  }

  async execute() {
    try {
      const action = this.isCountQuery && this.isHeadQuery ? 'count' : 'select';

      const response = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          table: this.tableName,
          columns: this.selectColumns,
          filters: this.filterList,
          order: this.orderConfig,
          limit: this.limitValue,
        })
      });

      const result = await response.json();

      if (!response.ok) {
        return { data: null, error: result.error, count: null };
      }

      if (this.isCountQuery) {
        return { data: null, count: result.count, error: null };
      }

      const data = this.isSingle ? (result.data?.[0] || null) : result.data;
      return { data, error: null, count: null };
    } catch (error: any) {
      console.error('Neon query error:', error);
      return { data: null, error: error.message, count: null };
    }
  }

  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }
}

class NeonInsertBuilder {
  private tableName: string;
  private insertData: any;

  constructor(table: string, data: any) {
    this.tableName = table;
    this.insertData = data;
  }

  async select() {
    return this.execute();
  }

  async execute() {
    try {
      const response = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'insert',
          table: this.tableName,
          data: this.insertData,
        })
      });
      const result = await response.json();
      if (!response.ok) return { data: null, error: result.error };
      return { data: result.data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  }

  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }
}

class NeonUpsertBuilder {
  private tableName: string;
  private upsertData: any;
  private conflictColumns: string;

  constructor(table: string, data: any, options?: { onConflict?: string }) {
    this.tableName = table;
    this.upsertData = data;
    this.conflictColumns = options?.onConflict || 'id';
  }

  async execute() {
    try {
      const response = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          table: this.tableName,
          data: this.upsertData,
          onConflict: this.conflictColumns,
        })
      });
      const result = await response.json();
      if (!response.ok) return { data: null, error: result.error };
      return { data: result.data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  }

  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }
}

class NeonDeleteBuilder {
  private tableName: string;
  private filterList: Filter[] = [];

  constructor(table: string) {
    this.tableName = table;
  }

  eq(column: string, value: any) {
    this.filterList.push({ column, operator: '=', value });
    return this;
  }

  async execute() {
    try {
      const response = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          table: this.tableName,
          filters: this.filterList,
        })
      });
      const result = await response.json();
      if (!response.ok) return { data: null, error: result.error };
      return { data: result.data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  }

  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }
}

class NeonUpdateBuilder {
  private tableName: string;
  private updateData: any;
  private filterList: Filter[] = [];

  constructor(table: string, data: any) {
    this.tableName = table;
    this.updateData = data;
  }

  eq(column: string, value: any) {
    this.filterList.push({ column, operator: '=', value });
    return this;
  }

  async execute() {
    try {
      const response = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          table: this.tableName,
          data: this.updateData,
          filters: this.filterList,
        })
      });
      const result = await response.json();
      if (!response.ok) return { data: null, error: result.error };
      return { data: result.data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  }

  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }
}

export const neonClient = {
  from(table: string) {
    return {
      select(columns?: string, options?: any) {
        const builder = new NeonQueryBuilder(table);
        return builder.select(columns, options);
      },
      insert(data: any) {
        return new NeonInsertBuilder(table, data);
      },
      update(data: any) {
        return new NeonUpdateBuilder(table, data);
      },
      upsert(data: any, options?: { onConflict?: string }) {
        return new NeonUpsertBuilder(table, data, options);
      },
      delete() {
        return new NeonDeleteBuilder(table);
      },
    };
  },

  // Stub for auth compatibility
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (_callback: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: null, error: { message: 'Auth not available in failover mode' } }),
    signOut: async () => ({ error: null }),
  },

  storage: {
    from: (_bucket: string) => ({
      getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
    }),
  },
};
