import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { queryClient } from "@/lib/query-client";

type TabType = "followups" | "inquiries" | "settings";

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [activeTab, setActiveTab] = useState<TabType>("followups");

  const { data: followUps = [], isLoading: fuLoading, refetch: refetchFu, isRefetching: fuRefreshing } = useQuery<any[]>({
    queryKey: ["/api/followups"],
  });
  const { data: inquiries = [], isLoading: inqLoading, refetch: refetchInq } = useQuery<any[]>({
    queryKey: ["/api/inquiries"],
  });
  const { data: buyers = [] } = useQuery<any[]>({ queryKey: ["/api/buyers"] });
  const { data: meetupSpots = [] } = useQuery<any[]>({ queryKey: ["/api/meetup-spots"] });
  const { data: templates = [] } = useQuery<any[]>({ queryKey: ["/api/message-templates"] });

  const completeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/followups/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/followups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const readInquiryMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/inquiries/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  function copyMessage(msg: string) {
    Clipboard.setStringAsync(msg);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied!", "Message copied to clipboard");
  }

  const isLoading = fuLoading || inqLoading;
  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: "followups", label: "Follow-ups", count: followUps.filter((f: any) => !f.isCompleted).length },
    { key: "inquiries", label: "Inquiries", count: inquiries.filter((i: any) => !i.isRead).length },
    { key: "settings", label: "Settings" },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <Text style={styles.headerTitle}>More</Text>

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {!!tab.count && tab.count > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.count}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
          refreshControl={<RefreshControl refreshing={fuRefreshing} onRefresh={() => { refetchFu(); refetchInq(); }} tintColor={Colors.primary} />}
        >
          {activeTab === "followups" && (
            <>
              {followUps.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="checkmark-circle-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No follow-ups</Text>
                </View>
              ) : (
                followUps.map((fu: any) => {
                  const buyer = buyers.find((b: any) => b.id === fu.buyerId);
                  return (
                    <View key={fu.id} style={[styles.fuCard, fu.isCompleted && styles.fuCompleted]}>
                      <View style={styles.fuHeader}>
                        <View style={styles.fuTypeChip}>
                          <Text style={styles.fuTypeText}>{fu.type.replace("_", " ")}</Text>
                        </View>
                        {!fu.isCompleted && (
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              completeMutation.mutate(fu.id);
                            }}
                          >
                            <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
                          </Pressable>
                        )}
                      </View>
                      <Text style={styles.fuBuyer}>{buyer?.name || buyer?.phone || "Unknown"}</Text>
                      {fu.message && <Text style={styles.fuMessage}>{fu.message}</Text>}
                      {fu.message && !fu.isCompleted && (
                        <Pressable style={styles.copyBtn} onPress={() => copyMessage(fu.message)}>
                          <Ionicons name="copy-outline" size={16} color={Colors.primary} />
                          <Text style={styles.copyBtnText}>Copy Message</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}

          {activeTab === "inquiries" && (
            <>
              {inquiries.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="mail-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No inquiries yet</Text>
                </View>
              ) : (
                inquiries.map((inq: any) => (
                  <View key={inq.id} style={[styles.inqCard, inq.isRead && styles.inqRead]}>
                    <View style={styles.inqHeader}>
                      <View>
                        <Text style={styles.inqName}>{inq.name}</Text>
                        <Text style={styles.inqPhone}>{inq.phone}</Text>
                      </View>
                      {!inq.isRead && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            readInquiryMutation.mutate(inq.id);
                          }}
                          style={styles.markReadBtn}
                        >
                          <Text style={styles.markReadText}>Mark Read</Text>
                        </Pressable>
                      )}
                    </View>
                    {inq.message && <Text style={styles.inqMessage}>{inq.message}</Text>}
                    <Text style={styles.inqDate}>
                      {new Date(inq.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                ))
              )}
            </>
          )}

          {activeTab === "settings" && (
            <View style={styles.settingsContainer}>
              <Text style={styles.settingsSectionTitle}>Meetup Spots</Text>
              {meetupSpots.map((spot: any) => (
                <View key={spot.id} style={styles.settingsItem}>
                  <Ionicons name="location" size={18} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsItemText}>{spot.label}</Text>
                    {spot.address && <Text style={styles.settingsItemSub}>{spot.address}</Text>}
                  </View>
                </View>
              ))}

              <Text style={[styles.settingsSectionTitle, { marginTop: 24 }]}>Message Templates</Text>
              {templates.map((t: any) => (
                <View key={t.id} style={styles.settingsItem}>
                  <Ionicons name="chatbubble-outline" size={18} color={Colors.info} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsItemText}>{t.name}</Text>
                    <Text style={styles.settingsItemSub} numberOfLines={2}>{t.template}</Text>
                  </View>
                  <Pressable onPress={() => copyMessage(t.template)}>
                    <Ionicons name="copy-outline" size={18} color={Colors.textMuted} />
                  </Pressable>
                </View>
              ))}

              <Pressable
                style={styles.storeBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push("/store" as any);
                }}
              >
                <Ionicons name="storefront" size={22} color="#fff" />
                <Text style={styles.storeBtnText}>View Storefront</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.text,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.cardBg,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: "#fff",
  },
  tabBadge: {
    backgroundColor: Colors.danger,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#fff",
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: Colors.textMuted,
  },
  fuCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  fuCompleted: {
    opacity: 0.5,
  },
  fuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  fuTypeChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  fuTypeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
  },
  fuBuyer: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
    marginBottom: 4,
  },
  fuMessage: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(22, 163, 74, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  copyBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.primary,
  },
  inqCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  inqRead: {
    borderLeftColor: Colors.textMuted,
    opacity: 0.6,
  },
  inqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  inqName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  inqPhone: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
  },
  markReadBtn: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markReadText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  inqMessage: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  inqDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  settingsContainer: {
    gap: 8,
  },
  settingsSectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
    marginBottom: 8,
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
  },
  settingsItemText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.text,
  },
  settingsItemSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  storeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.info,
    borderRadius: 14,
    padding: 18,
    marginTop: 24,
  },
  storeBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
  },
});
