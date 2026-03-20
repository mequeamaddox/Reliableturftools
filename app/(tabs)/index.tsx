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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  function getWeeklyTrend() {
    const thisWeek = stats?.revenueThisWeek || 0;
    const lastWeek = stats?.revenueLastWeek || 0;
    if (lastWeek === 0) return thisWeek > 0 ? { pct: 100, dir: "up" as const } : { pct: 0, dir: "flat" as const };
    const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    return { pct: Math.abs(pct), dir: pct > 0 ? "up" as const : pct < 0 ? "down" as const : "flat" as const };
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const trend = getWeeklyTrend();
  const dailySales: { date: string; revenue: number; count: number }[] = stats?.dailySales || [];
  const maxDayRevenue = Math.max(...dailySales.map((d) => d.revenue), 1);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Reliable Turf Tools</Text>
          <Text style={styles.headerSub}>Dashboard</Text>
        </View>
        <Pressable onPress={() => logout()}>
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
            <Ionicons name="add-circle" size={26} color="#fff" />
            <Text style={styles.quickBtnText}>Add Item</Text>
          </Pressable>
          <Pressable style={[styles.quickBtn, { backgroundColor: Colors.info }]} onPress={() => quickAction("/inventory/scan")}>
            <Ionicons name="barcode" size={26} color="#fff" />
            <Text style={styles.quickBtnText}>Scan</Text>
          </Pressable>
          <Pressable style={[styles.quickBtn, { backgroundColor: "#d97706" }]} onPress={() => quickAction("/buyers/new")}>
            <Ionicons name="person-add" size={24} color="#fff" />
            <Text style={styles.quickBtnText}>Buyer</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Today</Text>
        <View style={styles.todayRow}>
          <Pressable style={styles.todayCard} onPress={() => quickAction("/(tabs)/sales")}>
            <View style={[styles.todayIcon, { backgroundColor: "rgba(34,197,94,0.15)" }]}>
              <Ionicons name="cash-outline" size={20} color={Colors.success} />
            </View>
            <Text style={styles.todayValue}>{formatMoney(stats?.revenueToday)}</Text>
            <Text style={styles.todayLabel}>Revenue</Text>
          </Pressable>
          <Pressable style={styles.todayCard} onPress={() => quickAction("/(tabs)/sales")}>
            <View style={[styles.todayIcon, { backgroundColor: "rgba(59,130,246,0.15)" }]}>
              <Ionicons name="cart-outline" size={20} color={Colors.info} />
            </View>
            <Text style={styles.todayValue}>{stats?.salesTodayCount || 0}</Text>
            <Text style={styles.todayLabel}>Sales</Text>
          </Pressable>
          <Pressable style={styles.todayCard} onPress={() => quickAction("/(tabs)/inventory")}>
            <View style={[styles.todayIcon, { backgroundColor: "rgba(168,85,247,0.15)" }]}>
              <Ionicons name="cube-outline" size={20} color="#a855f7" />
            </View>
            <Text style={styles.todayValue}>{stats?.itemsListedToday || 0}</Text>
            <Text style={styles.todayLabel}>Listed</Text>
          </Pressable>
          <Pressable style={styles.todayCard} onPress={() => quickAction("/(tabs)/more")}>
            <View style={[styles.todayIcon, { backgroundColor: "rgba(245,158,11,0.15)" }]}>
              <Ionicons name="chatbubble-outline" size={20} color={Colors.warning} />
            </View>
            <Text style={styles.todayValue}>{stats?.inquiriesToday || 0}</Text>
            <Text style={styles.todayLabel}>Inquiries</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>This Week</Text>
        <Pressable style={styles.weekCard} onPress={() => quickAction("/(tabs)/sales")}>
          <View style={styles.weekTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.weekRevenue}>{formatMoney(stats?.revenueThisWeek)}</Text>
              <Text style={styles.weekSalesCount}>{stats?.salesThisWeekCount || 0} sales</Text>
            </View>
            <View style={[styles.trendBadge, {
              backgroundColor: trend.dir === "up" ? "rgba(34,197,94,0.15)" : trend.dir === "down" ? "rgba(239,68,68,0.15)" : "rgba(100,116,139,0.15)"
            }]}>
              {trend.dir !== "flat" && (
                <Ionicons
                  name={trend.dir === "up" ? "trending-up" : "trending-down"}
                  size={16}
                  color={trend.dir === "up" ? Colors.success : Colors.danger}
                />
              )}
              <Text style={[styles.trendText, {
                color: trend.dir === "up" ? Colors.success : trend.dir === "down" ? Colors.danger : Colors.textMuted
              }]}>
                {trend.dir === "flat" ? "No change" : `${trend.pct}%`}
              </Text>
            </View>
          </View>
          <Text style={styles.weekCompare}>
            vs {formatMoney(stats?.revenueLastWeek)} last week ({stats?.salesLastWeekCount || 0} sales)
          </Text>
          {stats?.avgSalePrice7d > 0 && (
            <Text style={styles.avgPrice}>Avg sale: {formatMoney(stats.avgSalePrice7d)}</Text>
          )}
        </Pressable>

        <Text style={styles.sectionTitle}>Last 7 Days</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartBars}>
            {dailySales.map((day, i) => {
              const barHeight = Math.max((day.revenue / maxDayRevenue) * 80, 4);
              const dayDate = new Date(day.date + "T12:00:00");
              const label = DAY_LABELS[dayDate.getDay()];
              const isToday = i === dailySales.length - 1;
              return (
                <View key={day.date} style={styles.chartBarCol}>
                  <Text style={styles.chartBarAmount}>
                    {day.revenue > 0 ? "$" + Math.round(day.revenue) : ""}
                  </Text>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: barHeight,
                        backgroundColor: isToday ? Colors.primary : day.revenue > 0 ? "rgba(34,197,94,0.6)" : "rgba(100,116,139,0.2)",
                      },
                    ]}
                  />
                  <Text style={[styles.chartBarLabel, isToday && { color: Colors.primary, fontFamily: "Inter_700Bold" }]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Revenue</Text>
        <View style={styles.statsRow}>
          <Pressable style={styles.statCard} onPress={() => quickAction("/(tabs)/sales")}>
            <Text style={styles.statLabel}>7 Days</Text>
            <Text style={styles.statValue}>{formatMoney(stats?.revenue7d)}</Text>
            {stats?.profit7d !== stats?.revenue7d && (
              <Text style={[styles.statProfit, { color: (stats?.profit7d || 0) >= 0 ? Colors.success : Colors.danger }]}>
                Profit: {formatMoney(stats?.profit7d)}
              </Text>
            )}
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => quickAction("/(tabs)/sales")}>
            <Text style={styles.statLabel}>30 Days</Text>
            <Text style={styles.statValue}>{formatMoney(stats?.revenue30d)}</Text>
            {stats?.profit30d !== stats?.revenue30d && (
              <Text style={[styles.statProfit, { color: (stats?.profit30d || 0) >= 0 ? Colors.success : Colors.danger }]}>
                Profit: {formatMoney(stats?.profit30d)}
              </Text>
            )}
          </Pressable>
        </View>

        {(stats?.topCategories?.length || 0) > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Categories (30d)</Text>
            <View style={styles.categoriesCard}>
              {stats.topCategories.map((cat: any, i: number) => {
                const maxCount = stats.topCategories[0]?.count || 1;
                const barWidth = Math.max((cat.count / maxCount) * 100, 8);
                return (
                  <Pressable key={cat.name} style={styles.categoryRow} onPress={() => quickAction("/(tabs)/inventory")}>
                    <Text style={styles.categoryRank}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.categoryName}>{cat.name}</Text>
                      <View style={styles.categoryBarBg}>
                        <View style={[styles.categoryBarFill, { width: `${barWidth}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.categoryCount}>{cat.count}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Inventory</Text>
        <View style={styles.inventoryGrid}>
          <Pressable style={[styles.invCard, { borderLeftColor: Colors.available }]} onPress={() => quickAction("/(tabs)/inventory?filter=AVAILABLE")}>
            <Text style={styles.invCount}>{stats?.totalAvailable || 0}</Text>
            <Text style={styles.invLabel}>Available</Text>
          </Pressable>
          <Pressable style={[styles.invCard, { borderLeftColor: Colors.pending }]} onPress={() => quickAction("/(tabs)/inventory?filter=PENDING")}>
            <Text style={styles.invCount}>{stats?.totalPending || 0}</Text>
            <Text style={styles.invLabel}>Pending</Text>
          </Pressable>
          <Pressable style={[styles.invCard, { borderLeftColor: Colors.sold }]} onPress={() => quickAction("/(tabs)/inventory?filter=SOLD")}>
            <Text style={styles.invCount}>{stats?.totalSold || 0}</Text>
            <Text style={styles.invLabel}>Sold</Text>
          </Pressable>
          <Pressable style={[styles.invCard, { borderLeftColor: Colors.archived }]} onPress={() => quickAction("/(tabs)/inventory?filter=ARCHIVED")}>
            <Text style={styles.invCount}>{stats?.totalArchived || 0}</Text>
            <Text style={styles.invLabel}>Archived</Text>
          </Pressable>
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
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  quickBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#fff",
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  todayRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  todayCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  todayIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  todayValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
  },
  todayLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  weekCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 28,
  },
  weekTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  weekRevenue: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.text,
  },
  weekSalesCount: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  trendText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  weekCompare: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  avgPrice: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 6,
  },
  chartCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 28,
  },
  chartBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
  },
  chartBarCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  chartBarAmount: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: Colors.textMuted,
  },
  chartBar: {
    width: "60%",
    borderRadius: 4,
    minHeight: 4,
  },
  chartBarLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
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
  categoriesCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 28,
    gap: 12,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoryRank: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.textMuted,
    width: 18,
    textAlign: "center",
  },
  categoryName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.text,
    marginBottom: 4,
  },
  categoryBarBg: {
    height: 6,
    backgroundColor: "rgba(100,116,139,0.15)",
    borderRadius: 3,
    overflow: "hidden",
  },
  categoryBarFill: {
    height: 6,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  categoryCount: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.textSecondary,
    minWidth: 24,
    textAlign: "right",
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
