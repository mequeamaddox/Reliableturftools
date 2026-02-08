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

function PickerList({ items, selectedId, onSelect, labelKey, subKey }: {
  items: any[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  labelKey: string;
  subKey?: string;
}) {
  return (
    <View style={styles.pickerList}>
      <Pressable
        style={[styles.pickerItem, !selectedId && styles.pickerItemActive]}
        onPress={() => { onSelect(null); Haptics.selectionAsync(); }}
      >
        <Text style={[styles.pickerItemText, !selectedId && styles.pickerItemTextActive]}>None</Text>
      </Pressable>
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={[styles.pickerItem, selectedId === item.id && styles.pickerItemActive]}
          onPress={() => { onSelect(item.id); Haptics.selectionAsync(); }}
        >
          <Text style={[styles.pickerItemText, selectedId === item.id && styles.pickerItemTextActive]} numberOfLines={1}>
            {item[labelKey] || item[subKey || "id"]}
          </Text>
          {subKey && item[subKey] && item[labelKey] && (
            <Text style={styles.pickerItemSub} numberOfLines={1}>{item[subKey]}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

export default function SaleFormScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const params = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!params.id;

  const [salePrice, setSalePrice] = useState("");
  const [paymentType, setPaymentType] = useState("CASH");
  const [meetupSpot, setMeetupSpot] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [showListingPicker, setShowListingPicker] = useState(false);
  const [showBuyerPicker, setShowBuyerPicker] = useState(false);
  const [showMeetupPicker, setShowMeetupPicker] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data: existingSale } = useQuery<any>({
    queryKey: ["/api/sales", params.id],
    enabled: isEdit,
  });

  const { data: listings = [] } = useQuery<any[]>({ queryKey: ["/api/listings"] });
  const { data: buyers = [] } = useQuery<any[]>({ queryKey: ["/api/buyers"] });
  const { data: meetupSpots = [] } = useQuery<any[]>({ queryKey: ["/api/meetup-spots"] });

  useEffect(() => {
    if (isEdit && existingSale && !loaded) {
      setSalePrice(parseFloat(existingSale.salePrice).toFixed(2));
      setPaymentType(existingSale.paymentType || "CASH");
      setMeetupSpot(existingSale.meetupSpot || "");
      setNotes(existingSale.notes || "");
      setSelectedListingId(existingSale.listingId || null);
      setSelectedBuyerId(existingSale.buyerId || null);
      setLoaded(true);
    }
  }, [existingSale, isEdit, loaded]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (isEdit) {
        return apiRequest("PUT", `/api/sales/${params.id}`, data);
      }
      return apiRequest("POST", "/api/sales", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: () => {
      Alert.alert("Error", `Failed to ${isEdit ? "update" : "record"} sale`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/sales/${params.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: () => {
      Alert.alert("Error", "Failed to delete sale");
    },
  });

  function handleSave() {
    if (!salePrice.trim()) {
      Alert.alert("Required", "Please enter a sale price");
      return;
    }
    saveMutation.mutate({
      salePrice: salePrice.trim(),
      paymentType,
      listingId: selectedListingId,
      buyerId: selectedBuyerId,
      meetupSpot: meetupSpot || null,
      notes: notes || null,
    });
  }

  function handleDelete() {
    Alert.alert("Delete Sale", "Are you sure you want to delete this sale record?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate() },
    ]);
  }

  const selectedListing = listings.find((l: any) => l.id === selectedListingId);
  const selectedBuyer = buyers.find((b: any) => b.id === selectedBuyerId);
  const isPending = saveMutation.isPending || deleteMutation.isPending;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEdit ? "Edit Sale" : "Record Sale"}</Text>
        <Pressable
          onPress={handleSave}
          disabled={isPending}
          style={[styles.saveBtn, isPending && { opacity: 0.5 }]}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="checkmark" size={24} color="#fff" />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Sale Price *</Text>
          <View style={styles.priceRow}>
            <Text style={styles.dollar}>$</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              value={salePrice}
              onChangeText={setSalePrice}
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              autoFocus={!isEdit}
            />
          </View>
        </View>

        <ChipSelect options={PAYMENT_TYPES} value={paymentType} onChange={setPaymentType} label="Payment Method" />

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Item (optional)</Text>
          <Pressable
            style={styles.selectorBtn}
            onPress={() => { setShowListingPicker(!showListingPicker); setShowBuyerPicker(false); setShowMeetupPicker(false); }}
          >
            <Ionicons name="cube-outline" size={20} color={selectedListing ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.selectorText, selectedListing && styles.selectorTextSelected]} numberOfLines={1}>
              {selectedListing ? selectedListing.title : "Select an item"}
            </Text>
            <Ionicons name={showListingPicker ? "chevron-up" : "chevron-down"} size={18} color={Colors.textMuted} />
          </Pressable>
          {showListingPicker && (
            <PickerList
              items={listings}
              selectedId={selectedListingId}
              onSelect={(id) => {
                setSelectedListingId(id);
                if (id && !salePrice) {
                  const l = listings.find((x: any) => x.id === id);
                  if (l) setSalePrice(parseFloat(l.price).toFixed(2));
                }
                setShowListingPicker(false);
              }}
              labelKey="title"
              subKey="sku"
            />
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Buyer (optional)</Text>
          <Pressable
            style={styles.selectorBtn}
            onPress={() => { setShowBuyerPicker(!showBuyerPicker); setShowListingPicker(false); setShowMeetupPicker(false); }}
          >
            <Ionicons name="person-outline" size={20} color={selectedBuyer ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.selectorText, selectedBuyer && styles.selectorTextSelected]} numberOfLines={1}>
              {selectedBuyer ? (selectedBuyer.name || selectedBuyer.phone) : "Select a buyer"}
            </Text>
            <Ionicons name={showBuyerPicker ? "chevron-up" : "chevron-down"} size={18} color={Colors.textMuted} />
          </Pressable>
          {showBuyerPicker && (
            <PickerList
              items={buyers}
              selectedId={selectedBuyerId}
              onSelect={(id) => { setSelectedBuyerId(id); setShowBuyerPicker(false); }}
              labelKey="name"
              subKey="phone"
            />
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Meetup Spot</Text>
          {meetupSpots.length > 0 ? (
            <>
              <Pressable
                style={styles.selectorBtn}
                onPress={() => { setShowMeetupPicker(!showMeetupPicker); setShowListingPicker(false); setShowBuyerPicker(false); }}
              >
                <Ionicons name="location-outline" size={20} color={meetupSpot ? Colors.primary : Colors.textMuted} />
                <Text style={[styles.selectorText, meetupSpot && styles.selectorTextSelected]} numberOfLines={1}>
                  {meetupSpot || "Select a meetup spot"}
                </Text>
                <Ionicons name={showMeetupPicker ? "chevron-up" : "chevron-down"} size={18} color={Colors.textMuted} />
              </Pressable>
              {showMeetupPicker && (
                <View style={styles.pickerList}>
                  <Pressable
                    style={[styles.pickerItem, !meetupSpot && styles.pickerItemActive]}
                    onPress={() => { setMeetupSpot(""); setShowMeetupPicker(false); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.pickerItemText, !meetupSpot && styles.pickerItemTextActive]}>None</Text>
                  </Pressable>
                  {meetupSpots.map((spot: any) => (
                    <Pressable
                      key={spot.id}
                      style={[styles.pickerItem, meetupSpot === spot.name && styles.pickerItemActive]}
                      onPress={() => { setMeetupSpot(spot.name); setShowMeetupPicker(false); Haptics.selectionAsync(); }}
                    >
                      <Text style={[styles.pickerItemText, meetupSpot === spot.name && styles.pickerItemTextActive]}>
                        {spot.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          ) : (
            <TextInput
              style={styles.input}
              value={meetupSpot}
              onChangeText={setMeetupSpot}
              placeholder="e.g. Walmart parking lot"
              placeholderTextColor={Colors.textMuted}
            />
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any details about this sale..."
            placeholderTextColor={Colors.textMuted}
            multiline
          />
        </View>

        {isEdit && (
          <Pressable style={styles.deleteBtn} onPress={handleDelete} disabled={isPending}>
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            <Text style={styles.deleteBtnText}>Delete Sale</Text>
          </Pressable>
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
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dollar: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.primary,
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    paddingVertical: 16,
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
  selectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  selectorText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.textMuted,
  },
  selectorTextSelected: {
    color: Colors.text,
    fontFamily: "Inter_500Medium",
  },
  pickerList: {
    marginTop: 8,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    overflow: "hidden",
    maxHeight: 200,
  },
  pickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerItemActive: {
    backgroundColor: "rgba(22, 163, 74, 0.12)",
  },
  pickerItemText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.text,
  },
  pickerItemTextActive: {
    color: Colors.primary,
  },
  pickerItemSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  deleteBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.danger,
  },
});
