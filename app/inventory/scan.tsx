import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";
import { CameraView, useCameraPermissions } from "expo-camera";

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [barcode, setBarcode] = useState("");
  const [searching, setSearching] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  async function lookupBarcode(code: string) {
    if (!code.trim()) {
      Alert.alert("Enter Barcode", "Please type or scan a barcode number");
      return;
    }
    setSearching(true);
    try {
      const baseUrl = getApiUrl();
      const url = new URL(`/api/listings/barcode/${encodeURIComponent(code.trim())}`, baseUrl);
      const res = await fetch(url.toString(), { credentials: "include" });
      if (res.ok) {
        const listing = await res.json();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({ pathname: "/inventory/[id]", params: { id: listing.id } });
      } else {
        setSearching(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        promptCreateNew(code.trim());
      }
    } catch {
      setSearching(false);
      setScanned(false);
      Alert.alert("Error", "Failed to search for barcode. Please try again.");
    }
  }

  function promptCreateNew(code: string) {
    Alert.alert(
      "Not Found",
      `No item found for barcode "${code}". Create a new listing with this barcode?`,
      [
        { text: "Cancel", style: "cancel", onPress: () => setScanned(false) },
        {
          text: "Create New",
          onPress: () => {
            router.replace({ pathname: "/inventory/new" as any, params: { barcode: code } });
          },
        },
      ],
    );
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    if (scanned || searching) return;
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBarcode(data);
    lookupBarcode(data);
  }

  if (!permission) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={28} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Barcode Scanner</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.permissionContent}>
          <Ionicons name="camera-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionDesc}>
            Allow camera access to scan barcodes on your equipment.
          </Text>
          <Pressable style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Allow Camera</Text>
          </Pressable>

          <View style={styles.permDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR ENTER MANUALLY</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.manualRow}>
            <View style={styles.manualInputWrap}>
              <TextInput
                style={styles.manualInput}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Barcode number..."
                placeholderTextColor={Colors.textMuted}
                onSubmitEditing={() => lookupBarcode(barcode)}
                returnKeyType="search"
              />
            </View>
            <Pressable
              style={[styles.manualSearchBtn, searching && { opacity: 0.6 }]}
              onPress={() => lookupBarcode(barcode)}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="search" size={22} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            "ean13",
            "ean8",
            "upc_a",
            "upc_e",
            "code128",
            "code39",
            "code93",
            "itf14",
            "codabar",
            "qr",
            "datamatrix",
          ],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      <View style={[styles.cameraHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.cameraTitle}>Scan Barcode</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.scanOverlay}>
        <View style={styles.scanFrame}>
          <View style={[styles.scanCorner, styles.topLeft]} />
          <View style={[styles.scanCorner, styles.topRight]} />
          <View style={[styles.scanCorner, styles.bottomLeft]} />
          <View style={[styles.scanCorner, styles.bottomRight]} />
        </View>
        {searching ? (
          <View style={styles.scanHintRow}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.scanHint}>Looking up barcode...</Text>
          </View>
        ) : (
          <Text style={styles.scanHint}>
            Point camera at a barcode
          </Text>
        )}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {scanned && !searching ? (
          <Pressable style={styles.rescanBtn} onPress={() => setScanned(false)}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.rescanBtnText}>Scan Again</Text>
          </Pressable>
        ) : null}

        <View style={styles.manualSection}>
          <Text style={styles.manualLabel}>Or enter barcode manually:</Text>
          <View style={styles.manualRow}>
            <View style={styles.manualInputWrapDark}>
              <TextInput
                style={styles.manualInputDark}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Type barcode..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                onSubmitEditing={() => lookupBarcode(barcode)}
                returnKeyType="search"
              />
            </View>
            <Pressable
              style={[styles.manualSearchBtnGreen, searching && { opacity: 0.6 }]}
              onPress={() => lookupBarcode(barcode)}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="search" size={22} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
  },
  permissionContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  permissionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
    marginTop: 8,
  },
  permissionDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  permissionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 12,
  },
  permissionBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  permDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    marginTop: 24,
    marginBottom: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
  },
  manualRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  manualInputWrap: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    justifyContent: "center",
  },
  manualInput: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.text,
    paddingVertical: 14,
  },
  manualSearchBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 10,
  },
  cameraTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#fff",
  },
  scanOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 120,
  },
  scanFrame: {
    width: 280,
    height: 170,
    position: "relative",
  },
  scanCorner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: Colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  scanHint: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
    marginTop: 20,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  scanHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  rescanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  rescanBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#fff",
  },
  manualSection: {
    gap: 8,
  },
  manualLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
  manualInputWrapDark: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  manualInputDark: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#fff",
    paddingVertical: 12,
  },
  manualSearchBtnGreen: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
