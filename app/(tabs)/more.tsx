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
  Linking,
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
import SwipeableRow from "@/components/SwipeableRow";

type TabType = "followups" | "inquiries" | "settings";
type FilterType = "pending" | "completed" | "overdue" | "all";

function FollowUpCard({
  fu,
  buyer,
  onComplete,
  onUncomplete,
  onEdit,
  onDelete,
  onCopy,
  onSendText,
}: {
  fu: any;
  buyer: any;
  onComplete: () => void;
  onUncomplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onSendText: () => void;
}) {
  const isOverdue =
    !fu.isCompleted &&
    fu.dueDate &&
    new Date(fu.dueDate) < new Date();
  const isDueToday =
    !fu.isCompleted &&
    fu.dueDate &&
    new Date(fu.dueDate).toDateString() === new Date().toDateString();

  return (
    <View
      style={[
        styles.fuCard,
        fu.isCompleted && styles.fuCompleted,
        isOverdue && styles.fuOverdue,
      ]}
    >
      <View style={styles.fuHeader}>
        <View style={styles.fuHeaderLeft}>
          <View
            style={[
              styles.fuTypeChip,
              isOverdue && { backgroundColor: "rgba(239, 68, 68, 0.15)" },
            ]}
          >
            <Text
              style={[
                styles.fuTypeText,
                isOverdue && { color: Colors.danger },
              ]}
            >
              {fu.type.replace("_", " ")}
            </Text>
          </View>
          {fu.dueDate && (
            <View
              style={[
                styles.dueDateChip,
                isOverdue && styles.dueDateOverdue,
                isDueToday && styles.dueDateToday,
              ]}
            >
              <Ionicons
                name="calendar"
                size={12}
                color={
                  isOverdue
                    ? Colors.danger
                    : isDueToday
                      ? Colors.warning
                      : Colors.textMuted
                }
              />
              <Text
                style={[
                  styles.dueDateText,
                  isOverdue && { color: Colors.danger },
                  isDueToday && { color: Colors.warning },
                ]}
              >
                {isOverdue
                  ? "OVERDUE"
                  : isDueToday
                    ? "TODAY"
                    : new Date(fu.dueDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.fuActions}>
          <Pressable onPress={onEdit} hitSlop={8}>
            <Ionicons name="pencil" size={18} color={Colors.info} />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              fu.isCompleted ? onUncomplete() : onComplete();
            }}
            hitSlop={8}
          >
            <Ionicons
              name={fu.isCompleted ? "arrow-undo" : "checkmark-circle"}
              size={22}
              color={fu.isCompleted ? Colors.info : Colors.success}
            />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8}>
            <Ionicons name="trash" size={18} color={Colors.danger} />
          </Pressable>
        </View>
      </View>
      <Pressable
        onPress={() => {
          if (buyer?.id) router.push(`/buyers/${buyer.id}` as any);
        }}
      >
        <Text style={styles.fuBuyer}>
          {buyer?.name || buyer?.phone || "Unknown Buyer"}
        </Text>
      </Pressable>
      {fu.message && <Text style={styles.fuMessage}>{fu.message}</Text>}
      {fu.message && !fu.isCompleted && (
        <View style={styles.fuBtnRow}>
          {buyer?.phone && (
            <Pressable style={styles.sendBtn} onPress={onSendText}>
              <Ionicons name="chatbubble" size={14} color="#fff" />
              <Text style={styles.sendBtnText}>Send</Text>
            </Pressable>
          )}
          <Pressable style={styles.copyBtn} onPress={onCopy}>
            <Ionicons name="copy-outline" size={14} color={Colors.primary} />
            <Text style={styles.copyBtnText}>Copy</Text>
          </Pressable>
        </View>
      )}
      {fu.isCompleted && fu.completedAt && (
        <Text style={styles.completedAt}>
          Done{" "}
          {new Date(fu.completedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </Text>
      )}
    </View>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [activeTab, setActiveTab] = useState<TabType>("followups");
  const [fuFilter, setFuFilter] = useState<FilterType>("pending");
  const [showArchivedInq, setShowArchivedInq] = useState(false);

  const {
    data: allFollowUps = [],
    isLoading: fuLoading,
    refetch: refetchFu,
    isRefetching: fuRefreshing,
  } = useQuery<any[]>({
    queryKey: ["/api/followups?all=true"],
  });
  const {
    data: inquiries = [],
    isLoading: inqLoading,
    refetch: refetchInq,
  } = useQuery<any[]>({
    queryKey: ["/api/inquiries"],
  });
  const { data: buyers = [] } = useQuery<any[]>({
    queryKey: ["/api/buyers"],
  });
  const { data: meetupSpots = [] } = useQuery<any[]>({
    queryKey: ["/api/meetup-spots"],
  });
  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/message-templates"],
  });

  function invalidateFollowUps() {
    queryClient.invalidateQueries({ queryKey: ["/api/followups?all=true"] });
    queryClient.invalidateQueries({ queryKey: ["/api/followups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  }

  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PUT", `/api/followups/${id}/complete`),
    onSuccess: invalidateFollowUps,
  });

  const uncompleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PUT", `/api/followups/${id}/uncomplete`),
    onSuccess: invalidateFollowUps,
  });

  const deleteFuMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/followups/${id}`),
    onSuccess: invalidateFollowUps,
  });

  const readInquiryMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PUT", `/api/inquiries/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const unreadInquiryMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PUT", `/api/inquiries/${id}/unread`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const archiveInquiryMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PUT", `/api/inquiries/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const unarchiveInquiryMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PUT", `/api/inquiries/${id}/unarchive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const deleteInquiryMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/inquiries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  function confirmDeleteInquiry(id: string) {
    Alert.alert("Delete Inquiry", "Permanently delete this inquiry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteInquiryMutation.mutate(id),
      },
    ]);
  }

  function fillPlaceholders(text: string, buyerName?: string) {
    let filled = text;
    filled = filled.replace(/\{buyer_name\}/gi, buyerName || "there");
    filled = filled.replace(/\{listing_title\}/gi, "");
    filled = filled.replace(/\s{2,}/g, " ");
    return filled.trim();
  }

  function copyMessage(msg: string, buyerName?: string) {
    const finalMsg = fillPlaceholders(msg, buyerName);
    Clipboard.setStringAsync(finalMsg);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied!", "Message copied to clipboard");
  }

  function sendTextMessage(msg: string, buyerPhone: string, buyerName?: string) {
    const finalMsg = fillPlaceholders(msg, buyerName);
    const cleanPhone = buyerPhone.replace(/[^0-9+]/g, "");
    const body = encodeURIComponent(finalMsg);
    const sep = Platform.OS === "ios" ? "&" : "?";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`sms:${cleanPhone}${sep}body=${body}`);
  }

  function confirmDeleteFu(id: string) {
    Alert.alert("Delete Follow-Up", "Remove this follow-up?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteFuMutation.mutate(id),
      },
    ]);
  }

  const filteredFollowUps = allFollowUps.filter((fu: any) => {
    if (fuFilter === "pending") return !fu.isCompleted;
    if (fuFilter === "completed") return fu.isCompleted;
    if (fuFilter === "overdue")
      return (
        !fu.isCompleted && fu.dueDate && new Date(fu.dueDate) < new Date()
      );
    return true;
  });

  const pendingCount = allFollowUps.filter(
    (f: any) => !f.isCompleted
  ).length;
  const overdueCount = allFollowUps.filter(
    (f: any) =>
      !f.isCompleted && f.dueDate && new Date(f.dueDate) < new Date()
  ).length;

  const isLoading = fuLoading || inqLoading;
  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: "followups", label: "Follow-ups", count: pendingCount },
    {
      key: "inquiries",
      label: "Inquiries",
      count: inquiries.filter((i: any) => !i.isRead).length,
    },
    { key: "settings", label: "Settings" },
  ];

  const fuFilters: { key: FilterType; label: string; count?: number }[] = [
    { key: "pending", label: "Pending", count: pendingCount },
    { key: "overdue", label: "Overdue", count: overdueCount },
    { key: "completed", label: "Done" },
    { key: "all", label: "All" },
  ];

  function handleRefresh() {
    refetchFu();
    refetchInq();
  }

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + webTopInset }]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>More</Text>
        {activeTab === "followups" && (
          <Pressable
            style={styles.addFuBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/followups/new" as any);
            }}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        )}
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => {
              setActiveTab(tab.key);
              Haptics.selectionAsync();
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
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
        <ActivityIndicator
          size="large"
          color={Colors.primary}
          style={{ marginTop: 40 }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingBottom: 120,
            paddingHorizontal: 16,
          }}
          refreshControl={
            <RefreshControl
              refreshing={fuRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
        >
          {activeTab === "followups" && (
            <>
              <View style={styles.filterBar}>
                {fuFilters.map((f) => (
                  <Pressable
                    key={f.key}
                    style={[
                      styles.filterChip,
                      fuFilter === f.key && styles.filterChipActive,
                      f.key === "overdue" &&
                        overdueCount > 0 &&
                        fuFilter !== f.key && {
                          borderColor: Colors.danger,
                        },
                    ]}
                    onPress={() => {
                      setFuFilter(f.key);
                      Haptics.selectionAsync();
                    }}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        fuFilter === f.key && styles.filterTextActive,
                        f.key === "overdue" &&
                          overdueCount > 0 &&
                          fuFilter !== f.key && {
                            color: Colors.danger,
                          },
                      ]}
                    >
                      {f.label}
                    </Text>
                    {f.count !== undefined && f.count > 0 && (
                      <View
                        style={[
                          styles.filterBadge,
                          fuFilter === f.key && {
                            backgroundColor: "#fff",
                          },
                          f.key === "overdue" &&
                            fuFilter !== f.key && {
                              backgroundColor: Colors.danger,
                            },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterBadgeText,
                            fuFilter === f.key && {
                              color: Colors.primary,
                            },
                          ]}
                        >
                          {f.count}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>

              {filteredFollowUps.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={48}
                    color={Colors.textMuted}
                  />
                  <Text style={styles.emptyText}>
                    {fuFilter === "pending"
                      ? "No pending follow-ups"
                      : fuFilter === "overdue"
                        ? "No overdue follow-ups"
                        : fuFilter === "completed"
                          ? "No completed follow-ups"
                          : "No follow-ups yet"}
                  </Text>
                  {fuFilter === "pending" && (
                    <Pressable
                      style={styles.emptyAction}
                      onPress={() =>
                        router.push("/followups/new" as any)
                      }
                    >
                      <Ionicons
                        name="add-circle"
                        size={20}
                        color={Colors.primary}
                      />
                      <Text style={styles.emptyActionText}>
                        Create one
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                filteredFollowUps.map((fu: any) => {
                  const buyer = buyers.find(
                    (b: any) => b.id === fu.buyerId
                  );
                  return (
                    <SwipeableRow
                      key={fu.id}
                      leftAction={fu.isCompleted ? {
                        icon: "arrow-undo",
                        color: Colors.info,
                        label: "Undo",
                        onPress: () => uncompleteMutation.mutate(fu.id),
                      } : {
                        icon: "checkmark-circle",
                        color: Colors.success,
                        label: "Done",
                        onPress: () => completeMutation.mutate(fu.id),
                      }}
                      rightAction={{
                        icon: "trash",
                        color: Colors.danger,
                        label: "Delete",
                        onPress: () => confirmDeleteFu(fu.id),
                      }}
                    >
                      <FollowUpCard
                        fu={fu}
                        buyer={buyer}
                        onComplete={() => completeMutation.mutate(fu.id)}
                        onUncomplete={() =>
                          uncompleteMutation.mutate(fu.id)
                        }
                        onEdit={() =>
                          router.push(
                            `/followups/new?editId=${fu.id}` as any
                          )
                        }
                        onDelete={() => confirmDeleteFu(fu.id)}
                        onCopy={() => copyMessage(fu.message, buyer?.name)}
                        onSendText={() => sendTextMessage(fu.message, buyer?.phone, buyer?.name)}
                      />
                    </SwipeableRow>
                  );
                })
              )}
            </>
          )}

          {activeTab === "inquiries" && (
            <>
              <View style={styles.inqFilterRow}>
                <Pressable
                  style={[styles.inqFilterChip, !showArchivedInq && styles.inqFilterChipActive]}
                  onPress={() => { setShowArchivedInq(false); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.inqFilterText, !showArchivedInq && styles.inqFilterTextActive]}>
                    Active ({inquiries.filter((i: any) => !i.isArchived).length})
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.inqFilterChip, showArchivedInq && styles.inqFilterChipActive]}
                  onPress={() => { setShowArchivedInq(true); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.inqFilterText, showArchivedInq && styles.inqFilterTextActive]}>
                    Archived ({inquiries.filter((i: any) => i.isArchived).length})
                  </Text>
                </Pressable>
              </View>
              {(() => {
                const filtered = inquiries.filter((i: any) => showArchivedInq ? i.isArchived : !i.isArchived);
                if (filtered.length === 0) {
                  return (
                    <View style={styles.empty}>
                      <Ionicons
                        name={showArchivedInq ? "archive-outline" : "mail-outline"}
                        size={48}
                        color={Colors.textMuted}
                      />
                      <Text style={styles.emptyText}>
                        {showArchivedInq ? "No archived inquiries" : "No inquiries yet"}
                      </Text>
                    </View>
                  );
                }
                return filtered.map((inq: any) => (
                  <View
                    key={inq.id}
                    style={[
                      styles.inqCard,
                      inq.isRead && styles.inqRead,
                      inq.isArchived && styles.inqArchived,
                    ]}
                  >
                    <View style={styles.inqHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inqName}>
                          {!inq.isRead && !inq.isArchived && <View style={styles.unreadDot} />}
                          {inq.name}
                        </Text>
                        <Text style={styles.inqPhone}>{inq.phone}</Text>
                      </View>
                      <View style={styles.inqHeaderActions}>
                        {!inq.isArchived && (
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              if (inq.isRead) {
                                unreadInquiryMutation.mutate(inq.id);
                              } else {
                                readInquiryMutation.mutate(inq.id);
                              }
                            }}
                            style={[styles.markReadBtn, inq.isRead && styles.markUnreadBtn]}
                          >
                            <Ionicons
                              name={inq.isRead ? "mail-unread-outline" : "checkmark-circle-outline"}
                              size={14}
                              color={inq.isRead ? Colors.warning : Colors.primary}
                            />
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            if (inq.isArchived) {
                              unarchiveInquiryMutation.mutate(inq.id);
                            } else {
                              archiveInquiryMutation.mutate(inq.id);
                            }
                          }}
                          hitSlop={8}
                        >
                          <Ionicons
                            name={inq.isArchived ? "arrow-undo" : "archive"}
                            size={18}
                            color={inq.isArchived ? Colors.info : Colors.textMuted}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => confirmDeleteInquiry(inq.id)}
                          hitSlop={8}
                        >
                          <Ionicons name="trash" size={18} color={Colors.danger} />
                        </Pressable>
                      </View>
                    </View>
                    {inq.message && (
                      <Text style={styles.inqMessage}>{inq.message}</Text>
                    )}
                    <View style={styles.inqFooter}>
                      <Text style={styles.inqDate}>
                        {new Date(inq.createdAt).toLocaleDateString()}
                      </Text>
                      <View style={styles.inqActions}>
                        {inq.phone && !inq.isArchived && (
                          <>
                            <Pressable
                              style={styles.inqTextBtn}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                const phone = inq.phone.replace(/[^0-9+]/g, "");
                                const body = encodeURIComponent(
                                  `Hi ${inq.name || "there"}! Thanks for reaching out about your inquiry. `
                                );
                                const sep = Platform.OS === "ios" ? "&" : "?";
                                Linking.openURL(`sms:${phone}${sep}body=${body}`);
                                if (!inq.isRead) readInquiryMutation.mutate(inq.id);
                              }}
                            >
                              <Ionicons name="chatbubble" size={16} color="#fff" />
                              <Text style={styles.inqTextBtnLabel}>Text</Text>
                            </Pressable>
                            <Pressable
                              style={styles.inqCallBtn}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                const phone = inq.phone.replace(/[^0-9+]/g, "");
                                Linking.openURL(`tel:${phone}`);
                                if (!inq.isRead) readInquiryMutation.mutate(inq.id);
                              }}
                            >
                              <Ionicons name="call" size={16} color="#fff" />
                            </Pressable>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                ));
              })()}
            </>
          )}

          {activeTab === "settings" && (
            <View style={styles.settingsContainer}>
              <Pressable
                style={styles.settingsMenuBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/settings/inventory-options" as any);
                }}
              >
                <View style={[styles.settingsMenuIcon, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
                  <Ionicons name="options" size={22} color="#a855f7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsMenuTitle}>
                    Inventory Options
                  </Text>
                  <Text style={styles.settingsMenuSub}>
                    Condition, power type, category
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={Colors.textMuted}
                />
              </Pressable>

              <Pressable
                style={styles.settingsMenuBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/settings/meetup-spots" as any);
                }}
              >
                <View style={[styles.settingsMenuIcon, { backgroundColor: "rgba(22, 163, 74, 0.15)" }]}>
                  <Ionicons name="location" size={22} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsMenuTitle}>
                    Meetup Spots
                  </Text>
                  <Text style={styles.settingsMenuSub}>
                    {meetupSpots.length} spot{meetupSpots.length !== 1 ? "s" : ""} configured
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={Colors.textMuted}
                />
              </Pressable>

              <Pressable
                style={styles.settingsMenuBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/settings/templates" as any);
                }}
              >
                <View style={[styles.settingsMenuIcon, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
                  <Ionicons
                    name="chatbubbles"
                    size={22}
                    color={Colors.info}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsMenuTitle}>
                    Message Templates
                  </Text>
                  <Text style={styles.settingsMenuSub}>
                    {templates.length} template{templates.length !== 1 ? "s" : ""} saved
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={Colors.textMuted}
                />
              </Pressable>

              <Pressable
                style={styles.settingsMenuBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push("/store" as any);
                }}
              >
                <View style={[styles.settingsMenuIcon, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                  <Ionicons
                    name="storefront"
                    size={22}
                    color={Colors.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsMenuTitle}>
                    View Storefront
                  </Text>
                  <Text style={styles.settingsMenuSub}>
                    Public-facing store page
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={Colors.textMuted}
                />
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.text,
  },
  addFuBtn: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
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
  filterBar: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: "#fff",
  },
  filterBadge: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
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
  emptyAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    backgroundColor: "rgba(22, 163, 74, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyActionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.primary,
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
  fuOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  fuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  fuHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  fuActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  dueDateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.surface,
  },
  dueDateOverdue: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  dueDateToday: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  dueDateText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.textMuted,
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
  fuBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  sendBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#fff",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(22, 163, 74, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  copyBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.primary,
  },
  completedAt: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
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
  inqArchived: {
    borderLeftColor: Colors.border,
    opacity: 0.5,
  },
  inqFilterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  inqFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.cardBg,
  },
  inqFilterChipActive: {
    backgroundColor: Colors.primary,
  },
  inqFilterText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textMuted,
  },
  inqFilterTextActive: {
    color: "#fff",
  },
  inqHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(22, 163, 74, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markUnreadBtn: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  markReadText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.primary,
  },
  markUnreadText: {
    color: Colors.warning,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warning,
    marginRight: 6,
  },
  inqMessage: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  inqFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inqDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  inqActions: {
    flexDirection: "row",
    gap: 8,
  },
  inqTextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inqTextBtnLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#fff",
  },
  inqCallBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.info,
    borderRadius: 10,
    width: 36,
    height: 36,
  },
  settingsContainer: {
    gap: 10,
    paddingTop: 4,
  },
  settingsMenuBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 16,
  },
  settingsMenuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsMenuTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  settingsMenuSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
