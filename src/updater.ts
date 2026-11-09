import { arch, type } from "@tauri-apps/plugin-os";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isMobileHost } from "./platform";

import { APP_VERSION } from "./version";

const GITHUB_REPO = "GoblinThug/Custom-SDA";

export type UpdateCheckResult =
  | { status: "unsupported" }
  | { status: "upToDate" }
  | {
      status: "available";
      version: string;
      notes: string | null;
      downloadUrl: string;
      releaseUrl: string;
    }
  | { status: "error"; message: string };

export type UpdateInstallResult =
  | { status: "ok" }
  | { status: "error"; message: string };

type GhAsset = { name: string; browser_download_url: string };
type GhRelease = {
  tag_name: string;
  html_url: string;
  body?: string | null;
  assets: GhAsset[];
};

function parseVer(v: string): number[] {
  return v
    .replace(/^v/i, "")
    .split(".")
    .map((p) => Number.parseInt(p.replace(/[^0-9].*$/, ""), 10) || 0);
}

/** positive if a > b */
function cmpSemver(a: string, b: string): number {
  const aa = parseVer(a);
  const bb = parseVer(b);
  const n = Math.max(aa.length, bb.length);
  for (let i = 0; i < n; i++) {
    const d = (aa[i] ?? 0) - (bb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function pickAsset(assets: GhAsset[], os: string, cpu: string): GhAsset | null {
  const names = assets.map((a) => ({ a, n: a.name.toLowerCase() }));
  const prefer = (pred: (n: string) => boolean) => names.find((x) => pred(x.n))?.a ?? null;

  if (os === "windows") {
    return (
      prefer((n) => n.endsWith(".exe") && (n.includes("setup") || n.includes("nsis"))) ||
      prefer((n) => n.endsWith(".msi")) ||
      prefer((n) => n.endsWith(".exe"))
    );
  }
  if (os === "linux") {
    if (cpu.includes("arm") || cpu.includes("aarch")) {
      return (
        prefer((n) => n.endsWith(".appimage") && (n.includes("aarch64") || n.includes("arm64"))) ||
        prefer((n) => n.endsWith(".deb") && (n.includes("arm64") || n.includes("aarch64")))
      );
    }
    return (
      prefer((n) => n.endsWith(".appimage") && !n.includes("arm") && !n.includes("aarch")) ||
      prefer((n) => n.endsWith(".appimage")) ||
      prefer((n) => n.endsWith(".deb"))
    );
  }
  if (os === "macos" || os === "darwin") {
    return (
      prefer((n) => n.endsWith(".dmg")) ||
      prefer((n) => n.endsWith(".app.zip") || n.includes("macos-app.zip"))
    );
  }
  return null;
}

/**
 * Public GitHub Releases — no signing keys / secrets.
 * Compares tag of latest release with the built-in app version.
 */
export async function checkAppUpdate(): Promise<UpdateCheckResult> {
  if (isMobileHost()) {
    return { status: "unsupported" };
  }
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (res.status === 404) {
      return { status: "upToDate" };
    }
    if (!res.ok) {
      return { status: "error", message: `GitHub API ${res.status}` };
    }
    const release = (await res.json()) as GhRelease;
    const remote = release.tag_name.replace(/^v/i, "");
    if (cmpSemver(remote, APP_VERSION) <= 0) {
      return { status: "upToDate" };
    }

    let os = "windows";
    let cpu = "x86_64";
    try {
      os = type();
      cpu = arch();
    } catch {
      /* browser fallback */
    }

    const asset = pickAsset(release.assets ?? [], os, cpu);
    return {
      status: "available",
      version: remote,
      notes: release.body ?? null,
      downloadUrl: asset?.browser_download_url ?? release.html_url,
      releaseUrl: release.html_url,
    };
  } catch (e) {
    return { status: "error", message: String(e) };
  }
}

/** Open the installer / release page in the system browser (no private key). */
export async function installAppUpdate(downloadUrl?: string): Promise<UpdateInstallResult> {
  if (isMobileHost()) {
    return { status: "error", message: "unsupported" };
  }
  try {
    let url = downloadUrl;
    if (!url) {
      const checked = await checkAppUpdate();
      if (checked.status !== "available") {
        return { status: "error", message: "no update" };
      }
      url = checked.downloadUrl;
    }
    await openUrl(url);
    return { status: "ok" };
  } catch (e) {
    return { status: "error", message: String(e) };
  }
}
