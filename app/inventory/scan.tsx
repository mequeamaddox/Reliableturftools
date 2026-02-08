import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
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
  const [manualMode, setManualMode] = useState(Platform.OS === "web");
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
      const url = new URL(`/api/listings/barcode/${code.trim()}`, baseUrl);
      const res = await fetch(url.toString(), { credentials: "include" });
      if (res.ok) {
        const listing = await res.json();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
        setTimeout(() => {
          router.push({ pathname: "/inventory/[id]", params: { id: listing.id } });
        }, 100);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          "Not Found",
          `No listing found for barcode "${code.trim()}". Create a new listing with this barcode?`,
          [
            { text: "Cancel", style: "cancel", onPress: () => setScanned(false) },
            {
              text: "Create New",
              onPress: () => {
                router.back();
                setTimeout(() => {
                  router.push("/inventory/new" as any);
                }, 100);
              },
            },
          ],
        );
      }
    } catch {
      Alert.alert("Error", "Failed to search for barcode");
      setScanned(false);
    } finally {
      setSearching(false);
    }
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    if (scanned || searching) return;
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBarcode(data);
    lookupBarcode(data);
  }

  if (manualMode) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Barcode Lookup</Text>
          {Platform.OS !== "web" && (
            <Pressable onPress={() => { setManualMode(false); setScanned(false); }}>
              <Ionicons name="camera" size={26} color={Colors.primary} />
            </Pressable>
          )}
          {Platform.OS === "web" && <View style={{ width: 28 }} />}
        </View>

        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="barcode" size={64} color={Colors.primary} />
          </View>

          <Text style={styles.instruction}>
            Enter the barcode number to look up an existing listing or create a new one.
          </Text>

          <View style={styles.inputWrap}>
            <Ionicons name="search" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={barcode}
              onChangeText={setBarcode}
              placeholder="Type barcode number..."
              placeholderTextColor={Colors.textMuted}
              keyboardType="default"
              autoFocus
              onSubmitEditing={() => lookupBarcode(barcode)}
              returnKeyType="search"
            />
          </View>

          <Pressable
            style={[styles.lookupBtn, searching && { opacity: 0.6 }]}
            onPress={() => lookupBarcode(barcode)}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="search" size={22} color="#fff" />
                <Text style={styles.lookupBtnText}>Look Up Barcode</Text>
              </>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={styles.createBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.back();
              setTimeout(() => router.push("/inventory/new" as any), 100);
            }}
          >
            <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
            <Text style={styles.createBtnText}>Create New Listing</Text>
          </Pressable>
        </View>
      </View>
    );
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
          <Pressable onPress={() => router.back()}>
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
          <Pressable style={styles.manualBtn} onPress={() => setManualMode(true)}>
            <Ionicons name="keypad-outline" size={18} color={Colors.primary} />
            <Text style={styles.manualBtnText}>Enter Manually</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={[styles.header, styles.cameraHeader]}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: "#fff" }]}>Scan Barcode</Text>
        <Pressable onPress={() => setManualMode(true)}>
          <Ionicons name="keypad" size={24} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
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
        <View style={styles.scanOverlay}>
          <View style={styles.scanFrame}>
            <View style={[styles.scanCorner, styles.topLeft]} />
            <View style={[styles.scanCorner, styles.topRight]} />
            <View style={[styles.scanCorner, styles.bottomLeft]} />
            <View style={[styles.scanCorner, styles.bottomRight]} />
          </View>
          <Text style={styles.scanHint}>
            {searching ? "Looking up barcode..." : "Point camera at a barcode"}
          </Text>
        </View>
      </View>

      {searching && (
        <View style={styles.searchingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.searchingText}>Searching...</Text>
        </View>
      )}

      {scanned && !searching && (
        <Pressable style={styles.rescanBtn} onPress={() => setScanned(false)}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.rescanBtnText}>Scan Again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },
  cameraHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: "center",
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(22, 163, 74, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  instruction: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 300,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    gap: 10,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 18,
    color: Colors.text,
    paddingVertical: 16,
  },
  lookupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 18,
    width: "100%",
    marginTop: 16,
  },
  lookupBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    width: "100%",
    marginVertical: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textMuted,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(22, 163, 74, 0.1)",
    borderRadius: 14,
    padding: 18,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  createBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.primary,
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
  manualBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingVertical: 12,
  },
  manualBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.primary,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 260,
    height: 160,
    position: "relative",
  },
  scanCorner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: Colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanHint: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
    marginTop: 24,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  searchingOverlay: {
    position: "absolute",
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 8,
  },
  searchingText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  rescanBtn: {
    position: "absolute",
    bottom: 60,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  rescanBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#fff",
  },
});
