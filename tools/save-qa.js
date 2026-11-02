/**
 * save-qa.js - Single CLI entry point for writing knowledge.
 *
 * Phase 0:
 *   - PostgreSQL is canonical; AME is written only when explicitly enabled.
 *   - `--project` is preserved and enforced by KnowledgeWriter.
 *   - confidence is never inflated to 1.0 by default.
 *
 * Usage:
 *   node tools/save-qa.js "<Question>" "<Answer>" [--source=manual] [--confidence=0.5]
 *        [--category=general] [--tags=a,b] [--project=erp] [--pinned] [--dry-run]
 *
 *   --dry-run prints what would be written and exits without touching the database.
 */
const { pool, storageAme, storageSqlite, config, captureKnowledge } = require('../core');

function parseArgs(args) {
  const opts = {
    source: 'manual',
    category: 'general',
    tags: [],
    confidence: 0.5,
    project: null,
    pinned: false,
    scope: null,
    allowLong: false,
    trustLevel: null,
    verifier: null,
    validFrom: null,
    validTo: null,
    status: null,
    evidence: [],
    dryRun: false,
  };
  // Values may legitimately contain '=' (file paths, evidence URIs), so never split.
  const valueOf = (arg, prefix) => arg.slice(prefix.length);
  for (const arg of args) {
    if (arg.startsWith('--source=')) opts.source = valueOf(arg, '--source=');
    else if (arg.startsWith('--category=')) opts.category = valueOf(arg, '--category=');
    else if (arg.startsWith('--confidence=')) opts.confidence = parseFloat(valueOf(arg, '--confidence='));
    else if (arg.startsWith('--tags=')) opts.tags = valueOf(arg, '--tags=').split(',').map(t => t.trim()).filter(Boolean);
    else if (arg.startsWith('--project=')) opts.project = valueOf(arg, '--project=').trim().toLowerCase();
    else if (arg.startsWith('--scope=')) {
      const scope = valueOf(arg, '--scope=').trim().toLowerCase();
      if (scope === 'global' || scope === 'project') opts.scope = scope;
    }
    else if (arg.startsWith('--trust=')) opts.trustLevel = valueOf(arg, '--trust=');
    else if (arg.startsWith('--verifier=')) opts.verifier = valueOf(arg, '--verifier=');
    else if (arg.startsWith('--valid-from=')) opts.validFrom = valueOf(arg, '--valid-from=');
    else if (arg.startsWith('--valid-to=')) opts.validTo = valueOf(arg, '--valid-to=');
    else if (arg.startsWith('--status=')) opts.status = valueOf(arg, '--status=');
    else if (arg.startsWith('--evidence=')) opts.evidence = valueOf(arg, '--evidence=').split(',').map(t => t.trim()).filter(Boolean);
    else if (arg === '--pinned') opts.pinned = true;
    else if (arg === '--allow-long') opts.allowLong = true;
    else if (arg === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

async function saveQA(question, answer) {
  if (!question || !answer) {
    console.log('Usage: node save-qa.js "<Question>" "<Answer>" [--source=manual] [--confidence=0.5] [--category=general] [--tags=a,b] [--project=erp] [--scope=global|project] [--trust=...) [--verifier=...] [--evidence=...] [--pinned] [--allow-long] [--dry-run]');
    process.exit(1);
  }

  const opts = parseArgs(process.argv.slice(4));

  if (answer.length > 2000 && !opts.allowLong) {
    console.error('[REJECTED] Answer exceeds 2000 characters. Split it into atomic lessons or pass --allow-long explicitly.');
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log('[DRY-RUN] No rows written.');
    console.log(`  project: ${opts.project || 'global'} | scope: ${opts.scope || 'auto'} | source: ${opts.source} | trust: ${opts.trustLevel || 'auto'}`);
    console.log(`  Q: ${question}`);
    console.log(`  A: ${answer}`);
    if (opts.tags.length) console.log(`  tags: ${opts.tags.join(',')}`);
    if (opts.evidence.length) console.log(`  evidence: ${opts.evidence.join(',')}`);
    return;
  }

  try {
    if (config.backend === 'sqlite') {
      const res = storageSqlite.saveQA(question, answer, opts);
      console.log(`[+] SQLite saved id=${res.id} [project: ${opts.project || 'global'}]`);
      return;
    }

    // AME is opt-in. backend=ame requires it; backend=postgres does not.
    const ameEnabled = config.ame?.write === true || config.backend === 'ame';
    let ameSaved = false;

    if (ameEnabled) {
      try {
        const status = await storageAme.isAmeAvailable();
        if (status.available) {
          const res = await storageAme.saveQA(question, answer, opts);
          ameSaved = true;
          console.log(`[+] AME saved (${res.backend}) [project: ${opts.project || 'global'}]`);
        } else {
          console.warn(`[WARN] AME requested but unavailable: ${status.reason || 'unknown'}`);
        }
      } catch (err) {
        console.warn(`[WARN] AME save failed: ${err.message}`);
      }
    }

    if (config.backend === 'ame') {
      if (!ameSaved) {
        console.error('[FATAL] MEMORY_BACKEND=ame but AME is unavailable; refusing to report success.');
        process.exitCode = 2;
      }
      return;
    }

    const result = await captureKnowledge({
      question,
      answer,
      source: opts.source,
      category: opts.category,
      tags: opts.tags,
      confidence: opts.confidence,
      project: opts.project,
      pinned: opts.pinned,
      scope: opts.scope,
      trustLevel: opts.trustLevel,
      verifier: opts.verifier,
      validFrom: opts.validFrom,
      validTo: opts.validTo,
      status: opts.status,
      evidence: opts.evidence,
    });

    if (result.status === 'updated') {
      console.log(`[~] QA updated [${result.matchType}] id=${result.id} [project: ${opts.project || 'global'}]`);
    } else {
      console.log(`[+] QA saved id=${result.id} [project: ${opts.project || 'global'}]`);
    }
  } catch (err) {
    console.error('[ERROR]', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

saveQA(process.argv[2], process.argv[3]);
