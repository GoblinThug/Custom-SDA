import pkg from "../package.json";

/** Single source: package.json (sync with tauri.conf.json on release). */
export const APP_VERSION = pkg.version;
