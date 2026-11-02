const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.ZBRAIN_DB_PATH || 'C:\\Users\\phong.vo\\source\\repos\\z-brain\\plugins\\z-brain\\data\\zbrain.sqlite';

let _db = null;

function getDb() {
  if (_db) return _db;
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Z-Brain SQLite database not found at: ${DB_PATH}`);
  }
  _db = new DatabaseSync(DB_PATH);
  _db.exec('PRAGMA journal_mode = WAL;');
  _db.exec('PRAGMA synchronous = NORMAL;');
  return _db;
}

function queryContext(query, opts = {}) {
  const db = getDb();
  const limit = opts.limit || 5;
  const project = opts.project ? String(opts.project).trim().toLowerCase() : null;

  const words = (query || '')
    .replace(/["'*():^{}[\]\\/]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !/^(the|and|for|with|from|this|that|trong|cho|cua|la|cac)$/i.test(w));

  if (words.length === 0) return [];
  const ftsQuery = words.map(w => `"${w}"*`).join(' OR ');

  let sql = `
    SELECT 
      a.id, a.project_id, a.scope, a.trust_level, 
      a.question, a.answer, a.gotcha_fix, a.tags, 
      f.rank as bm25_rank
    FROM knowledge_fts f
    JOIN knowledge_atoms a ON a.id = f.rowid
    WHERE knowledge_fts MATCH ?
  `;
  const params = [ftsQuery];

  if (project) {
    sql += ` AND (a.project_id = ? OR a.scope = 'global' OR a.project_id = 'global')`;
    params.push(project);
  }

  sql += ` ORDER BY bm25_rank ASC LIMIT ?`;
  params.push(limit);

  try {
    const rows = db.prepare(sql).all(...params);
    return rows.map(r => ({
      id: r.id,
      question: r.question,
      answer_context: r.answer,
      gotcha_fix: r.gotcha_fix,
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags || '[]') : r.tags,
      project_id: r.project_id,
      trust_level: r.trust_level,
      score: 1.0 - (r.bm25_rank / 100)
    }));
  } catch (err) {
    return [];
  }
}

function saveQA(question, answer, opts = {}) {
  const db = getDb();
  const now = new Date().toISOString();
  const project = (opts.project || 'global').toLowerCase();
  const scope = project === 'global' ? 'global' : 'project';
  const trust = opts.trustLevel || opts.trust_level || 'observation';
  const tags = Array.isArray(opts.tags) 
    ? JSON.stringify(opts.tags) 
    : (typeof opts.tags === 'string' ? JSON.stringify(opts.tags.split(',').map(t => t.trim())) : '[]');
  const evidence = Array.isArray(opts.evidence) ? JSON.stringify(opts.evidence) : '[]';

  const stmt = db.prepare(`
    INSERT INTO knowledge_atoms (
      project_id, scope, trust_level, question, answer, gotcha_fix,
      tags, evidence, category, confidence, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    project,
    scope,
    trust,
    question,
    answer,
    opts.gotchaFix || question.slice(0, 160),
    tags,
    evidence,
    opts.category || 'general',
    opts.confidence || 0.7,
    now,
    now
  );

  const rowid = db.prepare('SELECT last_insert_rowid() as id').get().id;
  return { id: rowid, backend: 'sqlite' };
}

module.exports = { queryContext, saveQA, getDb };
