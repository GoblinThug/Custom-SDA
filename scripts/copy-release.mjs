import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const profile = process.argv[2] === "debug" ? "debug" : "release";
const outDir = join(root, "release");

const candidates = [
  join(root, "target", profile, "custom-sda.exe"),
  join(root, "src-tauri", "target", profile, "custom-sda.exe"),
  join(
    process.env.LOCALAPPDATA || "",
    "custom-sda-cargo-target",
    profile,
    "custom-sda.exe",
  ),
];

function pickNewest(paths) {
  let best = null;
  let bestMtime = 0;
  for (const p of paths) {
    if (!p || !existsSync(p)) continue;
    const mtime = statSync(p).mtimeMs;
    if (mtime > bestMtime) {
      bestMtime = mtime;
      best = p;
    }
  }
  return best;
}

const exe = pickNewest(candidates);
if (!exe) {
  console.error(`Не найден custom-sda.exe для профиля "${profile}". Искал:`);
  for (const p of candidates) console.error(" -", p);
  process.exit(1);
}

console.log(`Сборка: ${exe} (${statSync(exe).mtime.toISOString()})`);

mkdirSync(outDir, { recursive: true });
const destExe = join(outDir, "custom-sda.exe");
copyFileSync(exe, destExe);
console.log(`OK: ${destExe}`);

const bundleRoots = [
  join(dirname(exe), "bundle"),
  join(root, "target", profile, "bundle"),
  join(root, "src-tauri", "target", profile, "bundle"),
];

const seen = new Set();
for (const bundle of bundleRoots) {
  if (!existsSync(bundle)) continue;
  for (const kind of ["nsis", "msi"]) {
    const dir = join(bundle, kind);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const src = join(dir, name);
      if (seen.has(name)) continue;
      seen.add(name);
      const dest = join(outDir, name);
      copyFileSync(src, dest);
      console.log(`OK: ${dest}`);
    }
  }
}
