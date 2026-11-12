// Minimal Cloudflare D1 stand-in on top of Node's built-in SQLite, so the real Worker code
// (prepare/bind/run/all/first) runs unchanged in tests.
import { DatabaseSync } from 'node:sqlite';

export function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  return {
    exec: async (sql) => db.exec(sql),
    prepare(sql) {
      const st = db.prepare(sql);
      let args = [];
      const o = {
        bind: (...a) => { args = a; return o; },
        run: async () => { const r = st.run(...args); return { success: true, meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; },
        all: async () => ({ results: st.all(...args).map((r) => ({ ...r })) }),
        first: async () => { const r = st.get(...args); return r ? { ...r } : null; },
      };
      return o;
    },
  };
}
