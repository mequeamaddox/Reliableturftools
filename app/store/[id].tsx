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
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ fontFamily: "Inter_500Medium", color: "#64748b" }}>Item not found</Text>
      </View>
    );
  }

  const itemPrice = parseFloat(listing.price);
  const selectedRate = selectedRateIdx !== null ? shippingRates[selectedRateIdx] : null;
  const totalWithShipping = selectedRate ? itemPrice + selectedRate.price : itemPrice;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </Pressable>
        <Text style={styles.headerTitle}>Item Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 120 }}>
        <View style={styles.imagePlaceholder}>
          <Ionicons name="image-outline" size={64} color="#94a3b8" />
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.title}>{listing.title}</Text>
          {listing.brand && <Text style={styles.brand}>{listing.brand}</Text>}
          <Text style={styles.price}>${itemPrice.toFixed(2)}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getConditionLabel(listing.condition)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "#eff6ff" }]}>
              <Text style={[styles.badgeText, { color: "#3b82f6" }]}>{listing.powerType.replace("_", " ")}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "#fef3c7" }]}>
              <Text style={[styles.badgeText, { color: "#d97706" }]}>{listing.category}</Text>
            </View>
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
                <Ionicons name="cube-outline" size={20} color="#2563eb" />
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
                  placeholderTextColor="#94a3b8"
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
                    <ActivityIndicator size="small" color="#fff" />
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
              <Ionicons name="location" size={20} color="#15803d" />
              <View style={{ flex: 1 }}>
                <Text style={styles.meetupTitle}>Local Pickup Only</Text>
                <Text style={styles.meetupDesc}>
                  Available for meetup at safe, public locations in the Columbia, SC area. Tap below to let us know you're interested.
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
              <ActivityIndicator size="small" color="#fff" />
            ) : selectedRate ? (
              <>
                <Ionicons name="card" size={20} color="#fff" />
                <Text style={styles.buyBtnText}>Buy Now — ${totalWithShipping.toFixed(2)}</Text>
              </>
            ) : (
              <>
                <Ionicons name="card" size={20} color="#fff" />
                <Text style={styles.buyBtnText}>Select a shipping option above</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.secureNote}>Secure checkout via Square</Text>
        </View>
      ) : inquirySent ? (
        <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={32} color="#16a34a" />
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
            <Ionicons name="chatbubble" size={20} color="#fff" />
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
            placeholderTextColor="#94a3b8"
          />
          <TextInput
            style={styles.inquiryInput}
            value={inquiryPhone}
            onChangeText={setInquiryPhone}
            placeholder="Your Phone *"
            placeholderTextColor="#94a3b8"
            keyboardType="phone-pad"
          />
          <TextInput
            style={[styles.inquiryInput, { minHeight: 60, textAlignVertical: "top" as const }]}
            value={inquiryMessage}
            onChangeText={setInquiryMessage}
            placeholder="Message (optional)"
            placeholderTextColor="#94a3b8"
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
                <ActivityIndicator size="small" color="#fff" />
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
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#0f172a",
  },
  imagePlaceholder: {
    height: 240,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  infoSection: {
    padding: 20,
    gap: 8,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: "#0f172a",
  },
  brand: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: "#64748b",
  },
  price: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: "#16a34a",
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  badge: {
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#16a34a",
  },
  notesBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  notesLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#64748b",
    marginBottom: 4,
  },
  notesText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#334155",
    lineHeight: 20,
  },
  qtyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  shippingSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  shippingSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  shippingSectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#1d4ed8",
  },
  shippingSectionDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#64748b",
    marginBottom: 12,
  },
  zipRow: {
    flexDirection: "row",
    gap: 10,
  },
  zipInput: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#0f172a",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  calcBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  calcBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
  rateErrorBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  rateErrorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#dc2626",
  },
  rateOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    marginTop: 10,
  },
  rateOptionSelected: {
    borderColor: "#16a34a",
    backgroundColor: "#f0fdf4",
  },
  rateRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rateRadioSelected: {
    borderColor: "#16a34a",
  },
  rateRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#16a34a",
  },
  rateService: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#0f172a",
  },
  rateDelivery: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  rateBadge: {
    backgroundColor: "#f0fdf4",
    alignSelf: "flex-start" as const,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  rateBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: "#16a34a",
    letterSpacing: 0.5,
  },
  ratePrice: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#16a34a",
    marginLeft: 10,
  },
  orderSummary: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  summaryLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#64748b",
  },
  summaryValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#334155",
  },
  summaryTotal: {
    borderTopWidth: 2,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#0f172a",
  },
  summaryTotalValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#0f172a",
  },
  meetupBox: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  meetupTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#15803d",
  },
  meetupDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#166534",
    lineHeight: 18,
    marginTop: 2,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  buyBtn: {
    backgroundColor: "#16a34a",
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
    color: "#fff",
  },
  secureNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center" as const,
    marginTop: 8,
  },
  interestedBtn: {
    backgroundColor: "#16a34a",
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
    color: "#fff",
  },
  inquiryForm: {
    gap: 10,
  },
  inquiryTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#0f172a",
  },
  inquiryInput: {
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#0f172a",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  inquiryActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  cancelBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#64748b",
  },
  submitBtn: {
    flex: 2,
    backgroundColor: "#16a34a",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  submitBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#fff",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  successTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: "#15803d",
  },
  successDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#166534",
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
    color: "#64748b",
  },
});
