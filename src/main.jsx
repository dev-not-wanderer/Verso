/**
 * src/main.jsx  —  Verso entry point  (Capacitor-ready)
 *
 * Changes from original:
 *  1. Storage adapter uses @capacitor/preferences on native, localStorage on web
 *  2. Runtime permissions for Android 13+ (POST_NOTIFICATIONS, camera/photos)
 *  3. Permission requests finish BEFORE React mounts (no race conditions)
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./Verso.jsx";

// ─── Platform detection ───────────────────────────────────────────────────────
const isNative = () =>
  typeof window !== "undefined" &&
  window.Capacitor?.isNativePlatform?.() === true;

const isAndroid = () => isNative() && window.Capacitor.getPlatform() === "android";

// ─── Storage adapter ──────────────────────────────────────────────────────────
//
//  On native: uses @capacitor/preferences (survives app clears better than localStorage)
//  On web:    falls back to localStorage
//
//  Shape Verso.jsx expects:
//    await window.storage.get(key)        → { key, value } | null
//    await window.storage.set(key, value) → { key, value } | null
//    await window.storage.delete(key)     → { key, deleted } | null
//    await window.storage.list(prefix?)   → { keys, prefix? } | null

function makeLocalStorageAdapter() {
  return {
    async get(key) {
      try {
        const value = localStorage.getItem(key);
        return value !== null ? { key, value } : null;
      } catch { return null; }
    },
    async set(key, value) {
      try {
        localStorage.setItem(key, String(value));
        return { key, value };
      } catch { return null; }
    },
    async delete(key) {
      try {
        localStorage.removeItem(key);
        return { key, deleted: true };
      } catch { return null; }
    },
    async list(prefix = "") {
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
        return { keys, prefix };
      } catch { return null; }
    },
  };
}

async function makePreferencesAdapter() {
  // Dynamically import so the web bundle doesn't hard-crash if the plugin
  // isn't available (e.g. running in a plain browser during dev)
  try {
    const { Preferences } = await import("@capacitor/preferences");

    return {
      async get(key) {
        try {
          const { value } = await Preferences.get({ key });
          return value !== null ? { key, value } : null;
        } catch { return null; }
      },
      async set(key, value) {
        try {
          await Preferences.set({ key, value: String(value) });
          return { key, value };
        } catch { return null; }
      },
      async delete(key) {
        try {
          await Preferences.remove({ key });
          return { key, deleted: true };
        } catch { return null; }
      },
      async list(prefix = "") {
        try {
          const { keys } = await Preferences.keys();
          const filtered = keys.filter(k => k.startsWith(prefix));
          return { keys: filtered, prefix };
        } catch { return null; }
      },
    };
  } catch {
    // Plugin not available — fall back to localStorage
    return makeLocalStorageAdapter();
  }
}

// ─── Runtime permissions (Android 13+ only) ───────────────────────────────────
async function requestAndroidPermissions() {
  if (!isAndroid()) return;

  const Plugins = window.Capacitor?.Plugins ?? {};

  // POST_NOTIFICATIONS (API 33+) via LocalNotifications
  try {
    const { LocalNotifications } = Plugins;
    if (LocalNotifications) {
      const { display } = await LocalNotifications.checkPermissions();
      if (display !== "granted") {
        await LocalNotifications.requestPermissions();
      }
    }
  } catch (e) {
    console.warn("[Verso] LocalNotifications permission:", e);
  }

  // CAMERA + READ_MEDIA_IMAGES (API 33+) via Camera plugin
  try {
    const { Camera } = Plugins;
    if (Camera) {
      const perms = await Camera.checkPermissions();
      const needsCamera  = perms.camera  !== "granted";
      const needsPhotos  = perms.photos  !== "granted";
      if (needsCamera || needsPhotos) {
        const request = [];
        if (needsCamera) request.push("camera");
        if (needsPhotos) request.push("photos");
        await Camera.requestPermissions({ permissions: request });
      }
    }
  } catch (e) {
    console.warn("[Verso] Camera permission:", e);
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  // 1. Wire up the storage adapter before Verso.jsx loads
  window.storage = isNative()
    ? await makePreferencesAdapter()
    : makeLocalStorageAdapter();

  // 2. Ask for runtime permissions on Android (non-blocking if denied)
  await requestAndroidPermissions();

  // 3. Mount React
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
