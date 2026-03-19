import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import Colors from "@/constants/colors";

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
  return (
    <View style={{ flexDirection: 'row', height, alignSelf: 'center' }}>
      {bars.map((bar, i) => (
        <View key={i} style={{ width: bar.w, height, backgroundColor: bar.filled ? '#000' : '#fff' }} />
      ))}
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

export default function LabelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [sharing, setSharing] = useState(false);
  const labelRef = useRef<View>(null);

  const { data: listing, isLoading } = useQuery<any>({
    queryKey: [`/api/listings/${id}`],
    enabled: !!id,
  });

  async function handleSave() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") {
      const html = generatePrintHtml(listing);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 500);
      }
      return;
    }

    try {
      setSharing(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow photo library access to save the label image.");
        return;
      }
      const uri = await captureRef(labelRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        pixelRatio: 3,
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "Label saved to your Photos. Open your printer app and print from there.");
    } catch (err) {
      Alert.alert("Error", "Could not save the label image. Please try again.");
    } finally {
      setSharing(false);
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
        <Pressable onPress={handleSave} hitSlop={12} style={styles.shareBtn}>
          <Ionicons name="download-outline" size={20} color="#fff" />
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
        <Text style={styles.previewHint}>2.5" x 1" label preview</Text>

        <View style={styles.labelWrapper}>
          <LabelCard listing={listing} />
        </View>

        <View style={styles.captureArea} pointerEvents="none">
          <View ref={labelRef} collapsable={false} style={styles.captureLabel}>
            <LabelCard listing={listing} />
          </View>
        </View>

        <Text style={styles.sizeNote}>Actual print size: 2.5" x 1"</Text>

        {!listing.sku && (
          <View style={styles.warningCard}>
            <Ionicons name="warning" size={18} color={Colors.warning} />
            <Text style={styles.warningText}>
              No SKU generated yet. Go back and tap "Generate" next to the SKU field first.
            </Text>
          </View>
        )}

        <Pressable style={[styles.shareBigBtn, sharing && { opacity: 0.6 }]} onPress={handleSave} disabled={sharing}>
          {sharing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="download-outline" size={24} color="#fff" />
          )}
          <Text style={styles.shareBigText}>{sharing ? "Saving..." : "Save to Photos"}</Text>
        </Pressable>

        <Text style={styles.shareHint}>
          Saves the label as a PNG — open your SVANTTO printer app and print from Photos
        </Text>
      </ScrollView>
    </View>
  );
}

function generatePrintHtml(listing: any): string {
  const sku = listing.sku || "N/A";
  const price = parseFloat(listing.price || 0).toFixed(2);
  const condition = (listing.condition || "").replace(/_/g, " ");
  const title = (listing.title || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Label - ${sku}</title>
<style>
  @page { size: 2.5in 1in; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', 'Helvetica', sans-serif; background: #fff; }
  .label { width: 2.5in; height: 1in; padding: 3px 8px; display: flex; flex-direction: column; justify-content: space-between; }
  .biz { font-size: 6.5pt; font-weight: bold; text-align: center; letter-spacing: 1.5px; border-bottom: 0.5pt solid #000; padding-bottom: 1px; }
  .mid { display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 2px 0; }
  .left { flex: 1; padding-right: 4px; overflow: hidden; }
  .sku { font-size: 9pt; font-weight: bold; }
  .cond { font-size: 6pt; color: #555; margin-top: 1px; }
  .item-title { font-size: 5.5pt; color: #333; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .price { font-size: 16pt; font-weight: bold; white-space: nowrap; }
  .barcode-wrap { text-align: center; }
  .bars { display: flex; justify-content: center; height: 18px; }
  .barcode-text { font-size: 5pt; letter-spacing: 1px; margin-top: 1px; }
</style>
<script>
const C39={'0':'000110100','1':'100100001','2':'001100001','3':'101100000','4':'000110001','5':'100110000','6':'001110000','7':'000100101','8':'100100100','9':'001100100','A':'100001001','B':'001001001','C':'101001000','D':'000011001','E':'100011000','F':'001011000','G':'000001101','H':'100001100','I':'001001100','J':'000011100','K':'100000011','L':'001000011','M':'101000010','N':'000010011','O':'100010010','P':'001010010','Q':'000000111','R':'100000110','S':'001000110','T':'000010110','U':'110000001','V':'011000001','W':'111000000','X':'010010001','Y':'110010000','Z':'011010000','-':'010000101','.':'110000100',' ':'011000100','$':'010101000','/':'010100010','+':'010001010','%':'000101010','*':'010010100'};
function drawCode39(el,text){var N=1,W=3;var s=text.toUpperCase();var chars=['*'].concat(s.split('')).concat(['*']);var first=true;chars.forEach(function(ch,ci){if(ci>0)el.appendChild(Object.assign(document.createElement('div'),{style:'width:'+N+'px;height:100%;background:#fff;display:inline-block;'}));var pat=C39[ch];if(!pat)return;pat.split('').forEach(function(b,i){var d=document.createElement('div');d.style.cssText='width:'+(b==='1'?W:N)+'px;height:100%;background:'+(i%2===0?'#000':'#fff')+';display:inline-block;';el.appendChild(d);});});};
window.onload=function(){var el=document.getElementById('bars');drawCode39(el,'${sku}');setTimeout(function(){window.print();},600);};
</script>
</head>
<body>
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
    <div class="bars" id="bars" style="display:flex;height:18px;justify-content:center;"></div>
    <div class="barcode-text">${sku}</div>
  </div>
</div>
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
  shareBtn: {
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
    width: 300,
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
  shareBigBtn: {
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
  shareBigText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#fff",
  },
  shareHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 10,
    textAlign: "center",
    maxWidth: 300,
  },
  captureArea: {
    position: "absolute",
    left: -9999,
    top: -9999,
  },
  captureLabel: {
    width: 240,
    height: 96,
  },
});

const labelStyles = StyleSheet.create({
  label: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 3,
    aspectRatio: 2.5 / 1,
    justifyContent: "space-between",
  },
  businessName: {
    fontFamily: "Inter_700Bold",
    fontSize: 7,
    color: "#000",
    textAlign: "center",
    letterSpacing: 1.5,
    borderBottomWidth: 0.5,
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
