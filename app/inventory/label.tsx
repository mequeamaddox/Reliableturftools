import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

function BarcodeVisual({ value, height = 28 }: { value: string; height?: number }) {
  const chars = value.split("");
  const bars: { width: number; filled: boolean }[] = [];
  chars.forEach((char, i) => {
    const code = char.charCodeAt(0);
    bars.push({ width: 1.5, filled: true });
    bars.push({ width: code % 3 === 0 ? 2 : 1, filled: false });
    bars.push({ width: code % 2 === 0 ? 1.5 : 2, filled: true });
    bars.push({ width: 1, filled: false });
    if (i < chars.length - 1) {
      bars.push({ width: 1, filled: code % 5 > 2 });
    }
  });

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ flexDirection: "row", height, justifyContent: "center" }}>
        {bars.map((bar, i) => (
          <View
            key={i}
            style={{
              width: bar.width,
              height,
              backgroundColor: bar.filled ? "#000" : "#fff",
            }}
          />
        ))}
      </View>
    </View>
  );
}

function LabelCard({ listing }: { listing: any }) {
  const sku = listing.sku || "N/A";
  const price = parseFloat(listing.price || 0).toFixed(2);
  const condition = (listing.condition || "").replace(/_/g, " ");

  return (
    <View style={labelStyles.label}>
      <Text style={labelStyles.businessName}>RELIABLE TURF TOOLS</Text>
      <View style={labelStyles.midRow}>
        <View style={{ flex: 1 }}>
          <Text style={labelStyles.sku}>{sku}</Text>
          <Text style={labelStyles.condition}>{condition}</Text>
        </View>
        <Text style={labelStyles.price}>${price}</Text>
      </View>
      <BarcodeVisual value={sku} height={24} />
      <Text style={labelStyles.barcodeText}>{sku}</Text>
    </View>
  );
}

export default function LabelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: listing, isLoading } = useQuery<any>({
    queryKey: [`/api/listings/${id}`],
  });

  async function handlePrint() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(generatePrintHtml(listing));
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
      }
    } else {
      try {
        const url = `${getApiUrl()}/api/listings/${id}/label-print`;
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          Alert.alert("Print", "Open this label in your browser to print it.", [
            { text: "OK", style: "default" },
          ]);
        }
      } catch {
        Alert.alert("Print", "Could not open the print page. Try printing from a computer.");
      }
    }
  }

  if (isLoading || !listing) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Label Preview</Text>
        <Pressable onPress={handlePrint} hitSlop={12} style={styles.printBtn}>
          <Ionicons name="print" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20,
          paddingHorizontal: 16,
          alignItems: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.previewHint}>1" x 2" label preview</Text>

        <View style={styles.labelWrapper}>
          <LabelCard listing={listing} />
        </View>

        <Text style={styles.sizeNote}>Actual print size: 1" x 2"</Text>

        {!listing.sku && (
          <View style={styles.warningCard}>
            <Ionicons name="warning" size={18} color={Colors.warning} />
            <Text style={styles.warningText}>
              No SKU generated yet. Go back and tap "Generate" next to the SKU field first.
            </Text>
          </View>
        )}

        <Pressable style={styles.printBigBtn} onPress={handlePrint}>
          <Ionicons name="print" size={24} color="#fff" />
          <Text style={styles.printBigText}>Print Label</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function generatePrintHtml(listing: any): string {
  const sku = listing.sku || "N/A";
  const price = parseFloat(listing.price || 0).toFixed(2);
  const condition = (listing.condition || "").replace(/_/g, " ");

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Label - ${sku}</title>
<style>
  @page { size: 2in 1in; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', 'Helvetica', sans-serif; background: #fff; }
  .label { width: 2in; height: 1in; padding: 3px 5px; display: flex; flex-direction: column; justify-content: space-between; }
  .biz { font-size: 6.5pt; font-weight: bold; text-align: center; letter-spacing: 1px; border-bottom: 1px solid #000; padding-bottom: 1px; margin-bottom: 1px; }
  .mid { display: flex; flex-direction: row; align-items: center; justify-content: space-between; }
  .sku { font-size: 7pt; font-weight: bold; }
  .cond { font-size: 5.5pt; color: #555; }
  .price { font-size: 14pt; font-weight: bold; }
  .barcode { text-align: center; }
  .barcode-text { font-size: 5.5pt; letter-spacing: 1px; }
  .bars { display: flex; justify-content: center; height: 18px; }
  .bar { height: 100%; }
</style></head>
<body>
<div class="label">
  <div class="biz">RELIABLE TURF TOOLS</div>
  <div class="mid">
    <div>
      <div class="sku">${sku}</div>
      <div class="cond">${condition}</div>
    </div>
    <div class="price">$${price}</div>
  </div>
  <div class="barcode">
    <div class="bars" id="bars"></div>
    <div class="barcode-text">${sku}</div>
  </div>
</div>
<script>
  const sku = "${sku}";
  const barsEl = document.getElementById('bars');
  for (let i = 0; i < sku.length; i++) {
    const c = sku.charCodeAt(i);
    const widths = [1.5, c%3===0?2:1, c%2===0?1.5:2, 1];
    const fills = [true, false, true, false];
    widths.forEach((w, j) => {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.width = w + 'px';
      bar.style.backgroundColor = fills[j] ? '#000' : '#fff';
      barsEl.appendChild(bar);
    });
    if (i < sku.length - 1) {
      const sep = document.createElement('div');
      sep.className = 'bar';
      sep.style.width = '1px';
      sep.style.backgroundColor = c%5>2 ? '#000' : '#fff';
      barsEl.appendChild(sep);
    }
  }
</script>
</body></html>`;
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
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.text,
  },
  printBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  previewHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 16,
    textAlign: "center",
  },
  labelWrapper: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 2,
    width: 240,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  sizeNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 12,
    textAlign: "center",
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: `${Colors.warning}15`,
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
    width: "100%",
    maxWidth: 380,
  },
  warningText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.warning,
    flex: 1,
  },
  printBigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 20,
    width: "100%",
    maxWidth: 380,
  },
  printBigText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#fff",
  },
});

const labelStyles = StyleSheet.create({
  label: {
    padding: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 3,
    aspectRatio: 2 / 1,
    justifyContent: "space-between",
  },
  businessName: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    color: "#000",
    textAlign: "center",
    letterSpacing: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingBottom: 2,
  },
  midRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  sku: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: "#000",
  },
  condition: {
    fontFamily: "Inter_400Regular",
    fontSize: 7,
    color: "#555",
  },
  price: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#000",
  },
  barcodeText: {
    fontFamily: "Inter_400Regular",
    fontSize: 7,
    color: "#000",
    textAlign: "center",
    letterSpacing: 1,
  },
});
