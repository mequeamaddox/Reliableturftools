import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: stats, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ["/api/dashboard"],
  });

  function formatMoney(val: number) {
    return "$" + (val || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function quickAction(route: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(route as any);
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Reliable Turf Tools</Text>
          <Text style={styles.headerSub}>Dashboard</Text>
        </View>
        <Pressable onPress={() => { logout(); router.replace("/"); }}>
          <Ionicons name="log-out-outline" size={24} color={Colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={styles.quickActions}>
          <Pressable style={[styles.quickBtn, { backgroundColor: Colors.primary }]} onPress={() => quickAction("/inventory/new")}>
            <Ionicons name="add-circle" size={28} color="#fff" />
            <Text style={styles.quickBtnText}>Quick Add</Text>
          </Pressable>
          <Pressable style={[styles.quickBtn, { backgroundColor: Colors.info }]} onPress={() => quickAction("/inventory/scan")}>
            <Ionicons name="barcode" size={28} color="#fff" />
            <Text style={styles.quickBtnText}>Scan</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Revenue</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>7 Days</Text>
            <Text style={styles.statValue}>{formatMoney(stats?.revenue7d)}</Text>
            <Text style={[styles.statProfit, { color: Colors.success }]}>
              Profit: {formatMoney(stats?.profit7d)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>30 Days</Text>
            <Text style={styles.statValue}>{formatMoney(stats?.revenue30d)}</Text>
            <Text style={[styles.statProfit, { color: Colors.success }]}>
              Profit: {formatMoney(stats?.profit30d)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Inventory</Text>
        <View style={styles.inventoryGrid}>
          <View style={[styles.invCard, { borderLeftColor: Colors.available }]}>
            <Text style={styles.invCount}>{stats?.totalAvailable || 0}</Text>
            <Text style={styles.invLabel}>Available</Text>
          </View>
          <View style={[styles.invCard, { borderLeftColor: Colors.pending }]}>
            <Text style={styles.invCount}>{stats?.totalPending || 0}</Text>
            <Text style={styles.invLabel}>Pending</Text>
          </View>
          <View style={[styles.invCard, { borderLeftColor: Colors.sold }]}>
            <Text style={styles.invCount}>{stats?.totalSold || 0}</Text>
            <Text style={styles.invLabel}>Sold</Text>
          </View>
          <View style={[styles.invCard, { borderLeftColor: Colors.archived }]}>
            <Text style={styles.invCount}>{stats?.totalArchived || 0}</Text>
            <Text style={styles.invLabel}>Archived</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Alerts</Text>
        <View style={styles.alertsRow}>
          <Pressable style={styles.alertCard} onPress={() => router.push("/(tabs)/more")}>
            <View style={[styles.alertBadge, { backgroundColor: Colors.warning }]}>
              <Text style={styles.alertBadgeText}>{stats?.pendingInquiries || 0}</Text>
            </View>
            <Text style={styles.alertLabel}>Inquiries</Text>
          </Pressable>
          <Pressable style={styles.alertCard} onPress={() => router.push("/(tabs)/more")}>
            <View style={[styles.alertBadge, { backgroundColor: Colors.info }]}>
              <Text style={styles.alertBadgeText}>{stats?.pendingFollowUps || 0}</Text>
            </View>
            <Text style={styles.alertLabel}>Follow-ups</Text>
          </Pressable>
        </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 18,
    borderRadius: 16,
  },
  quickBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  statLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textMuted,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.text,
  },
  statProfit: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 4,
  },
  inventoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  invCard: {
    width: "47%",
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  invCount: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: Colors.text,
  },
  invLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  alertsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  alertCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  alertBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  alertBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  alertLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
});
