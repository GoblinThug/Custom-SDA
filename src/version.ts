import pkg from "../package.json";

/** Single source: package.json (`npm run sync:version` updates Tauri/Cargo). */
export const APP_VERSION = pkg.version;
