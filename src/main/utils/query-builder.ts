/**
 * SQL WHERE clause builder for parameterized queries.
 * Eliminates duplicated filter logic across DatabaseService and ExportService.
 */
export class QueryBuilder {
  private conditions: string[] = [];
  private params: unknown[] = [];

  whereIso3In(iso3List: string[] | undefined, column = 'iso3'): this {
    if (iso3List && iso3List.length > 0) {
      const placeholders = iso3List.map(() => '?').join(', ');
      this.conditions.push(`${column} IN (${placeholders})`);
      this.params.push(...iso3List);
    }
    return this;
  }

  whereAfterDate(date: string | undefined, column = 'event_date'): this {
    if (date) {
      this.conditions.push(`${column} >= ?`);
      this.params.push(date);
    }
    return this;
  }

  whereBeforeDate(date: string | undefined, column = 'event_date'): this {
    if (date) {
      this.conditions.push(`${column} <= ?`);
      this.params.push(date);
    }
    return this;
  }

  whereTypeIn(types: string[] | undefined, column = 'event_type'): this {
    if (types && types.length > 0) {
      const placeholders = types.map(() => '?').join(', ');
      this.conditions.push(`${column} IN (${placeholders})`);
      this.params.push(...types);
    }
    return this;
  }

  whereMinValue(value: number | undefined | null, column: string): this {
    if (value !== undefined && value !== null) {
      this.conditions.push(`${column} >= ?`);
      this.params.push(value);
    }
    return this;
  }

  whereYearAfter(year: number | undefined, column = 'year'): this {
    if (year !== undefined) {
      this.conditions.push(`${column} >= ?`);
      this.params.push(year);
    }
    return this;
  }

  whereYearBefore(year: number | undefined, column = 'year'): this {
    if (year !== undefined) {
      this.conditions.push(`${column} <= ?`);
      this.params.push(year);
    }
    return this;
  }

  buildWhereClause(): string {
    if (this.conditions.length === 0) return '';
    return 'WHERE ' + this.conditions.join(' AND ');
  }

  buildParams(): unknown[] {
    return [...this.params];
  }

  build(): { where: string; params: unknown[] } {
    return {
      where: this.buildWhereClause(),
      params: this.buildParams(),
    };
  }
}
