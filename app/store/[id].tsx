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

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [showInquiry, setShowInquiry] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);
  const [inquiryName, setInquiryName] = useState("");
  const [inquiryPhone, setInquiryPhone] = useState("");
  const [inquiryMessage, setInquiryMessage] = useState("");

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

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </Pressable>
        <Text style={styles.headerTitle}>Item Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 100 }}>
        <View style={styles.imagePlaceholder}>
          <Ionicons name="image-outline" size={64} color="#94a3b8" />
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.title}>{listing.title}</Text>
          {listing.brand && <Text style={styles.brand}>{listing.brand}</Text>}
          <Text style={styles.price}>${parseFloat(listing.price).toFixed(2)}</Text>

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

          <View style={styles.meetupBox}>
            <Ionicons name="location" size={20} color="#16a34a" />
            <View style={{ flex: 1 }}>
              <Text style={styles.meetupTitle}>Meetup Only</Text>
              <Text style={styles.meetupDesc}>
                All sales take place at safe, public meetup locations.
                No shipping or delivery available.
              </Text>
            </View>
          </View>

          <Text style={styles.qtyText}>
            {listing.quantity > 1 ? `${listing.quantity} available` : "Only 1 available"}
          </Text>
        </View>
      </ScrollView>

      {inquirySent ? (
        <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={32} color="#16a34a" />
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>Inquiry Sent!</Text>
              <Text style={styles.successDesc}>We'll get back to you shortly — usually within a few hours.</Text>
            </View>
          </View>
          <Pressable style={styles.successDismiss} onPress={() => setInquirySent(false)}>
            <Text style={styles.successDismissText}>Send Another Inquiry</Text>
          </Pressable>
        </View>
      ) : !showInquiry ? (
        <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
          <Pressable
            style={styles.reserveBtn}
            onPress={() => setShowInquiry(true)}
          >
            <Ionicons name="chatbubble" size={20} color="#fff" />
            <Text style={styles.reserveBtnText}>Reserve / Ask About This</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.bottomBar, styles.inquiryForm, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
          <Text style={styles.inquiryTitle}>Send Inquiry</Text>
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
  qtyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
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
  reserveBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  reserveBtnText: {
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
