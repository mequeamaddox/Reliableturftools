import React, { useRef } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

function BarcodeVisual({ value }: { value: string }) {
  const chars = value.split("");
  const bars: { width: number; filled: boolean }[] = [];
  chars.forEach((char, i) => {
    const code = char.charCodeAt(0);
    bars.push({ width: 2, filled: true });
    bars.push({ width: code % 3 === 0 ? 3 : 1, filled: false });
    bars.push({ width: code % 2 === 0 ? 2 : 3, filled: true });
    bars.push({ width: 1, filled: false });
    if (i < chars.length - 1) {
      bars.push({ width: 1, filled: code % 5 > 2 });
    }
  });

  return (
    <View style={labelStyles.barcodeContainer}>
      <View style={labelStyles.barcodeLines}>
        {bars.map((bar, i) => (
          <View
            key={i}
            style={{
              width: bar.width,
              height: 50,
              backgroundColor: bar.filled ? "#000" : "#fff",
            }}
          />
        ))}
      </View>
      <Text style={labelStyles.barcodeText}>{value}</Text>
    </View>
  );
}

function LabelCard({ listing }: { listing: any }) {
  return (
    <View style={labelStyles.label}>
      <Text style={labelStyles.businessName}>RELIABLE TURF TOOLS</Text>
      <View style={labelStyles.divider} />
      <Text style={labelStyles.itemTitle} numberOfLines={2}>{listing.title}</Text>
      <View style={labelStyles.detailRow}>
        <View style={labelStyles.detailCol}>
          <Text style={labelStyles.detailLabel}>SKU</Text>
          <Text style={labelStyles.detailValue}>{listing.sku}</Text>
        </View>
        <View style={labelStyles.detailCol}>
          <Text style={labelStyles.detailLabel}>CONDITION</Text>
          <Text style={labelStyles.detailValue}>{(listing.condition || "").replace(/_/g, " ")}</Text>
        </View>
      </View>
      <View style={labelStyles.detailRow}>
        <View style={labelStyles.detailCol}>
          <Text style={labelStyles.detailLabel}>CATEGORY</Text>
          <Text style={labelStyles.detailValue}>{(listing.category || "").replace(/_/g, " ")}</Text>
        </View>
        {listing.brand && (
          <View style={labelStyles.detailCol}>
            <Text style={labelStyles.detailLabel}>BRAND</Text>
            <Text style={labelStyles.detailValue}>{listing.brand}</Text>
          </View>
        )}
      </View>
      <View style={labelStyles.priceRow}>
        <Text style={labelStyles.priceLabel}>PRICE</Text>
        <Text style={labelStyles.priceValue}>${parseFloat(listing.price || 0).toFixed(2)}</Text>
      </View>
      <BarcodeVisual value={listing.sku} />
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

  function handlePrint() {
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
      const url = `${getApiUrl()}/api/listings/${id}/label-print`;
      Linking.openURL(url);
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
        <Text style={styles.previewHint}>Preview of your label</Text>

        <View style={styles.labelWrapper}>
          <LabelCard listing={listing} />
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={Colors.info} />
          <Text style={styles.infoText}>
            SKU: {listing.sku}
          </Text>
        </View>

        <Pressable style={styles.printBigBtn} onPress={handlePrint}>
          <Ionicons name="print" size={24} color="#fff" />
          <Text style={styles.printBigText}>Print Label</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function generatePrintHtml(listing: any): string {
  const sku = listing.sku || "";
  const title = listing.title || "";
  const condition = (listing.condition || "").replace(/_/g, " ");
  const category = (listing.category || "").replace(/_/g, " ");
  const brand = listing.brand || "";
  const price = parseFloat(listing.price || 0).toFixed(2);

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Label - ${sku}</title>
<style>
  @page { size: 4in 2.5in; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; background: #fff; }
  .label { width: 4in; height: 2.5in; padding: 0.15in; border: 2px solid #000; display: flex; flex-direction: column; }
  .biz { font-size: 11pt; font-weight: bold; text-align: center; letter-spacing: 2px; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 4px; }
  .title { font-size: 10pt; font-weight: bold; text-align: center; margin-bottom: 4px; max-height: 28px; overflow: hidden; }
  .details { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 8pt; margin-bottom: 4px; }
  .detail-label { font-weight: bold; color: #666; font-size: 7pt; }
  .detail-value { font-weight: bold; }
  .price-row { display: flex; justify-content: center; align-items: baseline; gap: 8px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 3px 0; margin: 3px 0; }
  .price-label { font-size: 9pt; font-weight: bold; }
  .price { font-size: 18pt; font-weight: bold; }
  .barcode { text-align: center; margin-top: auto; }
  .barcode-text { font-size: 9pt; letter-spacing: 2px; margin-top: 2px; }
  .bars { display: flex; justify-content: center; height: 35px; }
  .bar { height: 100%; }
</style></head>
<body>
<div class="label">
  <div class="biz">RELIABLE TURF TOOLS</div>
  <div class="title">${title}</div>
  <div class="details">
    <div><span class="detail-label">SKU:</span> <span class="detail-value">${sku}</span></div>
    <div><span class="detail-label">COND:</span> <span class="detail-value">${condition}</span></div>
    <div><span class="detail-label">CAT:</span> <span class="detail-value">${category}</span></div>
    ${brand ? `<div><span class="detail-label">BRAND:</span> <span class="detail-value">${brand}</span></div>` : ""}
  </div>
  <div class="price-row">
    <span class="price-label">PRICE</span>
    <span class="price">$${price}</span>
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
    const widths = [2, c%3===0?3:1, c%2===0?2:3, 1];
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
    borderRadius: 12,
    padding: 4,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.cardBg,
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
    width: "100%",
    maxWidth: 380,
  },
  infoText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.text,
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
    padding: 12,
    borderWidth: 2,
    borderColor: "#000",
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  businessName: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#000",
    textAlign: "center",
    letterSpacing: 2,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    marginBottom: 6,
  },
  divider: {
    display: "none",
  },
  itemTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#000",
    textAlign: "center",
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 4,
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 8,
    color: "#666",
    letterSpacing: 1,
  },
  detailValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "#000",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "baseline",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderStyle: "dashed",
    paddingVertical: 6,
    marginVertical: 6,
  },
  priceLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: "#000",
  },
  priceValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#000",
  },
  barcodeContainer: {
    alignItems: "center",
    marginTop: 4,
  },
  barcodeLines: {
    flexDirection: "row",
    height: 40,
    justifyContent: "center",
  },
  barcodeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "#000",
    letterSpacing: 2,
    marginTop: 2,
  },
});
