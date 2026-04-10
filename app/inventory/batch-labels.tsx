import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
} from "react-native";
import { Svg, Rect } from "react-native-svg";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const CODE39: Record<string, string> = {
  '0':'000110100','1':'100100001','2':'001100001','3':'101100000',
  '4':'000110001','5':'100110000','6':'001110000','7':'000100101',
  '8':'100100100','9':'001100100','A':'100001001','B':'001001001',
  'C':'101001000','D':'000011001','E':'100011000','F':'001011000',
  'G':'000001101','H':'100001100','I':'001001100','J':'000011100',
  'K':'100000011','L':'001000011','M':'101000010','N':'000010011',
  'O':'100010010','P':'001010010','Q':'000000111','R':'100000110',
  'S':'001000110','T':'000010110','U':'110000001','V':'011000001',
  'W':'111000000','X':'010010001','Y':'110010000','Z':'011010000',
  '-':'010000101','.':'110000100',' ':'011000100','$':'010101000',
  '/':'010100010','+':'010001010','%':'000101010','*':'010010100',
};

function encodeCode39(text: string): { w: number; filled: boolean }[] {
  const result: { w: number; filled: boolean }[] = [];
  const addChar = (ch: string) => {
    const pat = CODE39[ch];
    if (!pat) return;
    pat.split('').forEach((bit, i) => {
      result.push({ w: bit === '1' ? 3 : 1, filled: i % 2 === 0 });
    });
  };
  addChar('*');
  for (const ch of text.toUpperCase()) {
    if (CODE39[ch]) {
      result.push({ w: 1, filled: false });
      addChar(ch);
    }
  }
  result.push({ w: 1, filled: false });
  addChar('*');
  return result;
}

function BarcodeCode39({ value, height = 20 }: { value: string; height?: number }) {
  const bars = encodeCode39(value);
  const [containerWidth, setContainerWidth] = useState(0);
  const totalUnits = bars.reduce((sum, b) => sum + b.w, 0);
  const unitPx = containerWidth > 0 ? containerWidth / totalUnits : 0;

  let xPos = 0;
  const rects: { x: number; w: number }[] = [];
  for (const bar of bars) {
    const bw = bar.w * unitPx;
    if (bar.filled && unitPx > 0) rects.push({ x: xPos, w: bw });
    xPos += bw;
  }

  return (
    <View
      style={{ width: '100%', height }}
      onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {containerWidth > 0 && (
        <Svg width={containerWidth} height={height}>
          <Rect x={0} y={0} width={containerWidth} height={height} fill="#fff" />
          {rects.map((r, i) => (
            <Rect key={i} x={r.x} y={0} width={r.w} height={height} fill="#000" />
          ))}
        </Svg>
      )}
    </View>
  );
}

function LabelCard({ listing }: { listing: any }) {
  const sku = listing.sku || "N/A";
  const price = parseFloat(listing.price || 0).toFixed(2);
  const condition = (listing.condition || "").replace(/_/g, " ");
  const title = listing.title || "";

  return (
    <View style={labelStyles.label}>
      <Text style={labelStyles.businessName}>RELIABLE TURF TOOLS</Text>
      <View style={labelStyles.midRow}>
        <View style={{ flex: 1, paddingRight: 4 }}>
          <Text style={labelStyles.sku}>{sku}</Text>
          <Text style={labelStyles.condition}>{condition}</Text>
          <Text style={labelStyles.itemTitle} numberOfLines={1}>{title}</Text>
        </View>
        <Text style={labelStyles.price}>${price}</Text>
      </View>
      <View style={labelStyles.barcodeArea}>
        <BarcodeCode39 value={sku === "N/A" ? "RTT-000-0000" : sku} height={18} />
        <Text style={labelStyles.barcodeText}>{sku}</Text>
      </View>
    </View>
  );
}

