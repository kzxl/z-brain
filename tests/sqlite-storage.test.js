const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { queryContext, saveQA, getDb } = require('../core/storage-sqlite');

test('SQLite backend initialization and schema', () => {
  const db = getDb();
  assert.ok(db, 'db instance should exist');
  const count = db.prepare('SELECT count(*) as count FROM knowledge_atoms').get();
  assert.ok(count.count > 0, 'should have knowledge atoms');
});

test('SQLite queryContext performs FTS5 search with L0 fields', () => {
  const results = queryContext('sqlite', { limit: 5 });
  assert.ok(Array.isArray(results));
  assert.ok(results.length > 0);
  assert.ok(results[0].id);
  assert.ok(results[0].question);
  assert.ok(results[0].answer);
});

test('SQLite queryContext filters by project', () => {
  const results = queryContext('test', { project: 'agentic-core', limit: 5 });
  assert.ok(Array.isArray(results));
  for (const item of results) {
    assert.ok(
      item.project_id === 'agentic-core' || item.scope === 'global' || item.project_id === 'global',
      `item ${item.id} (project=${item.project_id}, scope=${item.scope}) must match project or global scope`
    );
  }
});
