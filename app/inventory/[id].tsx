import React, { useState, useEffect } from "react";
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
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";

const CONDITIONS = ["NEW_BOXED", "USED_UNBOXED", "USED", "DAMAGED"] as const;
const POWER_TYPES = ["GAS", "ELECTRIC_18V", "ELECTRIC_40V", "OTHER"] as const;
const CATEGORIES = ["TRIMMER", "BLOWER", "MOWER", "CHAINSAW", "BATTERY", "CHARGER", "OTHER"] as const;
const PAYMENT_TYPES = ["CASH", "CASHAPP", "ZELLE", "VENMO", "OTHER"] as const;

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

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: listing, isLoading } = useQuery<any>({
    queryKey: [`/api/listings/${id}`],
  });
  const { data: meetupSpots = [] } = useQuery<any[]>({ queryKey: ["/api/meetup-spots"] });

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState("USED");
  const [powerType, setPowerType] = useState("GAS");
  const [category, setCategory] = useState("OTHER");
  const [notes, setNotes] = useState("");
  const [showSellModal, setShowSellModal] = useState(false);
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [paymentType, setPaymentType] = useState("CASH");
  const [meetupSpot, setMeetupSpot] = useState("");

  useEffect(() => {
    if (listing) {
      setTitle(listing.title || "");
      setPrice(listing.price || "");
      setCost(listing.cost || "");
      setBrand(listing.brand || "");
      setBarcode(listing.barcode || "");
      setQuantity(String(listing.quantity || 1));
      setCondition(listing.condition || "USED");
      setPowerType(listing.powerType || "GAS");
      setCategory(listing.category || "OTHER");
      setNotes(listing.notes || "");
      setSalePrice(listing.price || "");
    }
  }, [listing]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/listings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/listings/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
  });

  const sellMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/listings/${id}/sell`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/buyers"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Sold!", "Item marked as sold");
      router.back();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/listings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
  });

  function handleSave() {
    updateMutation.mutate({
      title: title.trim(),
      price,
      cost: cost || null,
      brand: brand || null,
      barcode: barcode || null,
      quantity: parseInt(quantity) || 1,
      condition,
      powerType,
      category,
      notes: notes || null,
    });
  }

  function handleTogglePublish() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateMutation.mutate({ isPublished: !listing?.isPublished });
  }

  function handleMarkPending() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateMutation.mutate({ status: "PENDING" });
  }

  function handleArchive() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateMutation.mutate({ status: "ARCHIVED", isPublished: false });
  }

  function handleSell() {
    if (!buyerPhone.trim()) {
      Alert.alert("Required", "Buyer phone number is required");
      return;
    }
    sellMutation.mutate({
      buyerPhone: buyerPhone.trim(),
      buyerName: buyerName.trim() || undefined,
      salePrice: salePrice || listing?.price,
      paymentType,
      meetupSpot: meetupSpot || undefined,
    });
  }

  function handleDuplicate() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    apiRequest("POST", "/api/listings", {
      title: title + " (Copy)",
      price,
      cost: cost || undefined,
      brand: brand || undefined,
      quantity: parseInt(quantity) || 1,
      condition,
      powerType,
      category,
      notes: notes || undefined,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      Alert.alert("Duplicated", "Listing has been duplicated");
    });
  }

  function handleDelete() {
    Alert.alert("Delete Listing", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate() },
    ]);
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    AVAILABLE: Colors.available,
    PENDING: Colors.pending,
    SOLD: Colors.sold,
    ARCHIVED: Colors.archived,
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[listing?.status] || Colors.textMuted }]} />
          <Text style={styles.headerStatus}>{listing?.status}</Text>
        </View>
        <Pressable
          onPress={handleSave}
          disabled={updateMutation.isPending}
          style={[styles.saveBtn, updateMutation.isPending && { opacity: 0.5 }]}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="checkmark" size={24} color="#fff" />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {!showSellModal ? (
          <>
            <View style={styles.actionRow}>
              <Pressable style={[styles.actionBtn, { backgroundColor: listing?.isPublished ? Colors.warning : Colors.success }]} onPress={handleTogglePublish}>
                <Ionicons name={listing?.isPublished ? "eye-off" : "eye"} size={18} color="#fff" />
                <Text style={styles.actionBtnText}>{listing?.isPublished ? "Unpublish" : "Publish"}</Text>
              </Pressable>
              {listing?.status === "AVAILABLE" && (
                <>
                  <Pressable style={[styles.actionBtn, { backgroundColor: Colors.pending }]} onPress={handleMarkPending}>
                    <Ionicons name="time" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Pending</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, { backgroundColor: Colors.sold }]} onPress={() => setShowSellModal(true)}>
                    <Ionicons name="cash" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Sell</Text>
                  </Pressable>
                </>
              )}
              {listing?.status === "PENDING" && (
                <Pressable style={[styles.actionBtn, { backgroundColor: Colors.sold }]} onPress={() => setShowSellModal(true)}>
                  <Ionicons name="cash" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>Sell</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Title</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={Colors.textMuted} />
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Price</Text>
                <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Cost</Text>
                <TextInput style={styles.input} value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholder="Optional" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Qty</Text>
                <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholderTextColor={Colors.textMuted} />
              </View>
            </View>

            <ChipSelect options={CONDITIONS} value={condition} onChange={setCondition} label="Condition" />
            <ChipSelect options={POWER_TYPES} value={powerType} onChange={setPowerType} label="Power Type" />
            <ChipSelect options={CATEGORIES} value={category} onChange={setCategory} label="Category" />

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Brand</Text>
              <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="Brand name" placeholderTextColor={Colors.textMuted} />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Barcode</Text>
              <TextInput style={styles.input} value={barcode} onChangeText={setBarcode} placeholder="Barcode" placeholderTextColor={Colors.textMuted} />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>SKU</Text>
              <Text style={styles.skuText}>{listing?.sku}</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.input, styles.textarea]} value={notes} onChangeText={setNotes} multiline numberOfLines={3} placeholderTextColor={Colors.textMuted} placeholder="Notes..." />
            </View>

            <View style={styles.bottomActions}>
              <Pressable style={styles.bottomBtn} onPress={handleDuplicate}>
                <Ionicons name="copy-outline" size={18} color={Colors.info} />
                <Text style={[styles.bottomBtnText, { color: Colors.info }]}>Duplicate</Text>
              </Pressable>
              <Pressable style={styles.bottomBtn} onPress={handleArchive}>
                <Ionicons name="archive-outline" size={18} color={Colors.warning} />
                <Text style={[styles.bottomBtnText, { color: Colors.warning }]}>Archive</Text>
              </Pressable>
              <Pressable style={styles.bottomBtn} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                <Text style={[styles.bottomBtnText, { color: Colors.danger }]}>Delete</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sellTitle}>Record Sale</Text>
            <Text style={styles.sellSubtitle}>Selling: {listing?.title}</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Buyer Phone *</Text>
              <TextInput style={styles.input} value={buyerPhone} onChangeText={setBuyerPhone} placeholder="555-0100" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Buyer Name</Text>
              <TextInput style={styles.input} value={buyerName} onChangeText={setBuyerName} placeholder="Optional" placeholderTextColor={Colors.textMuted} />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Sale Price</Text>
              <TextInput style={styles.input} value={salePrice} onChangeText={setSalePrice} keyboardType="decimal-pad" placeholderTextColor={Colors.textMuted} />
            </View>

            <ChipSelect options={PAYMENT_TYPES} value={paymentType} onChange={setPaymentType} label="Payment Type" />

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Meetup Spot</Text>
              <View style={styles.chipRow}>
                {meetupSpots.map((spot: any) => (
                  <Pressable
                    key={spot.id}
                    style={[styles.chip, meetupSpot === spot.label && styles.chipActive]}
                    onPress={() => { setMeetupSpot(spot.label); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.chipText, meetupSpot === spot.label && styles.chipTextActive]}>
                      {spot.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.sellActions}>
              <Pressable style={styles.cancelSellBtn} onPress={() => setShowSellModal(false)}>
                <Text style={styles.cancelSellText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmSellBtn, sellMutation.isPending && { opacity: 0.5 }]}
                onPress={handleSell}
                disabled={sellMutation.isPending}
              >
                {sellMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.confirmSellText}>Confirm Sale</Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
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
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerStatus: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#fff",
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
    minHeight: 80,
    textAlignVertical: "top" as const,
  },
  row: {
    flexDirection: "row",
    gap: 10,
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
  skuText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textMuted,
    marginLeft: 4,
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  bottomBtn: {
    alignItems: "center",
    gap: 4,
  },
  bottomBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  sellTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
    marginBottom: 4,
  },
  sellSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 20,
  },
  sellActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  cancelSellBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  cancelSellText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.textSecondary,
  },
  confirmSellBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  confirmSellText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#fff",
  },
});
