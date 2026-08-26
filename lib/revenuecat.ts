import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

export const REVENUECAT_ENTITLEMENT_IDENTIFIER =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() || "";
export const REVENUECAT_LIFETIME_PRODUCT_IDENTIFIER =
  process.env.EXPO_PUBLIC_REVENUECAT_LIFETIME_PRODUCT_ID?.trim() || "";

let configured = false;

export type RevenueCatSnapshot = {
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
};

export type PurchaseResult =
  | { success: true; customerInfo: CustomerInfo }
  | {
      success: false;
      kind: "unavailable" | "cancelled" | "failed";
      message: string;
    };

export function isRevenueCatSupported(): boolean {
  return Platform.OS !== "web";
}

export function getRevenueCatConfigurationError(): string | null {
  if (!isRevenueCatSupported()) return null;
  if (!REVENUECAT_ENTITLEMENT_IDENTIFIER) {
    return "RevenueCat entitlement is not configured. Add EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID.";
  }
  if (!REVENUECAT_LIFETIME_PRODUCT_IDENTIFIER) {
    return "RevenueCat Premium product is not configured. Add EXPO_PUBLIC_REVENUECAT_LIFETIME_PRODUCT_ID.";
  }
  if (Platform.OS === "android" && !process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY) {
    return "Google Play purchases are not configured yet. Add the RevenueCat Android public API key.";
  }
  if (Platform.OS === "ios" && !process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY) {
    return "App Store purchases are not configured yet. Add the RevenueCat iOS public API key.";
  }
  return null;
}

export async function initializeRevenueCat(): Promise<boolean> {
  if (!isRevenueCatSupported()) return false;
  if (configured) return true;

  const configurationError = getRevenueCatConfigurationError();
  if (configurationError) throw new Error(configurationError);

  const apiKey =
    Platform.OS === "android"
      ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;

  if (!apiKey) throw new Error("RevenueCat public API key is missing.");

  await Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.INFO);
  Purchases.configure({ apiKey });
  configured = true;
  return true;
}

export function hasPremiumEntitlement(customerInfo: CustomerInfo | null): boolean {
  return Boolean(
    customerInfo?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER],
  );
}

export function getOfferingPackage(
  offering: PurchasesOffering | null,
): PurchasesPackage | null {
  if (!offering) return null;
  return (
    offering.availablePackages.find(
      (item) =>
        item.identifier === "$rc_lifetime" ||
        item.product.identifier === REVENUECAT_LIFETIME_PRODUCT_IDENTIFIER,
    ) || null
  );
}

export async function loadRevenueCatSnapshot(): Promise<RevenueCatSnapshot> {
  await initializeRevenueCat();
  if (!isRevenueCatSupported()) {
    return { customerInfo: null, offering: null };
  }
  const [customerInfo, offerings] = await Promise.all([
    Purchases.getCustomerInfo(),
    Purchases.getOfferings(),
  ]);
  return {
    customerInfo,
    offering: offerings.current,
  };
}

export async function purchasePremium(): Promise<PurchaseResult> {
  try {
    await initializeRevenueCat();
    if (!isRevenueCatSupported()) {
      return {
        success: false,
        kind: "unavailable",
        message: "Premium purchases are available in the Android/iOS app.",
      };
    }

    const offerings = await Purchases.getOfferings();
    const packageToPurchase = getOfferingPackage(offerings.current);
    if (!packageToPurchase) {
      return {
        success: false,
        kind: "unavailable",
        message:
          "Premium is not available from the current RevenueCat offering. Confirm the configured product is attached to the active offering.",
      };
    }

    const result = await Purchases.purchasePackage(packageToPurchase);
    return { success: true, customerInfo: result.customerInfo };
  } catch (error) {
    return normalizePurchaseError(error);
  }
}

export async function restorePremium(): Promise<PurchaseResult> {
  try {
    await initializeRevenueCat();
    if (!isRevenueCatSupported()) {
      return {
        success: false,
        kind: "unavailable",
        message: "Restore purchases is available in the Android/iOS app.",
      };
    }
    const customerInfo = await Purchases.restorePurchases();
    return { success: true, customerInfo };
  } catch (error) {
    return normalizePurchaseError(error, "Your purchase could not be restored. Check your Google Play account and try again.");
  }
}

export function subscribeToCustomerInfo(
  listener: (customerInfo: CustomerInfo) => void,
): () => void {
  if (!isRevenueCatSupported()) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}

function normalizePurchaseError(
  error: unknown,
  fallback = "The purchase could not be completed. Check Google Play and try again.",
): PurchaseResult {
  if (error && typeof error === "object") {
    const purchaseError = error as {
      userCancelled?: boolean;
      message?: unknown;
    };
    if (purchaseError.userCancelled) {
      return {
        success: false,
        kind: "cancelled",
        message: "Purchase cancelled. No payment was taken.",
      };
    }
    if (typeof purchaseError.message === "string" && purchaseError.message) {
      return { success: false, kind: "failed", message: purchaseError.message };
    }
  }
  return { success: false, kind: "failed", message: fallback };
}