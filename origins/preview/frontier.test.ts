// Origins slice 1 (?region=1): the Ash Frontier laid out from the Region 1 data, walkable from the Exchange to the Bounty giver and back,
// the Bounty in the journal, and each zone's ambience preset. Pure: no DOM (exchange.ts's walkable uses three.js maths only).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CharacterInstanceId, QuestId } from '../contracts/ids.ts';
import { parseQuestDefinition } from '../contracts/story.ts';
import { advance, entries, newJournal } from '../quests/journal.ts';
import { loadRegion1 } from '../region1/load.ts';
import { choices, loadTalk, newTalkState, pick } from '../talk/talk.ts';
import { bountyQuest, bountyQuestId, giverTalk } from './bounty.ts';
import { exchangeAnchors, exchangePlan, openWest } from './exchange-plan.ts';
import { walkable } from './exchange.ts';
import { frontierBuild, frontierPlan, frontierWalkable, frontierZoneAt } from './frontier-plan.ts';

const F = frontierPlan(), B = frontierBuild(F), CM = 0.01;
const walk = (x: number, z: number) => walkable(x, z) || frontierWalkable(F, B, x, z);

test('each zone carries its look preset: ash-pit at the Pit gate, exchange-dusk in the Exchange, frontier-haze on the Frontier', () => {
  const r = loadRegion1();
  assert.ok(r.ok);
  const presets = Object.fromEntries([...r.value.zones].flatMap(([, zones]) => [...zones].map(([id, p]) => [id, p.ambience.preset])));
  assert.deepEqual(presets, {
    'pit-yard': 'ash-pit', exchange: 'exchange-dusk', 'exchange-quarter': 'exchange-dusk',
    'east-road': 'frontier-haze', 'ferry-landing': 'frontier-haze', 'cinder-fields': 'frontier-haze', 'black-mere': 'frontier-haze',
    'blood-ruin': 'frontier-haze', 'cinder-hold': 'frontier-haze', 'mere-end': 'frontier-haze',
  });
});

test('the layout follows the data: every road link meets its far landmark, facing back; the east road starts at the west road', () => {
  const byZone = new Map(F.zones.map((z) => [z.zone, z]));
  let roads = 0;
  for (const z of F.zones) for (const l of z.links) {
    const there = byZone.get(l.to);
    if (l.kind === 'portal' || !there || z.region !== there.region || z.region !== F.giver.bounty.region) continue;
    const back = there.links.find((k) => k.to === z.zone)!, a = z.landmarks[l.here]!, b = there.landmarks[back.here]!;
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < CM, `${z.zone}.${l.here} meets ${l.to}.${back.here}`);
    assert.ok(Math.abs(Math.cos(a.facing - b.facing) + 1) < 1e-9, `${z.zone}.${l.here} faces ${l.to}.${back.here}`);
    roads++;
  }
  assert.ok(roads >= 12, `${roads} road ends checked`);
  const gate = byZone.get('east-road')!.landmarks['exchange-gate']!;
  assert.ok(Math.hypot(gate.x - F.road.to.x, gate.z - F.road.to.z) < CM);
  assert.ok(Math.hypot(F.road.from.x - exchangeAnchors().gate.x + 20, F.road.from.z - -50) < CM, 'the west road leaves the west gate (u 0, v 0.5)');
  assert.equal(frontierZoneAt(F, F.giver.at.x, F.giver.at.z)?.zone, 'cinder-hold');
});

test('the walk: from the Exchange plaza, out of the west gate, to the Bounty giver in Cinder Hold, and back', () => {
  const step = 1, key = (x: number, z: number) => `${x},${z}`;
  const reach = (from: [number, number], to: { x: number; z: number }) => {
    const seen = new Set([key(...from)]), queue: [number, number][] = [from];
    while (queue.length) {
      const [x, z] = queue.shift()!;
      if (Math.hypot(x - to.x, z - to.z) < 2) return true;
      for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
        const nx = x + dx, nz = z + dz, k = key(nx, nz);
        if (seen.has(k) || !walk(nx, nz) || !walk((x + nx) / 2, (z + nz) / 2)) continue;
        seen.add(k); queue.push([nx, nz]);
      }
    }
    return false;
  };
  assert.ok(walk(0, -30) && walk(Math.round(F.giver.at.x), Math.round(F.giver.at.z)));
  assert.ok(reach([0, -30], F.giver.at), 'the plaza reaches the giver');
  assert.ok(reach([Math.round(F.giver.at.x), Math.round(F.giver.at.z)], { x: 0, z: -30 }), 'and the giver reaches the plaza');
  assert.ok(walk(-25, -50) && !walkable(-25, -50), 'the west road is walkable only with the Frontier');
});

test('the west gate opens only where the road leaves, and only with the flag', () => {
  const plain = exchangePlan(), open = openWest(plain, exchangeAnchors(), F.road.from.z, F.road.width / 2 + 0.3);
  const blocks = (pieces: typeof plain.pieces) => pieces.filter((p) => p.shape[0] === 'box' && p.y > 0 && p.x < -17 && Math.abs(p.z - F.road.from.z) < p.shape[3] / 2 + F.road.width / 2);
  assert.ok(blocks(plain.pieces).length > 0, 'today the wall stands across the road');
  assert.equal(blocks(open.pieces).length, 0, 'opened: nothing stands across it');
  assert.ok(open.pieces.length >= plain.pieces.length - 1);
});

test('the Bounty giver puts the Bounty in the quest journal', () => {
  const g = F.giver;
  assert.equal(g.name, 'Warden Brannoc'); assert.equal(g.bounty.id, 'bounty:hrungnir'); assert.equal(g.foe, 'Hrungnir');
  const q = parseQuestDefinition(bountyQuest(g)), talk = loadTalk(giverTalk(g));
  assert.ok(q.ok, JSON.stringify(q)); assert.ok(talk.ok, JSON.stringify(talk));
  const quests = new Map([[q.value.id, q.value]]), standing = { source: 'server', careerLevel: 16 } as const;
  let journal = newJournal('character-instance:pc' as CharacterInstanceId);
  const facts = () => ({ standing, quest: (id: QuestId) => journal.quests.get(id), hasItem: () => false });
  assert.deepEqual(choices(talk.value, newTalkState(), facts()).map((l) => l.id), ['work', 'farewell']);
  const r = pick(talk.value, newTalkState(), 'work', facts(), (quest, stage) => {
    const a = advance(journal, quest, stage, { quests, standing, at: '2026-10-07T10:00:00Z', hasItem: () => false });
    return a.ok ? { ok: true, value: a.value.journal } : a;
  });
  assert.ok(r.ok, JSON.stringify(r));
  journal = r.value.journal!;
  assert.equal(journal.quests.get(bountyQuestId(g) as QuestId)?.stage, 'posted');
  const [entry] = entries(journal);
  assert.match(entry!.text, /Hrungnir/); assert.match(entry!.text, /40 bronze/); assert.match(entry!.text, /Embers/);
});
