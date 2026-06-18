/**
 * SafPicker — JS bridge for the native SafPickerModule.
 *
 * Fires ACTION_OPEN_DOCUMENT_TREE with:
 *   • intent.setPackage("com.android.documentsui") — forces Android's built-in
 *     document picker, bypassing Samsung MyFiles / MIUI / Realme file managers
 *     that intercept the intent and ignore EXTRA_INITIAL_URI.
 *   • EXTRA_INITIAL_URI in /document/ format — opens at exactly the folder
 *     specified on 100% of devices that have DocumentsUI.
 *
 * Falls back to the default file manager if DocumentsUI is not present
 * (only extremely rare custom AOSP forks remove it).
 *
 * isAvailable() returns false in Expo Go, iOS, and web.
 */
import { NativeModules, Platform } from 'react-native';

// ── URI constants ─────────────────────────────────────────────────────────────
//
// IMPORTANT: EXTRA_INITIAL_URI requires the /document/ form, not /tree/.
// Using /tree/ causes many OEM pickers to ignore or misparse the hint.
//
// Decoded:  content://com.android.externalstorage.documents/document/primary:Android/media
export const DOCUMENT_URI_ANDROID_MEDIA =
  'content://com.android.externalstorage.documents/document/primary%3AAndroid%2Fmedia';

// Deep fallbacks — used by "Browse manually" path only
export const DOCUMENT_URI_WHATSAPP =
  'content://com.android.externalstorage.documents/document/primary%3AAndroid%2Fmedia%2Fcom.whatsapp%2FWhatsApp%2FMedia';

export const DOCUMENT_URI_WHATSAPP_BUSINESS =
  'content://com.android.externalstorage.documents/document/primary%3AAndroid%2Fmedia%2Fcom.whatsapp.w4b%2FWhatsApp%20Business%2FMedia';

// ── Native module binding ─────────────────────────────────────────────────────

interface SafPickerNative {
  openDocumentTree(initialUri: string): Promise<{ granted: boolean; directoryUri: string }>;
  checkAvailable(): Promise<boolean>;
}

const SafPickerNative: SafPickerNative | null =
  Platform.OS === 'android' ? (NativeModules.SafPickerModule ?? null) : null;

// ── Public API ────────────────────────────────────────────────────────────────

/** True only when the native Java module is compiled in (custom dev-client / EAS). */
export function isAvailable(): boolean {
  return SafPickerNative !== null;
}

/**
 * Open the system document-tree picker at `initialUri`.
 *
 * Uses DocumentsUI (com.android.documentsui) directly so the folder hint
 * is always respected — regardless of OEM device brand.
 *
 * @param initialUri  A /document/ format URI (use the DOCUMENT_URI_* constants).
 * @returns           {granted, directoryUri} — directoryUri is the granted tree URI.
 */
export async function openDocumentTree(
  initialUri: string,
): Promise<{ granted: boolean; directoryUri: string }> {
  if (!SafPickerNative) {
    return { granted: false, directoryUri: '' };
  }
  return SafPickerNative.openDocumentTree(initialUri);
}
