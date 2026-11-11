#!/usr/bin/env node
/**
 * Single source of truth: package.json → version
 * Syncs into src-tauri/tauri.conf.json, Cargo.toml, Cargo.lock, and version lines in *.md.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(root, "package.json");
const version = JSON.parse(readFileSync(pkgPath, "utf8")).version;

if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`Invalid version in package.json: ${version}`);
  process.exit(1);
}

/** Tauri / Play-style: major*1_000_000 + minor*1_000 + patch */
function semverToVersionCode(v) {
  const [maj = 0, min = 0, pat = 0] = v.split(".").map((p) => Number.parseInt(p, 10) || 0);
  return maj * 1_000_000 + min * 1_000 + pat;
}

const versionCode = semverToVersionCode(version);

const tauriConfPath = join(root, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
let tauriConfChanged = false;
if (tauriConf.version !== version) {
  tauriConf.version = version;
  tauriConfChanged = true;
}
if (!tauriConf.bundle) {
  tauriConf.bundle = { active: true };
}
if (!tauriConf.bundle.android) {
  tauriConf.bundle.android = { minSdkVersion: 24 };
}
if (tauriConf.bundle.android.versionCode !== versionCode) {
  tauriConf.bundle.android.versionCode = versionCode;
  tauriConfChanged = true;
}
if (tauriConfChanged) {
  writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`);
  console.log(`tauri.conf.json → ${version} (versionCode ${versionCode})`);
} else {
  console.log(`tauri.conf.json already ${version} (versionCode ${versionCode})`);
}

const androidPropsPath = join(
  root,
  "src-tauri",
  "gen",
  "android",
  "app",
  "tauri.properties",
);
if (existsSync(androidPropsPath)) {
  let props = readFileSync(androidPropsPath, "utf8");
  const nextProps = props
    .replace(/^tauri\.android\.versionName=.*$/m, `tauri.android.versionName=${version}`)
    .replace(/^tauri\.android\.versionCode=.*$/m, `tauri.android.versionCode=${versionCode}`);
  if (nextProps !== props) {
    writeFileSync(androidPropsPath, nextProps);
    console.log(`tauri.properties → ${version} (${versionCode})`);
  }
}

const cargoTomlPath = join(root, "src-tauri", "Cargo.toml");
let cargoToml = readFileSync(cargoTomlPath, "utf8");
const cargoTomlNext = cargoToml.replace(
  /^version\s*=\s*"[^"]+"/m,
  `version = "${version}"`,
);
if (cargoTomlNext !== cargoToml) {
  writeFileSync(cargoTomlPath, cargoTomlNext);
  console.log(`Cargo.toml → ${version}`);
} else {
  console.log(`Cargo.toml already ${version}`);
}

const cargoLockPath = join(root, "src-tauri", "Cargo.lock");
let cargoLock = readFileSync(cargoLockPath, "utf8");
const cargoLockNext = cargoLock.replace(
  /(\[\[package\]\]\nname = "custom-sda"\n)version = "[^"]+"/,
  `$1version = "${version}"`,
);
if (cargoLockNext !== cargoLock) {
  writeFileSync(cargoLockPath, cargoLockNext);
  console.log(`Cargo.lock (custom-sda) → ${version}`);
} else {
  console.log(`Cargo.lock already ${version}`);
}

const androidAssetConf = join(
  root,
  "src-tauri",
  "gen",
  "android",
  "app",
  "src",
  "main",
  "assets",
  "tauri.conf.json",
);
try {
  const androidConf = JSON.parse(readFileSync(androidAssetConf, "utf8"));
  if (androidConf.version !== version) {
    androidConf.version = version;
    writeFileSync(androidAssetConf, `${JSON.stringify(androidConf, null, 2)}\n`);
    console.log(`android assets tauri.conf.json → ${version}`);
  }
} catch {
  // gen/android may be missing until first init
}

const versionTag = `v${version}`;

/** Idempotent markdown updates (re-run safe after every version bump). */
const markdownSync = [
  {
    rel: "README.md",
    apply: (text) =>
      text.replace(
        /\*\*Версия:\*\* `[^`]+`/,
        `**Версия:** \`${version}\``,
      ),
  },
  {
    rel: "docs/README.md",
    apply: (text) =>
      text.replace(
        /\*\*Текущая версия:\*\* `[^`]+`/,
        `**Текущая версия:** \`${version}\``,
      ),
  },
  {
    rel: ".github/CI-PIPELINE.md",
    apply: (text) =>
      text
        .replace(
          /Сейчас \*\*`[^`]+`\*\* → GitHub Release \*\*`v[^`]+`\*\*/,
          `Сейчас **\`${version}\`** → GitHub Release **\`${versionTag}\`**`,
        )
        .replace(
          /git commit -m "Custom SDA [^"]+"/,
          `git commit -m "Custom SDA ${version}"`,
        ),
  },
  {
    rel: "docs/UPDATER.md",
    apply: (text) =>
      text.replace(
        /Tag format: `v[^`]+` matching `package\.json`/,
        `Tag format: \`${versionTag}\` matching \`package.json\``,
      ),
  },
];

function syncMarkdownDocs() {
  for (const { rel, apply } of markdownSync) {
    const filePath = join(root, rel);
    if (!existsSync(filePath)) {
      continue;
    }
    const before = readFileSync(filePath, "utf8");
    const after = apply(before);
    if (after !== before) {
      writeFileSync(filePath, after);
      console.log(`${rel} → ${version}`);
    }
  }
}

syncMarkdownDocs();

console.log(`Synced version ${version} from package.json`);
