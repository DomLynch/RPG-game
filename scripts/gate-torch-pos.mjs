// Prints the goblin camp's fire positions (the lit gate sconces among them) and the gate-torch recipe rows: node --experimental-strip-types scripts/gate-torch-pos.mjs
const { frontierBuild, frontierPlan } = await import(process.cwd() + '/origins/preview/frontier-plan.ts');
const { propKit } = await import(process.cwd() + '/origins/preview/prop-kit.ts');
const { frontierDress } = await import(process.cwd() + '/origins/preview/frontier-dress.ts');
const { withCinder } = await import(process.cwd() + '/origins/preview/frontier-cinder.ts');
const { goblinZone } = await import(process.cwd() + '/origins/world/goblin-field-rules.ts');
const { recipesOf } = await import(process.cwd() + '/origins/world/props-rules.ts');
const F = frontierPlan(), B = frontierBuild(F), BASE = withCinder(F, B, frontierDress(F, B)), K = propKit(F, B, BASE, goblinZone(), 'goblin-camp');
console.log(JSON.stringify({ centre: K.centre, fires: K.fires, rows: recipesOf('goblin-camp').filter((r) => /torch/.test(r.id)).map((r) => ({ id: r.id, kind: r.kind, ring: r.ringRadius, angle: r.angle, count: r.count })) }, null, 1));
