import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "statusvault_payment_device_id";

function createDeviceId() {
  const raw = [
    "sv",
    Platform.OS,
    Device.osBuildId || "build",
    Device.modelName || "device",
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 12),
  ].join("_");

  return raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

export async function getPaymentDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const created = createDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}