import React, { useState } from "react";
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
  Linking,
  Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getApiUrl, queryClient } from "@/lib/query-client";
import { fetch } from "expo/fetch";

function getConditionLabel(c: string) {
  switch (c) {
    case "NEW_BOXED": return "New in Box";
    case "USED_UNBOXED": return "Like New";
    case "USED": return "Used";
    case "DAMAGED": return "As-Is";
    default: return c;
  }
}

interface ShippingRate {
  service: string;
  carrier: string;
  price: number;
  delivery: string;
  mailClassKey: string;
}

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [showInquiry, setShowInquiry] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);
  const [inquiryName, setInquiryName] = useState("");
  const [inquiryPhone, setInquiryPhone] = useState("");
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [shipZip, setShipZip] = useState("");
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedRateIdx, setSelectedRateIdx] = useState<number | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [rateError, setRateError] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);

  const { data: listing, isLoading } = useQuery<any>({
    queryKey: ["store-listing", id],
    queryFn: async () => {
      const baseUrl = getApiUrl();
      const url = new URL(`/api/store/listings/${id}`, baseUrl);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const inquiryMutation = useMutation({
    mutationFn: async (data: any) => {
      const baseUrl = getApiUrl();
      const url = new URL("/api/inquiries", baseUrl);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowInquiry(false);
      setInquirySent(true);
      setInquiryName("");
      setInquiryPhone("");
      setInquiryMessage("");
    },
  });

  function handleSubmitInquiry() {
    if (!inquiryName.trim() || !inquiryPhone.trim()) {
      Alert.alert("Required", "Please enter your name and phone number");
      return;
    }
    inquiryMutation.mutate({
      listingId: id,
      name: inquiryName.trim(),
      phone: inquiryPhone.trim(),
      message: inquiryMessage.trim() || undefined,
    });
  }

  const hasShipping = listing && listing.weightLbs && parseFloat(listing.weightLbs) > 0;

  async function fetchShippingRates() {
    if (!/^\d{5}$/.test(shipZip.trim())) {
      Alert.alert("Invalid ZIP", "Please enter a valid 5-digit ZIP code");
      return;
    }
    setLoadingRates(true);
    setRateError("");
    setShippingRates([]);
    setSelectedRateIdx(null);
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/shipping-rates", baseUrl);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationZip: shipZip.trim(),
          weightLbs: listing.weightLbs,
          boxLengthIn: listing.boxLengthIn || "12",
          boxWidthIn: listing.boxWidthIn || "10",
        }),
      });
      const data = await res.json();
      if (data.error) {
        setRateError(data.error);
      } else if (Array.isArray(data) && data.length > 0) {
        setShippingRates(data);
      } else {
        setRateError("No shipping options available for that ZIP code.");
      }
    } catch {
      setRateError("Failed to calculate shipping. Please try again.");
    } finally {
      setLoadingRates(false);
    }
  }

  async function handleCheckout() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCheckingOut(true);
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/checkout", baseUrl);
      const body: any = { listingId: id };
      if (selectedRateIdx !== null) {
        body.shippingRate = shippingRates[selectedRateIdx];
      }
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        Alert.alert("Checkout Error", data.error);
      } else if (data.checkoutUrl) {
        Linking.openURL(data.checkoutUrl);
      }
    } catch {
      Alert.alert("Error", "Something went wrong creating checkout. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.4)" }}>Item not found</Text>
      </View>
    );
  }

  const itemPrice = parseFloat(listing.price);
  const selectedRate = selectedRateIdx !== null ? shippingRates[selectedRateIdx] : null;
  const totalWithShipping = selectedRate ? itemPrice + selectedRate.price : itemPrice;
  const photoUrl = listing.photos && listing.photos.length > 0
    ? `${getApiUrl()}${listing.photos[0]}`
    : "";

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.5)" />
          <Text style={styles.backText}>Back to Store</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/store")} style={styles.headerBrand}>
          <Image
            source={{ uri: `${getApiUrl()}/public/logo.png` }}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerBrandText}>Reliable Turf Tools</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 120 }}>
        {photoUrl ? (
          <View style={styles.imageWrap}>
            <Image source={{ uri: photoUrl }} style={styles.mainImage} resizeMode="contain" />
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={64} color="rgba(255,255,255,0.15)" />
          </View>
        )}

        {listing.photos && listing.photos.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
            {listing.photos.map((photo: string, i: number) => (
              <Image
                key={i}
                source={{ uri: `${getApiUrl()}${photo}` }}
                style={[styles.thumb, i === 0 && styles.thumbActive]}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.categoryLabel}>
            {(listing.category || "").replace(/_/g, " ")}
          </Text>
          <Text style={styles.title}>{listing.title}</Text>
          {listing.brand && <Text style={styles.brand}>{listing.brand}</Text>}
          <Text style={styles.price}>${itemPrice.toFixed(2)}</Text>

          <View style={styles.detailTable}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Condition</Text>
              <Text style={styles.detailValue}>{getConditionLabel(listing.condition)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Category</Text>
              <Text style={styles.detailValue}>{(listing.category || "").replace(/_/g, " ")}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Power Type</Text>
              <Text style={styles.detailValue}>{(listing.powerType || "").replace("_", " ")}</Text>
            </View>
            {listing.brand && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Brand</Text>
                <Text style={styles.detailValue}>{listing.brand}</Text>
              </View>
            )}
            {listing.sku && (
              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.detailLabel}>SKU</Text>
                <Text style={styles.detailValue}>{listing.sku}</Text>
              </View>
            )}
          </View>

          {listing.notes && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Details</Text>
              <Text style={styles.notesText}>{listing.notes}</Text>
            </View>
          )}

          <Text style={styles.qtyText}>
            {listing.quantity > 1 ? `${listing.quantity} available` : "Only 1 available"}
          </Text>

          {hasShipping ? (
            <View style={styles.shippingSection}>
              <View style={styles.shippingSectionHeader}>
                <Ionicons name="cube-outline" size={20} color="#60a5fa" />
                <Text style={styles.shippingSectionTitle}>Ships Nationwide</Text>
              </View>
              <Text style={styles.shippingSectionDesc}>
                Enter your ZIP code to see shipping options and costs.
              </Text>
              <View style={styles.zipRow}>
                <TextInput
                  style={styles.zipInput}
                  value={shipZip}
                  onChangeText={setShipZip}
                  placeholder="ZIP code"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="number-pad"
                  maxLength={5}
                  returnKeyType="go"
                  onSubmitEditing={fetchShippingRates}
                />
                <Pressable
                  style={[styles.calcBtn, loadingRates && { opacity: 0.6 }]}
                  onPress={fetchShippingRates}
                  disabled={loadingRates}
                >
                  {loadingRates ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.calcBtnText}>Get Rates</Text>
                  )}
                </Pressable>
              </View>

              {rateError ? (
                <View style={styles.rateErrorBox}>
                  <Text style={styles.rateErrorText}>{rateError}</Text>
                </View>
              ) : null}

              {shippingRates.map((rate, i) => (
                <Pressable
                  key={i}
                  style={[styles.rateOption, selectedRateIdx === i && styles.rateOptionSelected]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedRateIdx(i);
                  }}
                >
                  <View style={[styles.rateRadio, selectedRateIdx === i && styles.rateRadioSelected]}>
                    {selectedRateIdx === i && <View style={styles.rateRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rateService}>{rate.carrier} {rate.service}</Text>
                    <Text style={styles.rateDelivery}>{rate.delivery}</Text>
                    {i === 0 && shippingRates.length > 1 && (
                      <View style={styles.rateBadge}>
                        <Text style={styles.rateBadgeText}>BEST VALUE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.ratePrice}>${rate.price.toFixed(2)}</Text>
                </Pressable>
              ))}

              {selectedRate && (
                <View style={styles.orderSummary}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Item</Text>
                    <Text style={styles.summaryValue}>${itemPrice.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Shipping ({selectedRate.service})</Text>
                    <Text style={styles.summaryValue}>${selectedRate.price.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.summaryRow, styles.summaryTotal]}>
                    <Text style={styles.summaryTotalLabel}>Total</Text>
                    <Text style={styles.summaryTotalValue}>${totalWithShipping.toFixed(2)}</Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.meetupBox}>
              <Ionicons name="location" size={20} color="#4ade80" />
              <View style={{ flex: 1 }}>
                <Text style={styles.meetupTitle}>Local Pickup Only</Text>
                <Text style={styles.meetupDesc}>
                  Available for meetup at safe, public locations in the Columbia, SC area.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {hasShipping ? (
        <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
          <Pressable
            style={[styles.buyBtn, (!selectedRate || checkingOut) && { opacity: 0.5 }]}
            onPress={handleCheckout}
            disabled={!selectedRate || checkingOut}
          >
            {checkingOut ? (
              <ActivityIndicator size="small" color="#000" />
            ) : selectedRate ? (
              <>
                <Ionicons name="card" size={20} color="#000" />
                <Text style={styles.buyBtnText}>Buy Now — ${totalWithShipping.toFixed(2)}</Text>
              </>
            ) : (
              <>
                <Ionicons name="card" size={20} color="#000" />
                <Text style={styles.buyBtnText}>Select a shipping option above</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.secureNote}>Secure checkout via Square</Text>
        </View>
      ) : inquirySent ? (
        <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={32} color="#4ade80" />
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>Message Sent!</Text>
              <Text style={styles.successDesc}>We'll get back to you shortly — usually within a few hours.</Text>
            </View>
          </View>
          <Pressable style={styles.successDismiss} onPress={() => setInquirySent(false)}>
            <Text style={styles.successDismissText}>Send Another Message</Text>
          </Pressable>
        </View>
      ) : !showInquiry ? (
        <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
          <Pressable
            style={styles.interestedBtn}
            onPress={() => setShowInquiry(true)}
          >
            <Ionicons name="chatbubble" size={20} color="#000" />
            <Text style={styles.interestedBtnText}>I'm Interested</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.bottomBar, styles.inquiryForm, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
          <Text style={styles.inquiryTitle}>Send a Message</Text>
          <TextInput
            style={styles.inquiryInput}
            value={inquiryName}
            onChangeText={setInquiryName}
            placeholder="Your Name *"
            placeholderTextColor="rgba(255,255,255,0.25)"
          />
          <TextInput
            style={styles.inquiryInput}
            value={inquiryPhone}
            onChangeText={setInquiryPhone}
            placeholder="Your Phone *"
            placeholderTextColor="rgba(255,255,255,0.25)"
            keyboardType="phone-pad"
          />
          <TextInput
            style={[styles.inquiryInput, { minHeight: 60, textAlignVertical: "top" as const }]}
            value={inquiryMessage}
            onChangeText={setInquiryMessage}
            placeholder="Message (optional)"
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
          />
          <View style={styles.inquiryActions}>
            <Pressable style={styles.cancelBtn} onPress={() => setShowInquiry(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.submitBtn, inquiryMutation.isPending && { opacity: 0.5 }]}
              onPress={handleSubmitInquiry}
              disabled={inquiryMutation.isPending}
            >
              {inquiryMutation.isPending ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.submitBtnText}>Send</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  backText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLogo: {
    width: 30,
    height: 30,
    borderRadius: 6,
  },
  headerBrandText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#fff",
    letterSpacing: -0.3,
  },
  imageWrap: {
    width: "100%",
    height: 300,
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  mainImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1a1a1a",
  },
  imagePlaceholder: {
    height: 260,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  thumbRow: {
    marginTop: 10,
    marginBottom: 4,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.08)",
    opacity: 0.6,
  },
  thumbActive: {
    borderColor: "#22c55e",
    opacity: 1,
  },
  infoSection: {
    padding: 20,
    gap: 8,
  },
  categoryLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: "#22c55e",
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: "#fff",
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  brand: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: "rgba(255,255,255,0.45)",
  },
  price: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    color: "#4ade80",
    marginTop: 4,
    letterSpacing: -1,
  },
  detailTable: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  detailRow: {
    flexDirection: "row",
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  detailLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    width: 100,
  },
  detailValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
    flex: 1,
  },
  notesBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    padding: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  notesLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
    marginBottom: 6,
  },
  notesText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 22,
  },
  qtyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    marginTop: 4,
  },
  shippingSection: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  shippingSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  shippingSectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: "#fff",
  },
  shippingSectionDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 12,
  },
  zipRow: {
    flexDirection: "row",
    gap: 10,
  },
  zipInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#fff",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  calcBtn: {
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  calcBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#000",
  },
  rateErrorBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.15)",
  },
  rateErrorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#f87171",
  },
  rateOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  rateOptionSelected: {
    borderColor: "#22c55e",
    backgroundColor: "rgba(34,197,94,0.08)",
  },
  rateRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rateRadioSelected: {
    borderColor: "#22c55e",
  },
  rateRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22c55e",
  },
  rateService: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
  rateDelivery: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginTop: 2,
  },
  rateBadge: {
    backgroundColor: "rgba(34,197,94,0.15)",
    alignSelf: "flex-start" as const,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  rateBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: "#4ade80",
    letterSpacing: 0.5,
  },
  ratePrice: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#4ade80",
    marginLeft: 10,
  },
  orderSummary: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  summaryLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
  summaryValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 10,
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  summaryTotalValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  meetupBox: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "rgba(34,197,94,0.06)",
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.12)",
  },
  meetupTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#4ade80",
  },
  meetupDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 18,
    marginTop: 2,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(17,17,17,0.95)",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  buyBtn: {
    backgroundColor: "#22c55e",
    borderRadius: 14,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  buyBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#000",
  },
  secureNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center" as const,
    marginTop: 8,
  },
  interestedBtn: {
    backgroundColor: "#22c55e",
    borderRadius: 14,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  interestedBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#000",
  },
  inquiryForm: {
    gap: 10,
  },
  inquiryTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#fff",
  },
  inquiryInput: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#fff",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  inquiryActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cancelBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "rgba(255,255,255,0.5)",
  },
  submitBtn: {
    flex: 2,
    backgroundColor: "#22c55e",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  submitBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#000",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(34,197,94,0.08)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.15)",
  },
  successTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: "#4ade80",
  },
  successDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 18,
    marginTop: 2,
  },
  successDismiss: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 4,
  },
  successDismissText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
  },
});
