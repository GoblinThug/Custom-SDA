#!/usr/bin/env node
/**
 * Single source of truth: package.json → version
 * Syncs into src-tauri/tauri.conf.json, Cargo.toml, and Cargo.lock (package custom-sda).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(root, "package.json");
const version = JSON.parse(readFileSync(pkgPath, "utf8")).version;

if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`Invalid version in package.json: ${version}`);
  process.exit(1);
}

const tauriConfPath = join(root, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
if (tauriConf.version !== version) {
  tauriConf.version = version;
  writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`);
  console.log(`tauri.conf.json → ${version}`);
} else {
  console.log(`tauri.conf.json already ${version}`);
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

console.log(`Synced version ${version} from package.json`);
