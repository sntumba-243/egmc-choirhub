const API_URL = 'http://localhost:3001/api';

interface Filter {
  column: string;
  operator: string;
  value: any;
}

class NeonQueryBuilder {
  private tableName: string;
  private selectColumns: string = '*';
  private filterList: Filter[] = [];
  private orderBy: string | null = null;
  private limitValue: number | null = null;
  private isCountQuery: boolean = false;
  private isHeadQuery: boolean = false;

  constructor(table: string) {
    this.tableName = table;
  }

  select(columns: string = '*', options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    this.selectColumns = columns;
    if (options?.count) {
      this.isCountQuery = true;
    }
    if (options?.head) {
      this.isHeadQuery = true;
    }
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

  order(column: string, options?: { ascending?: boolean }) {
    const direction = options?.ascending === false ? 'DESC' : 'ASC';
    this.orderBy = `${column} ${direction}`;
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  async execute() {
    try {
      if (this.isCountQuery) {
        const response = await fetch(`${API_URL}/count`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: this.tableName,
            filters: this.filterList
          })
        });
        
        const result = await response.json();
        return { data: null, count: result.count, error: null };
      }

      const response = await fetch(`${API_URL}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: this.tableName,
          columns: this.selectColumns,
          filters: this.filterList,
          order: this.orderBy,
          limit: this.limitValue
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        return { data: null, error: result.error, count: null };
      }

      return { 
        data: result.data, 
        error: null,
        count: this.isCountQuery ? result.count : null 
      };
    } catch (error: any) {
      console.error('Neon query error:', error);
      return { data: null, error: error.message, count: null };
    }
  }

  // Make it thenable so it works with await
  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }
}

export const neonClient = {
  from(table: string) {
    return new NeonQueryBuilder(table);
  }
};
