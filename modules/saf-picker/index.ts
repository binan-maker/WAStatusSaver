/**
 * SafPicker — SAF folder picker using expo-file-system's
 * StorageAccessFramework.requestDirectoryPermissionsAsync.
 *
 * PLUGIN-FREE implementation — no custom Java module, no app.json plugin,
 * no crashes from OEM-specific document picker quirks.
 *
 * How auto-navigation works:
 *   We pass DOCUMENT_URI_ANDROID_MEDIA as the initialUri to
 *   requestDirectoryPermissionsAsync. expo-file-system forwards it as
 *   android.provider.extra.INITIAL_URI on the ACTION_OPEN_DOCUMENT_TREE
 *   intent. Android uses this hint to pre-scroll the system picker to
 *   Internal Storage → Android → media so the user taps "Use this folder"
 *   without any manual navigation.
 *
 * Why /document/ format for the URI (not /tree/):
 *   EXTRA_INITIAL_URI must be a document URI. Using the /tree/ form causes
 *   many OEM pickers (MIUI, Samsung OneUI < 5) to silently ignore the hint.
 *
 * Why not react-native-saf-x for the picker:
 *   react-native-saf-x's openDocumentTree does not accept an initialUri
 *   parameter, so it cannot pre-navigate to Android/media. expo-file-system
 *   does support this, is already a first-party dependency, and takes
 *   persistent permission automatically before the promise resolves.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// ── URI constants ─────────────────────────────────────────────────────────────
//
// Decoded:  content://com.android.externalstorage.documents/document/primary:Android/media
// The picker opens HERE automatically — user just taps "Use this folder".
export const DOCUMENT_URI_ANDROID_MEDIA =
  'content://com.android.externalstorage.documents/document/primary%3AAndroid%2Fmedia';

// Deep fallbacks — used only when the user taps "Browse manually"
export const DOCUMENT_URI_WHATSAPP =
  'content://com.android.externalstorage.documents/document/primary%3AAndroid%2Fmedia%2Fcom.whatsapp%2FWhatsApp%2FMedia';

export const DOCUMENT_URI_WHATSAPP_BUSINESS =
  'content://com.android.externalstorage.documents/document/primary%3AAndroid%2Fmedia%2Fcom.whatsapp.w4b%2FWhatsApp%20Business%2FMedia';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Always true on Android — expo-file-system SAF is available in every build
 * (Expo Go, custom dev-client, EAS). No native-module gate needed.
 */
export function isAvailable(): boolean {
  return Platform.OS === 'android';
}

/**
 * Open the system SAF document-tree picker pre-navigated to `initialUri`.
 *
 * Pass DOCUMENT_URI_ANDROID_MEDIA to land the picker at Android/media so
 * the user sees their WhatsApp folder immediately without scrolling.
 *
 * expo-file-system calls takePersistableUriPermission automatically before
 * the promise resolves, so the grant survives app kills and device reboots.
 *
 * @param initialUri  /document/ format URI (use DOCUMENT_URI_* constants).
 * @returns           { granted, directoryUri } — directoryUri is the tree URI.
 */
export async function openDocumentTree(
  initialUri: string,
): Promise<{ granted: boolean; directoryUri: string }> {
  if (Platform.OS !== 'android') return { granted: false, directoryUri: '' };
  try {
    const result = (await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
      initialUri,
    )) as { granted: boolean; directoryUri: string };
    return result;
  } catch {
    return { granted: false, directoryUri: '' };
  }
}
