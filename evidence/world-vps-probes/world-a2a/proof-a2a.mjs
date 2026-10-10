import { chromium } from "playwright"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process";
const root = process.cwd(), zonePath = "origins/zones/zone2/zone.ts", orig = fs.readFileSync(zonePath, "utf8");
const variants = { tintonly: 1, ...{ base: "", fog: "look: { fog: { colour: \"#7a1f1f\", density: 0.06 } }", exposure: "look: { exposure: 2.4 }", tint: "look: { ground: { tint: [0.3, 0.9, 0.3] } }", sun: "look: { sun: { colour: \"#3060ff\", intensity: 9 } }", night: "look: { timeOfDay: { follow: false, hour: 0 } }", density: "look: { props: { density: 3 } }" } };
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ogg": "audio/ogg" };
const out = {};
for (const [name, extra] of Object.entries(variants).filter(([k]) => k === "tint")) {
  fs.writeFileSync(zonePath, orig.replace("world: ['ash-reach'] }", "world: ['ash-reach']" + (extra ? ", " + extra : "") + " } as never"));
  execSync("rm -rf artifacts/origins-preview && npx vite build --config origins/preview/vite.config.mjs", { stdio: "ignore" });
  const built = path.join(root, "artifacts/origins-preview"), roots = { "/preview/origins/": built + "/" };
  for (const d of ["game", "weapons", "arena", "pit", "looks", "legends", "shields", "herolook", "gear-ui", "world", "beasts"]) roots["/" + d + "/"] = root + "/public/" + d + "/";
  const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split("?")[0]); let hit = null; for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || "index.html"); if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, "index.html"); if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": mime[path.extname(hit)] ?? "application/octet-stream" }); fs.createReadStream(hit).pipe(res); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }); const p = await (await b.newContext({ viewport: { width: 375, height: 812 } })).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  await p.goto("http://127.0.0.1:" + srv.address().port + "/preview/origins/?region=1&zone=2&daynight=" + (name === "night" ? "1" : "0"), { waitUntil: "load" });
  await p.waitForFunction(() => window.__zoneReady, null, { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(3000);
  fs.mkdirSync("/tmp/proof3", { recursive: true }); await p.screenshot({ path: "/tmp/proof3/" + name + ".png" });
  out[name] = { errors: errs.length }; await b.close(); srv.close();
}
fs.writeFileSync(zonePath, orig); console.log(JSON.stringify(out));
