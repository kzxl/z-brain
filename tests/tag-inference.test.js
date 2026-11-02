const test = require('node:test');
const assert = require('node:assert');
const { inferTags } = require('../core/keywords');

const tagsOf = (question, answer = '') => inferTags(question, answer, []);

test('generic prose does not trigger tech tags', () => {
  const tags = tagsOf(
    'post-task dry-run writes a real row',
    'Count the rows before and after, then delete the probe row by question match.'
  );
  assert.ok(!tags.includes('tech:devexpress'), 'bare "row" must not imply DevExpress');
  assert.ok(!tags.includes('tech:async'), 'bare "task" must not imply async');
  assert.ok(!tags.includes('tech:ua'), 'substring "ua" must not imply UA');
  assert.ok(!tags.includes('domain:production'), 'bare "job" must not imply production');
});

test('substring matches no longer tag unrelated words', () => {
  assert.ok(!tagsOf('manual release checklist').includes('tech:ua'));
  assert.ok(!tagsOf('lowercase identifiers in python').includes('domain:tss'));
});

test('precise tokens still infer their tags', () => {
  assert.ok(tagsOf('GridControl column binding').includes('tech:devexpress'));
  assert.ok(tagsOf('async await deadlock').includes('tech:async'));
  assert.ok(tagsOf('UA thin view controller delegates').includes('tech:ua'));
  assert.ok(tagsOf('ticket warranty handover').includes('domain:tss'));
  assert.ok(tagsOf('DTO mapping for viewmodel').includes('pattern:dto'));
});