function generateBatchPrintHtml(listings: any[]): string {
  const labelsHtml = listings
    .map((listing) => {
      const sku = listing.sku || "N/A";
      const price = parseFloat(listing.price || 0).toFixed(2);
      const condition = (listing.condition || "").replace(/_/g, " ");
      const title = (listing.title || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `
<div class="label">
  <div class="biz">RELIABLE TURF TOOLS</div>
  <div class="mid">
    <div class="left">
      <div class="sku">${sku}</div>
      <div class="cond">${condition}</div>
      <div class="item-title">${title}</div>
    </div>
    <div class="price">$${price}</div>
  </div>
  <div class="barcode-wrap">
    <div class="bars" data-sku="${sku}" style="display:flex;height:18px;justify-content:center;"></div>
    <div class="barcode-text">${sku}</div>
  </div>
</div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Batch Labels (${listings.length})</title>
<style>
  @page { size: 2.5in 1in; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', 'Helvetica', sans-serif; background: #fff; }
  .label { width: 2.5in; height: 1in; padding: 3px 8px; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
  .biz { font-size: 6.5pt; font-weight: bold; text-align: center; letter-spacing: 1.5px; border-bottom: 0.5pt solid #000; padding-bottom: 1px; }
  .mid { display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 2px 0; }
  .left { flex: 1; padding-right: 4px; overflow: hidden; }
  .sku { font-size: 9pt; font-weight: bold; }
  .cond { font-size: 6pt; color: #555; margin-top: 1px; }
  .item-title { font-size: 5.5pt; color: #333; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .price { font-size: 16pt; font-weight: bold; white-space: nowrap; }
  .barcode-wrap { text-align: center; }
  .barcode-text { font-size: 5pt; letter-spacing: 1px; margin-top: 1px; }
</style>
<script>
const C39={'0':'000110100','1':'100100001','2':'001100001','3':'101100000','4':'000110001','5':'100110000','6':'001110000','7':'000100101','8':'100100100','9':'001100100','A':'100001001','B':'001001001','C':'101001000','D':'000011001','E':'100011000','F':'001011000','G':'000001101','H':'100001100','I':'001001100','J':'000011100','K':'100000011','L':'001000011','M':'101000010','N':'000010011','O':'100010010','P':'001010010','Q':'000000111','R':'100000110','S':'001000110','T':'000010110','U':'110000001','V':'011000001','W':'111000000','X':'010010001','Y':'110010000','Z':'011010000','-':'010000101','.':'110000100',' ':'011000100','$':'010101000','/':'010100010','+':'010001010','%':'000101010','*':'010010100'};
function drawCode39(el,text){var N=1,W=3;var s=text.toUpperCase();var first=true;['*'].concat(s.split('')).concat(['*']).forEach(function(ch,ci){if(ci>0){var g=document.createElement('div');g.style.cssText='width:'+N+'px;height:100%;background:#fff;display:inline-block;';el.appendChild(g);}var pat=C39[ch];if(!pat)return;pat.split('').forEach(function(b,i){var d=document.createElement('div');d.style.cssText='width:'+(b==='1'?W:N)+'px;height:100%;background:'+(i%2===0?'#000':'#fff')+';display:inline-block;';el.appendChild(d);});});}
window.onload=function(){document.querySelectorAll('.bars').forEach(function(el){drawCode39(el,el.getAttribute('data-sku'));});setTimeout(function(){window.print();},600);};
</script>
</head>
<body>
${labelsHtml}
</body></html>`;
}

export default function BatchLabelsScreen() {
  const { ids } = useLocalSearchParams<{ ids: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [sharingIndex, setSharingIndex] = useState(-1);
  const labelRefs = useRef<(View | null)[]>([]);

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

  async function handleSaveSingle(index: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") return;
    try {
      setSharingIndex(index);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow photo library access to save label images.");
        return;
      }
      const ref = labelRefs.current[index];
      if (!ref) return;
      const uri = await captureRef(ref, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        scale: 4,
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "Label saved to your Photos.");
    } catch (err) {
      Alert.alert("Error", "Could not save the label.");
    } finally {
      setSharingIndex(-1);
    }
  }

  async function handleSaveAll() {
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
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow photo library access to save label images.");
        return;
      }
      setSharing(true);
      let saved = 0;
      for (let i = 0; i < listings.length; i++) {
        try {
          setSharingIndex(i);
          const ref = labelRefs.current[i];
          if (!ref) continue;
          const uri = await captureRef(ref, {
            format: "png",
            quality: 1,
            result: "tmpfile",
            scale: 4,
          });
          await MediaLibrary.saveToLibraryAsync(uri);
          saved++;
        } catch (err) {
          // continue with remaining labels
        }
      }
      setSharing(false);
      setSharingIndex(-1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", `${saved} of ${listings.length} labels saved to your Photos. Open your SVANTTO app and print from there.`);
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
        <Pressable onPress={handleSaveAll} hitSlop={12} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={20} color="#fff" />
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
        <Text style={styles.previewHint}>Tap a label to save it individually</Text>

        {listings.map((listing, i) => (
          <Pressable key={listing.id || i} style={styles.labelRow} onPress={() => handleSaveSingle(i)}>
            <View style={styles.labelIndex}>
              {sharingIndex === i ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.labelIndexText}>{i + 1}</Text>
              )}
            </View>
            <View style={styles.labelWrapper}>
              <View ref={(r) => { labelRefs.current[i] = r; }} collapsable={false}>
                <LabelCard listing={listing} />
              </View>
            </View>
            <Text style={styles.labelTitle} numberOfLines={1}>{listing.title}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
        <Pressable style={[styles.shareBigBtn, sharing && { opacity: 0.6 }]} onPress={handleSaveAll} disabled={sharing}>
          {sharing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="download-outline" size={24} color="#fff" />
          )}
          <Text style={styles.shareBigText}>
            {sharing ? `Saving ${sharingIndex + 1} of ${listings.length}...` : `Save All ${listings.length} Labels to Photos`}
          </Text>
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
  shareBtn: {
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
    width: 300,
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
  shareBigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    width: "100%",
  },
  shareBigText: {
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
    aspectRatio: 2.5 / 1,
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
    marginTop: 1,
  },
  itemTitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 6.5,
    color: "#333",
    marginTop: 1,
  },
  price: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#000",
  },
  barcodeArea: {
    alignItems: "center",
    paddingTop: 1,
  },
  barcodeText: {
    fontFamily: "Inter_400Regular",
    fontSize: 5.5,
    color: "#000",
    letterSpacing: 1,
    marginTop: 1,
  },
});
