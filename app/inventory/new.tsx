import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";

const FALLBACK_CONDITIONS = ["NEW_BOXED", "USED_UNBOXED", "USED", "DAMAGED"];
const FALLBACK_POWER_TYPES = ["GAS", "ELECTRIC_18V", "ELECTRIC_40V", "OTHER"];
const FALLBACK_CATEGORIES = ["TRIMMER", "BLOWER", "MOWER", "CHAINSAW", "BATTERY", "CHARGER", "OTHER"];

function ChipSelect({ options, value, onChange, label }: { options: readonly string[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            style={[styles.chip, value === opt && styles.chipActive]}
            onPress={() => { onChange(opt); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>
              {opt.replace(/_/g, " ")}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function NewListingScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ barcode?: string; partFromTitle?: string; partFromBrand?: string; partFromPallet?: string; startPallet?: string }>();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const titleRef = useRef<TextInput>(null);

  const isPartOut = !!params.partFromTitle;

  const [mode, setMode] = useState<"single" | "pallet">(isPartOut || params.startPallet === "1" ? "pallet" : "single");

  // Pallet-level defaults (sticky in pallet mode)
  const [palletName, setPalletName] = useState(
    isPartOut ? `Parts: ${params.partFromTitle}` : ""
  );
  const [palletCost, setPalletCost] = useState("");
  const [palletAddedCount, setPalletAddedCount] = useState(0);

  // Item-level fields (reset between items in pallet mode)
  const [listingType, setListingType] = useState<"ITEM" | "PART">(isPartOut ? "PART" : "ITEM");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [brand, setBrand] = useState(params.partFromBrand || "");
  const [barcode, setBarcode] = useState(params.barcode || "");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState("USED");
  const [powerType, setPowerType] = useState("GAS");
  const [category, setCategory] = useState("OTHER");
  const [notes, setNotes] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [boxLengthIn, setBoxLengthIn] = useState("");
  const [boxWidthIn, setBoxWidthIn] = useState("");
  const [boxHeightIn, setBoxHeightIn] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerScanned, setScannerScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const { data: inventoryOptions } = useQuery<{
    conditions: string[];
    powerTypes: string[];
    categories: string[];
  }>({ queryKey: ["/api/inventory-options"] });

  const { data: existingPallets = [] } = useQuery<string[]>({ queryKey: ["/api/pallets"] });

  const CONDITIONS = inventoryOptions?.conditions ?? FALLBACK_CONDITIONS;
  const POWER_TYPES = inventoryOptions?.powerTypes ?? FALLBACK_POWER_TYPES;
  const CATEGORIES = inventoryOptions?.categories ?? FALLBACK_CATEGORIES;

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/listings", data),
    onSuccess: (_data, _vars, context: any) => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/listings") });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pallets"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (context?.addAnother) {
        setPalletAddedCount((c) => c + 1);
        setTitle("");
        setPrice("");
        setCost("");
        setNotes("");
        setBarcode("");
        setQuantity("1");
        // brand, condition, powerType, category stay sticky
        setTimeout(() => titleRef.current?.focus(), 100);
      } else {
        router.back();
      }
    },
    onError: () => {
      Alert.alert("Error", "Failed to create listing");
    },
  });

  function buildPayload() {
    if (mode === "pallet") {
      return {
        title: title.trim(),
        price,
        brand: brand || undefined,
        barcode: barcode || undefined,
        quantity: parseInt(quantity) || 1,
        condition,
        powerType,
        category,
        notes: notes || undefined,
        listingType,
        palletName: palletName.trim() || undefined,
        palletCost: palletCost || undefined,
      };
    }
    return {
      title: title.trim(),
      price,
      cost: cost || undefined,
      brand: brand || undefined,
      barcode: barcode || undefined,
      quantity: parseInt(quantity) || 1,
      condition,
      powerType,
      category,
      notes: notes || undefined,
      listingType,
      palletName: palletName || undefined,
      weightLbs: weightLbs || undefined,
      boxLengthIn: boxLengthIn || undefined,
      boxWidthIn: boxWidthIn || undefined,
      boxHeightIn: boxHeightIn || undefined,
    };
  }

  function validate() {
    if (!title.trim()) { Alert.alert("Required", "Please enter a title"); return false; }
    if (!price.trim()) { Alert.alert("Required", "Please enter a price"); return false; }
    if (mode === "pallet" && !isPartOut && !palletName.trim()) { Alert.alert("Required", "Please enter a pallet name"); return false; }
    return true;
  }

  function handleSaveAndNext() {
    if (!validate()) return;
    createMutation.mutate(buildPayload(), { context: { addAnother: true } } as any);
  }

  function handleSaveDone() {
    if (!validate()) return;
    createMutation.mutate(buildPayload(), { context: { addAnother: false } } as any);
  }

  function switchMode(m: "single" | "pallet") {
    setMode(m);
    setPalletAddedCount(0);
    Haptics.selectionAsync();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isPartOut
            ? (palletAddedCount > 0 ? `${palletAddedCount} parts added` : "Part Out")
            : mode === "pallet"
              ? (palletAddedCount > 0 ? `${palletAddedCount} added` : "Pallet Intake")
              : "Quick Add"}
        </Text>
        {mode === "single" ? (
          <Pressable
            onPress={handleSaveDone}
            disabled={createMutation.isPending}
            style={[styles.saveBtn, createMutation.isPending && { opacity: 0.5 }]}
          >
            {createMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="checkmark" size={24} color="#fff" />
            )}
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Mode Toggle — hidden in Part Out mode */}
      {!isPartOut && (
        <View style={styles.modeToggleRow}>
          <Pressable
            style={[styles.modeBtn, mode === "single" && styles.modeBtnActive]}
            onPress={() => switchMode("single")}
          >
            <Ionicons name="add-circle-outline" size={16} color={mode === "single" ? "#fff" : Colors.textSecondary} />
            <Text style={[styles.modeBtnText, mode === "single" && styles.modeBtnTextActive]}>Single Item</Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === "pallet" && styles.modeBtnActive]}
            onPress={() => switchMode("pallet")}
          >
            <Ionicons name="layers-outline" size={16} color={mode === "pallet" ? "#fff" : Colors.textSecondary} />
            <Text style={[styles.modeBtnText, mode === "pallet" && styles.modeBtnTextActive]}>Pallet Intake</Text>
          </Pressable>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ─── PALLET MODE ─── */}
        {mode === "pallet" && (
          <>
            {/* Pallet Defaults Card */}
            <View style={[styles.palletCard, isPartOut && styles.partOutCard]}>
              <View style={styles.palletCardHeader}>
                <Ionicons name={isPartOut ? "cut" : "lock-closed"} size={14} color={isPartOut ? Colors.warning : Colors.primary} />
                <Text style={[styles.palletCardTitle, isPartOut && styles.partOutCardTitle]}>
                  {isPartOut ? `Parts from: ${params.partFromTitle}` : "Pallet Name — locked for all items"}
                </Text>
              </View>

              {!isPartOut && (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Pallet Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={palletName}
                      onChangeText={setPalletName}
                      placeholder="e.g. Ryobi Mar-18, HD Pallet #4"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>What did this pallet cost? (total paid)</Text>
                    <TextInput
                      style={styles.input}
                      value={palletCost}
                      onChangeText={setPalletCost}
                      placeholder="0.00"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </>
              )}
              {isPartOut && (
                <Text style={styles.partOutHint}>
                  Each part will be tagged "Parts: {params.partFromTitle}" so you can find them together later.
                </Text>
              )}
            </View>

            {/* Item Fields */}
            <View style={styles.itemSection}>
              <View style={styles.itemSectionHeader}>
                <Ionicons name="cube-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.itemSectionTitle}>This Item</Text>
                {palletAddedCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{palletAddedCount} saved</Text>
                  </View>
                )}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  ref={titleRef}
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Ryobi 18V Leaf Blower"
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Brand <Text style={styles.stickyNote}>(sticky)</Text></Text>
                <TextInput
                  style={styles.input}
                  value={brand}
                  onChangeText={setBrand}
                  placeholder="e.g. Ryobi, Black+Decker, Homelite"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <ChipSelect options={POWER_TYPES} value={powerType} onChange={setPowerType} label="Power Type (sticky)" />
              <ChipSelect options={CATEGORIES} value={category} onChange={setCategory} label="Category (sticky)" />
              <ChipSelect options={CONDITIONS} value={condition} onChange={setCondition} label="Condition (sticky)" />

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Price *</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Missing battery, damaged cord, etc."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Barcode</Text>
                <View style={styles.barcodeRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={barcode}
                    onChangeText={setBarcode}
                    placeholder="Scan or type barcode"
                    placeholderTextColor={Colors.textMuted}
                  />
                  <Pressable
                    style={styles.scanBtn}
                    onPress={() => { setScannerScanned(false); setScannerVisible(true); }}
                  >
                    <Ionicons name="barcode" size={22} color="#fff" />
                  </Pressable>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ─── SINGLE MODE ─── */}
        {mode === "single" && (
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeRow}>
                <Pressable
                  style={[styles.typeBtn, listingType === "ITEM" && styles.typeBtnActive]}
                  onPress={() => { setListingType("ITEM"); Haptics.selectionAsync(); }}
                >
                  <Ionicons name="build-outline" size={18} color={listingType === "ITEM" ? "#fff" : Colors.textSecondary} />
                  <Text style={[styles.typeBtnText, listingType === "ITEM" && styles.typeBtnTextActive]}>Item</Text>
                </Pressable>
                <Pressable
                  style={[styles.typeBtn, listingType === "PART" && styles.typeBtnActive]}
                  onPress={() => { setListingType("PART"); Haptics.selectionAsync(); }}
                >
                  <Ionicons name="cog-outline" size={18} color={listingType === "PART" ? "#fff" : Colors.textSecondary} />
                  <Text style={[styles.typeBtnText, listingType === "PART" && styles.typeBtnTextActive]}>Part</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                ref={titleRef}
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. EGO 56V Trimmer"
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Price *</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="1"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {listingType === "ITEM" && (
              <>
                <ChipSelect options={CONDITIONS} value={condition} onChange={setCondition} label="Condition" />
                <ChipSelect options={POWER_TYPES} value={powerType} onChange={setPowerType} label="Power Type" />
              </>
            )}
            <ChipSelect options={CATEGORIES} value={category} onChange={setCategory} label="Category" />

            <Pressable
              style={styles.advancedToggle}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Text style={styles.advancedText}>
                {showAdvanced ? "Hide" : "Show"} Advanced Fields
              </Text>
              <Ionicons name={showAdvanced ? "chevron-up" : "chevron-down"} size={18} color={Colors.textMuted} />
            </Pressable>

            {showAdvanced && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Brand</Text>
                  <TextInput
                    style={styles.input}
                    value={brand}
                    onChangeText={setBrand}
                    placeholder="e.g. EGO, Stihl, Husqvarna"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Cost (for profit tracking)</Text>
                  <TextInput
                    style={styles.input}
                    value={cost}
                    onChangeText={setCost}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Barcode</Text>
                  <View style={styles.barcodeRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={barcode}
                      onChangeText={setBarcode}
                      placeholder="Scan or type barcode"
                      placeholderTextColor={Colors.textMuted}
                    />
                    <Pressable
                      style={styles.scanBtn}
                      onPress={() => { setScannerScanned(false); setScannerVisible(true); }}
                    >
                      <Ionicons name="barcode" size={22} color="#fff" />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Any notes about this item..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.sectionHeader}>
                  <Ionicons name="cube-outline" size={18} color={Colors.info} />
                  <Text style={styles.sectionHeaderText}>Sourcing</Text>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Assign to Pallet</Text>
                  {existingPallets.length > 0 && (
                    <View style={styles.palletChipsRow}>
                      {existingPallets.map((p) => (
                        <Pressable
                          key={p}
                          style={[styles.palletSelectChip, palletName === p && styles.palletSelectChipActive]}
                          onPress={() => { setPalletName(palletName === p ? "" : p); Haptics.selectionAsync(); }}
                        >
                          <Text style={[styles.palletSelectChipText, palletName === p && styles.palletSelectChipTextActive]}>
                            {p}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <TextInput
                    style={[styles.input, existingPallets.length > 0 && { marginTop: 6 }]}
                    value={palletName}
                    onChangeText={setPalletName}
                    placeholder={existingPallets.length > 0 ? "Or type a new pallet name" : "e.g. Pallet #3, HD Jan"}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {listingType === "ITEM" && (
                  <>
                    <View style={styles.shippingHeader}>
                      <Ionicons name="airplane-outline" size={18} color={Colors.primary} />
                      <Text style={styles.shippingHeaderText}>Shipping</Text>
                      {weightLbs ? (
                        <View style={styles.shippingBadge}>
                          <Text style={styles.shippingBadgeText}>ENABLED</Text>
                        </View>
                      ) : (
                        <View style={[styles.shippingBadge, { backgroundColor: "rgba(100,116,139,0.15)" }]}>
                          <Text style={[styles.shippingBadgeText, { color: Colors.textMuted }]}>MEETUP ONLY</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.shippingHint}>
                      Add weight to enable shipping. Leave blank for meetup-only items.
                    </Text>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>Weight (lbs)</Text>
                      <TextInput
                        style={styles.input}
                        value={weightLbs}
                        onChangeText={setWeightLbs}
                        placeholder="e.g. 5.5"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>

                    <View style={styles.row}>
                      <View style={[styles.fieldGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Length (in)</Text>
                        <TextInput
                          style={styles.input}
                          value={boxLengthIn}
                          onChangeText={setBoxLengthIn}
                          placeholder="14"
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={[styles.fieldGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Width (in)</Text>
                        <TextInput
                          style={styles.input}
                          value={boxWidthIn}
                          onChangeText={setBoxWidthIn}
                          placeholder="10"
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={[styles.fieldGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Height (in)</Text>
                        <TextInput
                          style={styles.input}
                          value={boxHeightIn}
                          onChangeText={setBoxHeightIn}
                          placeholder="8"
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Bottom Action Buttons — Pallet Mode */}
      {mode === "pallet" && (
        <View style={[styles.palletActions, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 8 }]}>
          <Pressable
            style={[styles.nextBtn, createMutation.isPending && { opacity: 0.6 }]}
            onPress={handleSaveAndNext}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.nextBtnText}>{isPartOut ? "Save Part & Next" : "Save & Next Item"}</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={styles.doneBtn}
            onPress={handleSaveDone}
            disabled={createMutation.isPending}
          >
            <Text style={styles.doneBtnText}>
              {isPartOut
                ? (palletAddedCount > 0 ? `Done — ${palletAddedCount + 1} parts total` : "Save Last Part & Done")
                : (palletAddedCount > 0 ? `Done (${palletAddedCount + 1} total)` : "Save & Done")}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ─── INLINE BARCODE SCANNER MODAL ─── */}
      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        {!cameraPermission?.granted ? (
          <View style={scanStyles.permContainer}>
            <Ionicons name="camera-outline" size={64} color={Colors.textMuted} />
            <Text style={scanStyles.permTitle}>Camera Access Needed</Text>
            <Text style={scanStyles.permDesc}>Allow camera access to scan barcodes.</Text>
            <Pressable style={scanStyles.permBtn} onPress={requestCameraPermission}>
              <Text style={scanStyles.permBtnText}>Allow Camera</Text>
            </Pressable>
            <Pressable style={[scanStyles.permBtn, { backgroundColor: Colors.surface, marginTop: 8 }]} onPress={() => setScannerVisible(false)}>
              <Text style={[scanStyles.permBtnText, { color: Colors.text }]}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flex: 1, backgroundColor: "#000" }}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "code93", "itf14", "codabar", "qr"],
              }}
              onBarcodeScanned={scannerScanned ? undefined : ({ data }) => {
                setScannerScanned(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setBarcode(data);
                setScannerVisible(false);
              }}
            />
            <View style={[scanStyles.camHeader, { paddingTop: insets.top + 8 }]}>
              <Pressable onPress={() => setScannerVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={28} color="#fff" />
              </Pressable>
              <Text style={scanStyles.camTitle}>Scan Barcode</Text>
              <View style={{ width: 28 }} />
            </View>
            <View style={scanStyles.camOverlay}>
              <View style={scanStyles.scanFrame}>
                <View style={[scanStyles.corner, scanStyles.topLeft]} />
                <View style={[scanStyles.corner, scanStyles.topRight]} />
                <View style={[scanStyles.corner, scanStyles.bottomLeft]} />
                <View style={[scanStyles.corner, scanStyles.bottomRight]} />
              </View>
              <Text style={scanStyles.hint}>Point camera at a barcode</Text>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const scanStyles = StyleSheet.create({
  permContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  permTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
    marginTop: 8,
  },
  permDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  permBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  permBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  camHeader: {
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
  camTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#fff",
  },
  camOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 280,
    height: 170,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: Colors.primary,
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  hint: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
    marginTop: 20,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});

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
  saveBtn: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  modeToggleRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    overflow: "hidden",
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
  },
  modeBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  modeBtnTextActive: {
    color: "#fff",
  },
  palletCard: {
    backgroundColor: `${Colors.primary}12`,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
  },
  palletCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  palletCardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stickyNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: "none" as const,
  },
  partOutCard: {
    backgroundColor: "rgba(234,88,12,0.08)",
    borderColor: "rgba(234,88,12,0.3)",
  },
  partOutCardTitle: {
    color: Colors.warning,
  },
  partOutHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
  palletChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 2,
  },
  palletSelectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  palletSelectChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  palletSelectChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.text,
  },
  palletSelectChipTextActive: {
    color: "#fff",
  },
  itemSection: {
    marginBottom: 8,
  },
  itemSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  itemSectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#fff",
  },
  palletActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  nextBtn: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
  },
  nextBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: "#fff",
  },
  doneBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  doneBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.textSecondary,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    padding: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  textarea: {
    minHeight: 70,
    textAlignVertical: "top" as const,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: "#fff",
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    marginBottom: 8,
  },
  advancedText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textMuted,
  },
  typeRow: {
    flexDirection: "row",
    gap: 0,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    overflow: "hidden",
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  typeBtnActive: {
    backgroundColor: Colors.primary,
  },
  typeBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  typeBtnTextActive: {
    color: "#fff",
  },
  barcodeRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  scanBtn: {
    backgroundColor: Colors.info,
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sectionHeaderText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.text,
  },
  shippingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  shippingHeaderText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  shippingBadge: {
    backgroundColor: "rgba(22,163,74,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  shippingBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  shippingHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
    marginLeft: 4,
  },
});
