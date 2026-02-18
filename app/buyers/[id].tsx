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
  Linking,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";

const ALL_TAGS = ["REPEAT_BUYER", "GOOD_BUYER", "FLAKE_RISK"] as const;
const TAG_COLORS: Record<string, string> = {
  REPEAT_BUYER: Colors.info,
  GOOD_BUYER: Colors.success,
  FLAKE_RISK: Colors.warning,
};

export default function BuyerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: buyer, isLoading } = useQuery<any>({
    queryKey: [`/api/buyers/${id}`],
  });
  const { data: listings = [] } = useQuery<any[]>({ queryKey: ["/api/listings"] });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [preferredSpot, setPreferredSpot] = useState("");

  useEffect(() => {
    if (buyer) {
      setName(buyer.name || "");
      setPhone(buyer.phone || "");
      setNotes(buyer.notes || "");
      setTags(buyer.tags || []);
      setPreferredSpot(buyer.preferredMeetupSpot || "");
    }
  }, [buyer]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/buyers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/buyers/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/buyers"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
  });

  function toggleTag(tag: string) {
    Haptics.selectionAsync();
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function handleSave() {
    updateMutation.mutate({
      name: name.trim() || null,
      phone: phone.trim(),
      notes: notes.trim() || null,
      tags,
      preferredMeetupSpot: preferredSpot || null,
    });
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Buyer Profile</Text>
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
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{buyer?.totalPurchases || 0}</Text>
            <Text style={styles.statLabel}>Purchases</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.primary }]}>
              ${(buyer?.totalSpend || 0).toFixed(0)}
            </Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
        </View>

        {phone.trim() && (
          <View style={styles.contactRow}>
            <Pressable
              style={styles.contactBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const cleanPhone = phone.replace(/[^0-9+]/g, "");
                const greeting = encodeURIComponent(`Hey ${name || "there"}! `);
                const sep = Platform.OS === "ios" ? "&" : "?";
                Linking.openURL(`sms:${cleanPhone}${sep}body=${greeting}`);
              }}
            >
              <Ionicons name="chatbubble" size={18} color="#fff" />
              <Text style={styles.contactBtnText}>Text</Text>
            </Pressable>
            <Pressable
              style={[styles.contactBtn, { backgroundColor: Colors.info }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const cleanPhone = phone.replace(/[^0-9+]/g, "");
                Linking.openURL(`tel:${cleanPhone}`);
              }}
            >
              <Ionicons name="call" size={18} color="#fff" />
              <Text style={styles.contactBtnText}>Call</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Buyer name" placeholderTextColor={Colors.textMuted} />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone number" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Tags</Text>
          <View style={styles.chipRow}>
            {ALL_TAGS.map((tag) => (
              <Pressable
                key={tag}
                style={[
                  styles.tagChip,
                  tags.includes(tag) && { backgroundColor: TAG_COLORS[tag] + "33", borderColor: TAG_COLORS[tag] },
                ]}
                onPress={() => toggleTag(tag)}
              >
                <Text
                  style={[
                    styles.tagChipText,
                    tags.includes(tag) && { color: TAG_COLORS[tag] },
                  ]}
                >
                  {tag.replace(/_/g, " ")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Preferred Meetup Spot</Text>
          <TextInput style={styles.input} value={preferredSpot} onChangeText={setPreferredSpot} placeholder="e.g. Walmart Parking" placeholderTextColor={Colors.textMuted} />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Notes</Text>
          <TextInput style={[styles.input, styles.textarea]} value={notes} onChangeText={setNotes} placeholder="Notes about this buyer..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
        </View>

        {buyer?.sales && buyer.sales.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Purchase History</Text>
            {buyer.sales.map((sale: any) => {
              const listing = listings.find((l: any) => l.id === sale.listingId);
              return (
                <View key={sale.id} style={styles.historyCard}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyTitle}>{listing?.title || "Unknown"}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(sale.soldAt).toLocaleDateString()} | {sale.paymentType}
                    </Text>
                  </View>
                  <Text style={styles.historyPrice}>${parseFloat(sale.salePrice).toFixed(0)}</Text>
                </View>
              );
            })}
          </>
        )}

        {buyer?.followUps && buyer.followUps.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Follow-ups</Text>
            {buyer.followUps.map((fu: any) => (
              <View key={fu.id} style={[styles.historyCard, fu.isCompleted && { opacity: 0.5 }]}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyTitle}>{fu.type.replace("_", " ")}</Text>
                  {fu.message && <Text style={styles.historyDate} numberOfLines={2}>{fu.message}</Text>}
                </View>
                {fu.isCompleted ? (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                ) : (
                  <Ionicons name="time" size={20} color={Colors.pending} />
                )}
              </View>
            ))}
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
  contactRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  contactBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
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
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  historyCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  historyLeft: {
    flex: 1,
  },
  historyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  historyDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyPrice: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.primary,
  },
});
