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
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [barcode, setBarcode] = useState("");
  const [searching, setSearching] = useState(false);

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
            { text: "Cancel", style: "cancel" },
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
    } finally {
      setSearching(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Barcode Lookup</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="barcode" size={64} color={Colors.primary} />
        </View>

        <Text style={styles.instruction}>
          Enter the barcode number manually to look up an existing listing or create a new one.
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
});
