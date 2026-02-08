import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Linking,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { getApiUrl, apiRequest } from "@/lib/query-client";

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

function generateBatchPrintHtml(listings: any[]): string {
  const labelsHtml = listings
    .map((listing) => {
      const sku = listing.sku || "N/A";
      const price = parseFloat(listing.price || 0).toFixed(2);
      const condition = (listing.condition || "").replace(/_/g, " ");
      return `
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
    <div class="bars" data-sku="${sku}"></div>
    <div class="barcode-text">${sku}</div>
  </div>
</div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Batch Labels (${listings.length})</title>
<style>
  @page { size: 2in 1in; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', 'Helvetica', sans-serif; background: #fff; }
  .label { width: 2in; height: 1in; padding: 3px 5px; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
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
${labelsHtml}
<script>
  document.querySelectorAll('.bars').forEach(function(barsEl) {
    var sku = barsEl.getAttribute('data-sku');
    for (var i = 0; i < sku.length; i++) {
      var c = sku.charCodeAt(i);
      var widths = [1.5, c%3===0?2:1, c%2===0?1.5:2, 1];
      var fills = [true, false, true, false];
      widths.forEach(function(w, j) {
        var bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.width = w + 'px';
        bar.style.backgroundColor = fills[j] ? '#000' : '#fff';
        barsEl.appendChild(bar);
      });
      if (i < sku.length - 1) {
        var sep = document.createElement('div');
        sep.className = 'bar';
        sep.style.width = '1px';
        sep.style.backgroundColor = c%5>2 ? '#000' : '#fff';
        barsEl.appendChild(sep);
      }
    }
  });
</script>
</body></html>`;
}

export default function BatchLabelsScreen() {
  const { ids } = useLocalSearchParams<{ ids: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ids) return;
    const idArray = ids.split(",");
    setLoading(true);
    apiRequest("POST", "/api/listings/batch-labels", { ids: idArray })
      .then((res: any) => res.json())
      .then((data: any) => {
        setListings(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load labels");
        setLoading(false);
      });
  }, [ids]);

  function handlePrint() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(generateBatchPrintHtml(listings));
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
      }
    } else {
      const printWindow = window;
      const html = generateBatchPrintHtml(listings);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      Linking.openURL(url);
    }
  }

  const noSkuItems = listings.filter((l) => !l.sku);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ fontFamily: "Inter_500Medium", color: Colors.textMuted, marginTop: 12 }}>
          Loading {ids?.split(",").length || 0} labels...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="alert-circle" size={48} color={Colors.danger} />
        <Text style={{ fontFamily: "Inter_500Medium", color: Colors.textMuted, marginTop: 12 }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{listings.length} Labels</Text>
        <Pressable onPress={handlePrint} hitSlop={12} style={styles.printBtn}>
          <Ionicons name="print" size={20} color="#fff" />
        </Pressable>
      </View>

      {noSkuItems.length > 0 && (
        <View style={styles.warningCard}>
          <Ionicons name="warning" size={18} color={Colors.warning} />
          <Text style={styles.warningText}>
            {noSkuItems.length} item{noSkuItems.length > 1 ? "s" : ""} missing SKU — labels will show "N/A"
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 120,
          paddingHorizontal: 16,
          alignItems: "center",
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.previewHint}>1" x 2" label preview — {listings.length} total</Text>

        {listings.map((listing, i) => (
          <View key={listing.id || i} style={styles.labelRow}>
            <View style={styles.labelIndex}>
              <Text style={styles.labelIndexText}>{i + 1}</Text>
            </View>
            <View style={styles.labelWrapper}>
              <LabelCard listing={listing} />
            </View>
            <Text style={styles.labelTitle} numberOfLines={1}>{listing.title}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
        <Pressable style={styles.printBigBtn} onPress={handlePrint}>
          <Ionicons name="print" size={24} color="#fff" />
          <Text style={styles.printBigText}>Print All {listings.length} Labels</Text>
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
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: `${Colors.warning}15`,
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  warningText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.warning,
    flex: 1,
  },
  previewHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 4,
    textAlign: "center",
  },
  labelRow: {
    alignItems: "center",
    gap: 6,
  },
  labelIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  labelIndexText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: "#fff",
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
  labelTitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    maxWidth: 240,
    textAlign: "center",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBg,
  },
  printBigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    width: "100%",
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
