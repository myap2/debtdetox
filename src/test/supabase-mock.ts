/**
 * In-memory Supabase client mock for API route tests.
 *
 * Supports the query shapes used by the app's routes:
 *   from(t).select(...).eq(...)...  -> await (list) / .single() / .maybeSingle() / .order(...) / .limit(n)
 *   from(t).insert(data)            -> await ({ error }) / .select().single()
 *   from(t).update(data).eq(...)    -> await ({ error }) / .select().single()
 *   from(t).delete().eq(...)        -> await ({ error })
 *   from(t).upsert(data, opts)      -> .select().single()
 *
 * Rows live in plain arrays per table, so tests can assert on mutated state
 * (e.g., that a payment delete restored the debt balance).
 */

type Row = Record<string, unknown>;

export interface MockSupabaseState {
  tables: Record<string, Row[]>;
  user: { id: string; email?: string } | null;
}

let idCounter = 0;

export function createMockSupabase(state: MockSupabaseState) {
  function selectChain(rows: Row[], table?: string, columns?: string) {
    const filters: [string, unknown][] = [];

    // Minimal support for embedded relations like "plan_snapshots(id, ...)":
    // attach child rows whose "<singular parent>_id" points at the row.
    const relations = table
      ? [...(columns ?? '').matchAll(/(\w+)\(/g)].map((match) => match[1])
      : [];
    const foreignKey = table ? `${table.replace(/s$/, '')}_id` : '';
    const withRelations = (row: Row): Row => {
      if (relations.length === 0) return row;
      const expanded = { ...row };
      for (const relation of relations) {
        expanded[relation] = (state.tables[relation] ?? []).filter(
          (child) => child[foreignKey] === row.id
        );
      }
      return expanded;
    };

    const matchRows = () =>
      rows
        .filter((row) => filters.every(([col, val]) => row[col] === val))
        .map(withRelations);
    const chain = {
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return chain;
      },
      in(col: string, vals: unknown[]) {
        const matching = new Set(vals);
        // Model `in` as a filter over a snapshot of current matches
        const allowed = rows.filter((row) => matching.has(row[col]));
        return selectChain(allowed, table, columns);
      },
      order() {
        return chain;
      },
      limit(n: number) {
        const limited = matchRows().slice(0, n);
        return selectChain(limited);
      },
      async single() {
        const match = matchRows();
        return match.length > 0
          ? { data: match[0], error: null }
          : { data: null, error: { message: 'Row not found' } };
      },
      async maybeSingle() {
        const match = matchRows();
        return { data: match[0] ?? null, error: null };
      },
      then(resolve: (value: { data: Row[]; error: null; count: number }) => void) {
        const match = matchRows();
        resolve({ data: match, error: null, count: match.length });
      },
    };
    return chain;
  }

  return {
    auth: {
      async getUser() {
        return { data: { user: state.user } };
      },
    },
    from(table: string) {
      const rows = (state.tables[table] ??= []);
      return {
        select: (columns?: string) => selectChain(rows, table, columns),
        insert(data: Row) {
          const row: Row = {
            id: `${table}-${++idCounter}`,
            created_at: new Date().toISOString(),
            ...data,
          };
          rows.push(row);
          return {
            select: () => ({
              async single() {
                return { data: row, error: null };
              },
            }),
            then(resolve: (value: { data: Row; error: null }) => void) {
              resolve({ data: row, error: null });
            },
          };
        },
        update(data: Row) {
          return {
            eq(col: string, val: unknown) {
              const matched = rows.filter((row) => row[col] === val);
              matched.forEach((row) => Object.assign(row, data));
              return {
                select: () => ({
                  async single() {
                    return matched.length > 0
                      ? { data: matched[0], error: null }
                      : { data: null, error: { message: 'Row not found' } };
                  },
                }),
                then(resolve: (value: { error: null }) => void) {
                  resolve({ error: null });
                },
              };
            },
          };
        },
        upsert(data: Row, options?: { onConflict?: string }) {
          const conflictKey = options?.onConflict ?? 'id';
          const existing = rows.find((row) => row[conflictKey] === data[conflictKey]);
          let row: Row;
          if (existing) {
            Object.assign(existing, data);
            row = existing;
          } else {
            row = { id: `${table}-${++idCounter}`, created_at: new Date().toISOString(), ...data };
            rows.push(row);
          }
          return {
            select: () => ({
              async single() {
                return { data: row, error: null };
              },
            }),
          };
        },
        delete() {
          return {
            eq(col: string, val: unknown) {
              return {
                then(resolve: (value: { error: null }) => void) {
                  for (let i = rows.length - 1; i >= 0; i--) {
                    if (rows[i][col] === val) rows.splice(i, 1);
                  }
                  resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}
