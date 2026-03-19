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
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { apiRequest, queryClient, getApiUrl } from "@/lib/query-client";

const FALLBACK_CONDITIONS = ["NEW_BOXED", "USED_UNBOXED", "USED", "DAMAGED"];
const FALLBACK_POWER_TYPES = ["GAS", "ELECTRIC_18V", "ELECTRIC_40V", "OTHER"];
const FALLBACK_CATEGORIES = ["TRIMMER", "BLOWER", "MOWER", "CHAINSAW", "BATTERY", "CHARGER", "OTHER"];
const FALLBACK_PAYMENT_TYPES = ["CASH", "CASH_APP", "ZELLE", "VENMO", "APPLE_PAY", "TAP_CARD", "SQUARE", "OTHER"];
const FALLBACK_LEAD_SOURCES = ["OFFERUP", "FACEBOOK", "WORD_OF_MOUTH", "RANDOM_MEETUP", "CRAIGSLIST", "OTHER"];

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
  const { data: inventoryOptions } = useQuery<{
    conditions: string[];
    powerTypes: string[];
    categories: string[];
    paymentTypes: string[];
    leadSources: string[];
  }>({ queryKey: ["/api/inventory-options"] });

  const CONDITIONS = inventoryOptions?.conditions ?? FALLBACK_CONDITIONS;
  const POWER_TYPES = inventoryOptions?.powerTypes ?? FALLBACK_POWER_TYPES;
  const CATEGORIES = inventoryOptions?.categories ?? FALLBACK_CATEGORIES;
  const PAY_TYPES = inventoryOptions?.paymentTypes ?? FALLBACK_PAYMENT_TYPES;
  const LEAD_SOURCES = inventoryOptions?.leadSources ?? FALLBACK_LEAD_SOURCES;

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
  const [description, setDescription] = useState("");
  const [palletName, setPalletName] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [boxLengthIn, setBoxLengthIn] = useState("");
  const [boxWidthIn, setBoxWidthIn] = useState("");
  const [boxHeightIn, setBoxHeightIn] = useState("");
  const [showSellModal, setShowSellModal] = useState(false);
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [paymentType, setPaymentType] = useState("CASH");
  const [leadSource, setLeadSource] = useState("");
  const [meetupSpot, setMeetupSpot] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

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
      setDescription(listing.description || "");
      setPalletName(listing.palletName || "");
      setWeightLbs(listing.weightLbs || "");
      setBoxLengthIn(listing.boxLengthIn || "");
      setBoxWidthIn(listing.boxWidthIn || "");
      setBoxHeightIn(listing.boxHeightIn || "");
      setSalePrice(listing.price || "");
      setPhotos(listing.photos || []);
    }
  }, [listing]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/listings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/listings") });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
  });

  const sellMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/listings/${id}/sell`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/listings") });
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
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/listings") });
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
      description: description || null,
      palletName: palletName || null,
      weightLbs: weightLbs || null,
      boxLengthIn: boxLengthIn || null,
      boxWidthIn: boxWidthIn || null,
      boxHeightIn: boxHeightIn || null,
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
      leadSource: leadSource || undefined,
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
      description: description || undefined,
      listingType: listing?.listingType || "ITEM",
    }).then(() => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/listings") });
      Alert.alert("Duplicated", "Listing has been duplicated");
    });
  }

  function handleDelete() {
    Alert.alert("Delete Listing", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate() },
    ]);
  }

  async function handlePickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        quality: 0.7,
        mediaTypes: ["images"],
      });
      if (result.canceled || !result.assets?.length) return;

      setUploading(true);
      const formData = new FormData();
      for (const asset of result.assets) {
        const file = new File(asset.uri);
        formData.append("photos", file);
      }

      const baseUrl = getApiUrl();
      const uploadUrl = new URL("/api/upload", baseUrl).toString();
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const newUrls: string[] = data.urls || [];

      const updatedPhotos = [...photos, ...newUrls];
      await apiRequest("PUT", `/api/listings/${id}`, { photos: updatedPhotos });
      setPhotos(updatedPhotos);
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/listings") });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert("Error", "Failed to upload photos");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto(photoUrl: string) {
    const updatedPhotos = photos.filter((p) => p !== photoUrl);
    setPhotos(updatedPhotos);
    try {
      await apiRequest("PUT", `/api/listings/${id}`, { photos: updatedPhotos });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/listings") });
    } catch (err) {
      Alert.alert("Error", "Failed to remove photo");
      setPhotos(photos);
    }
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
          {listing?.listingType === "PART" && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>PART</Text>
            </View>
          )}
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
              <Pressable
                style={[styles.actionBtn, { backgroundColor: "rgba(168, 85, 247, 0.9)" }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/inventory/label?id=${id}` as any);
                }}
              >
                <Ionicons name="pricetag" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Label</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: "rgba(234, 88, 12, 0.9)" }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  Alert.alert(
                    "Part Out This Item?",
                    "This item will be archived and you'll be taken to a part-entry screen to list its individual parts.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Part Out",
                        style: "destructive",
                        onPress: () => {
                          updateMutation.mutate({ status: "ARCHIVED", isPublished: false });
                          router.push({
                            pathname: "/inventory/new" as any,
                            params: {
                              partFromTitle: listing?.title || "",
                              partFromBrand: listing?.brand || "",
                              partFromPallet: listing?.palletName || "",
                            },
                          });
                        },
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="cut" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Part Out</Text>
              </Pressable>
            </View>

            <View style={styles.photoSection}>
              <View style={styles.photoHeader}>
                <Ionicons name="camera-outline" size={18} color={Colors.info} />
                <Text style={styles.photoHeaderText}>Photos</Text>
                {photos.length > 0 && (
                  <Text style={styles.photoCount}>{photos.length}</Text>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoScroll}>
                {photos.map((photoUrl, index) => {
                  const fullUrl = photoUrl.startsWith("http") ? photoUrl : `${getApiUrl()}${photoUrl}`;
                  return (
                    <View key={`${photoUrl}-${index}`} style={styles.photoThumbContainer}>
                      <Image source={{ uri: fullUrl }} style={styles.photoThumb} />
                      <Pressable
                        style={styles.photoRemoveBtn}
                        onPress={() => handleRemovePhoto(photoUrl)}
                      >
                        <Ionicons name="close-circle" size={22} color={Colors.danger} />
                      </Pressable>
                    </View>
                  );
                })}
                <Pressable style={styles.addPhotoBtn} onPress={handlePickPhoto} disabled={uploading}>
                  {uploading ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="add" size={28} color={Colors.primary} />
                      <Text style={styles.addPhotoText}>Add</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
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
                {listing?.palletCost && !cost && (
                  <Text style={styles.palletCostHint}>Pallet total: ${parseFloat(listing.palletCost).toFixed(0)}</Text>
                )}
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} value={listing?.sku || ""} editable={false} placeholderTextColor={Colors.textMuted} placeholder="No SKU yet" />
                <Pressable
                  style={styles.generateSkuBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    apiRequest("POST", "/api/generate-sku", { category: category || "OTHER" })
                      .then((res: any) => res.json())
                      .then((data: any) => {
                        if (data.sku) {
                          apiRequest("PUT", `/api/listings/${id}`, { sku: data.sku }).then(() => {
                            queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/listings") });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          });
                        }
                      })
                      .catch(() => Alert.alert("Error", "Failed to generate SKU"));
                  }}
                >
                  <Ionicons name="barcode-outline" size={18} color="#fff" />
                  <Text style={styles.generateSkuText}>Generate</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Public Description <Text style={styles.labelHint}>(shows on website)</Text></Text>
              <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} multiline numberOfLines={3} placeholderTextColor={Colors.textMuted} placeholder="Describe the item for customers..." />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Internal Notes <Text style={styles.labelHint}>(admin only)</Text></Text>
              <TextInput style={[styles.input, styles.textarea]} value={notes} onChangeText={setNotes} multiline numberOfLines={3} placeholderTextColor={Colors.textMuted} placeholder="Missing battery, damage, etc..." />
            </View>

            <View style={styles.sectionHeader}>
              <Ionicons name="cube-outline" size={18} color={Colors.info} />
              <Text style={styles.sectionHeaderText}>Sourcing</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Pallet / Source</Text>
              <TextInput
                style={styles.input}
                value={palletName}
                onChangeText={setPalletName}
                placeholder="e.g. Pallet #3, HD Jan"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

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

            <ChipSelect options={PAY_TYPES} value={paymentType} onChange={setPaymentType} label="Payment Type" />

            <ChipSelect options={LEAD_SOURCES} value={leadSource} onChange={setLeadSource} label="Where'd They Find You?" />

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
  typeBadge: {
    backgroundColor: Colors.info,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  typeBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: "#fff",
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
  labelHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  palletCostHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
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
  generateSkuBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.info,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  generateSkuText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#fff",
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
  photoSection: {
    marginBottom: 20,
  },
  photoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  photoHeaderText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.text,
  },
  photoCount: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.textMuted,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  photoScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  photoThumbContainer: {
    position: "relative",
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  photoRemoveBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: Colors.background,
    borderRadius: 11,
  },
  addPhotoBtn: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.cardBg,
  },
  addPhotoText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.primary,
    marginTop: 2,
  },
});
