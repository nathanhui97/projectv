// Run with: node packages/schemas/verify-phase1.cjs
// Verifies Phase 1 schema additions and Phase 2 normalizeFilter converter.
const { StepSchema, DurationSchema, normalizeFilter, normalizeAbilityFilters } = require('./dist/index.js');

let passed = 0;
let failed = 0;

function ok(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function rejects(label, fn) {
  try {
    fn();
    console.error(`  ✗ ${label} (expected rejection, but it parsed)`);
    failed++;
  } catch {
    console.log(`  ✓ ${label} (correctly rejected)`);
    passed++;
  }
}

// ── DurationSchema new values ───────────────────────────────────────────────
console.log('\nDurationSchema:');
ok('end_of_battle', () => DurationSchema.parse('end_of_battle'));
ok('while_linked',  () => DurationSchema.parse('while_linked'));
ok('until_destroyed', () => DurationSchema.parse('until_destroyed'));
rejects('until_unlinked (old, invalid)', () => DurationSchema.parse('until_unlinked'));

// ── New step action types ────────────────────────────────────────────────────
console.log('\nStepSchema — new action types:');

ok('exile', () => StepSchema.parse({ action: 'exile', target: '$target' }));

ok('discard_from_hand', () => StepSchema.parse({
  action: 'discard_from_hand', side: 'enemy', amount: 1, selector: 'controller_chooses',
}));

ok('prevent_ready', () => StepSchema.parse({
  action: 'prevent_ready', target: '$target', duration: 'end_of_turn',
}));

ok('grant_taunt', () => StepSchema.parse({
  action: 'grant_taunt', target: '$target', duration: 'permanent',
}));

ok('change_attack_target', () => StepSchema.parse({
  action: 'change_attack_target', new_target: '$blocker',
}));

ok('modify_cost', () => StepSchema.parse({
  action: 'modify_cost', target: '$target', amount: -2, duration: 'end_of_turn',
}));

ok('add_ex_resource', () => StepSchema.parse({
  action: 'add_ex_resource', side: 'friendly', amount: 1,
}));

ok('count_zone — hand', () => StepSchema.parse({
  action: 'count_zone', side: 'friendly', zone: 'hand', store_as: '$hand_count',
}));

ok('count_zone — with filter', () => StepSchema.parse({
  action: 'count_zone', side: 'friendly', zone: 'battle_area',
  filter: { all_of: [{ side: 'friendly' }, { type: 'unit' }] },
  store_as: '$unit_count',
}));

// ── Existing types still work ────────────────────────────────────────────────
console.log('\nStepSchema — existing types still intact:');

ok('choose_target', () => StepSchema.parse({
  action: 'choose_target',
  filter: { all_of: [{ side: 'enemy' }, { type: 'unit' }] },
  selector: 'controller_chooses', min: 1, max: 1, store_as: '$t',
}));

ok('deal_damage', () => StepSchema.parse({
  action: 'deal_damage', target: '$target', amount: 3, damage_type: 'effect',
}));

ok('modify_stat with while_linked', () => StepSchema.parse({
  action: 'modify_stat', target: '$target', stat: 'ap', amount: 2, duration: 'while_linked',
}));

ok('prompt_yes_no with nested steps', () => StepSchema.parse({
  action: 'prompt_yes_no', prompt: 'Do you want to?', store_as: '$c',
  on_yes: [{ action: 'draw', side: 'friendly', amount: 1 }],
  on_no: [],
}));

ok('manual_resolve', () => StepSchema.parse({
  action: 'manual_resolve', prompt_text: 'Resolve manually.',
}));

// ── Rejection sanity checks ──────────────────────────────────────────────────
console.log('\nReject invalid shapes:');
rejects('exile missing target',        () => StepSchema.parse({ action: 'exile' }));
rejects('grant_taunt missing duration',() => StepSchema.parse({ action: 'grant_taunt', target: '$t' }));
rejects('count_zone missing store_as', () => StepSchema.parse({ action: 'count_zone', side: 'controller', zone: 'hand' }));
rejects('unknown action type',         () => StepSchema.parse({ action: 'fly_to_the_moon' }));

// ── normalizeFilter (shorthand → FilterSchema) ───────────────────────────────
console.log('\nnormalizeFilter converter:');

ok('single-key shorthand → passthrough', () => {
  const r = normalizeFilter({ side: 'enemy' });
  if (!r.side) throw new Error('missing side');
});

ok('multi-key shorthand → all_of', () => {
  const r = normalizeFilter({ type: 'unit', side: 'enemy' });
  if (!r.all_of || r.all_of.length !== 2) throw new Error('expected all_of with 2 clauses');
});

ok('max_hp shorthand → hp op <=', () => {
  const r = normalizeFilter({ type: 'unit', side: 'enemy', max_hp: 3 });
  const hp = r.all_of?.find(c => c.hp);
  if (!hp || hp.hp.op !== '<=' || hp.hp.value !== 3) throw new Error('hp clause wrong');
});

ok('rested shorthand → is_resting', () => {
  const r = normalizeFilter({ side: 'enemy', rested: true });
  const rest = r.all_of?.find(c => c.is_resting);
  if (!rest) throw new Error('missing is_resting clause');
});

ok('not_self shorthand → exclude_self', () => {
  const r = normalizeFilter({ side: 'enemy', not_self: true });
  const excl = r.all_of?.find(c => c.exclude_self);
  if (!excl) throw new Error('missing exclude_self clause');
});

ok('already-formal all_of passes through', () => {
  const input = { all_of: [{ side: 'enemy' }, { type: 'unit' }] };
  const r = normalizeFilter(input);
  if (!r.all_of) throw new Error('all_of was not preserved');
});

ok('already-formal level op passes through', () => {
  const input = { level: { op: '<=', value: 5 } };
  const r = normalizeFilter(input);
  if (!r.level) throw new Error('level was not preserved');
});

ok('normalizeAbilityFilters converts nested step filters', () => {
  const ability = {
    id: 'a1',
    steps: [
      { action: 'choose_target', filter: { type: 'unit', side: 'enemy', max_hp: 5 }, store_as: '$t', min: 1, max: 1, selector: 'controller_chooses' },
    ],
  };
  const normalized = normalizeAbilityFilters(ability);
  const step = normalized.steps[0];
  if (!step.filter.all_of) throw new Error('filter was not normalized');
});

rejects('empty shorthand throws', () => normalizeFilter({}));

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} checks — ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
