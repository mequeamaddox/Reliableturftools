import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const CATEGORY_LABELS: Record<string, string> = {
  MOWER: "Mowers",
  TRIMMER: "Trimmers",
  BLOWER: "Blowers",
  CHAINSAW: "Chainsaws",
  EDGER: "Edgers",
  PRESSURE_WASHER: "Washers",
  GENERATOR: "Generators",
  OTHER: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  MOWER: "#22c55e",
  TRIMMER: "#3b82f6",
  BLOWER: "#f59e0b",
  CHAINSAW: "#ef4444",
  EDGER: "#8b5cf6",
  PRESSURE_WASHER: "#06b6d4",
  GENERATOR: "#ec4899",
  OTHER: "#64748b",
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash",
  VENMO: "Venmo",
  ZELLE: "Zelle",
  PAYPAL: "PayPal",
  OTHER: "Other",
};

const PERIOD_FILTERS = [
  { label: "All", value: "all" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
];

function BarChart({ data, maxHeight = 100 }: { data: { label: string; value: number }[]; maxHeight?: number }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={barStyles.container}>
      {data.map((d, i) => {
        const h = Math.max((d.value / maxVal) * maxHeight, 3);
        return (
          <View key={i} style={barStyles.barCol}>
            <Text style={barStyles.barValue}>
              {d.value >= 1000 ? `$${(d.value / 1000).toFixed(1)}k` : d.value > 0 ? `$${d.value.toFixed(0)}` : ""}
            </Text>
            <View style={[barStyles.bar, { height: h, backgroundColor: d.value > 0 ? Colors.primary : Colors.surface }]} />
            <Text style={barStyles.barLabel} numberOfLines={1}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-end", gap: 4, paddingTop: 8 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  bar: { width: "80%", borderRadius: 4, minWidth: 12 },
  barValue: { fontFamily: "Inter_500Medium", fontSize: 10, color: Colors.textMuted, textAlign: "center" },
  barLabel: { fontFamily: "Inter_400Regular", fontSize: 9, color: Colors.textMuted, textAlign: "center" },
});

function CategoryBar({ category, count, revenue, maxRevenue }: { category: string; count: number; revenue: number; maxRevenue: number }) {
  const pct = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
  const color = CATEGORY_COLORS[category] || Colors.textMuted;
  return (
    <View style={catStyles.row}>
      <View style={catStyles.labelRow}>
        <View style={[catStyles.dot, { backgroundColor: color }]} />
        <Text style={catStyles.label}>{CATEGORY_LABELS[category] || category}</Text>
        <Text style={catStyles.count}>{count} sold</Text>
      </View>
      <View style={catStyles.barBg}>
        <View style={[catStyles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={catStyles.revenue}>${revenue.toFixed(0)}</Text>
    </View>
  );
}

const catStyles = StyleSheet.create({
  row: { marginBottom: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text, flex: 1 },
  count: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textMuted },
  barBg: { height: 8, backgroundColor: Colors.surface, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  revenue: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.primary, marginTop: 2, textAlign: "right" },
});

function PaymentChip({ type, count, total }: { type: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={payStyles.chip}>
      <Text style={payStyles.chipLabel}>{PAYMENT_LABELS[type] || type}</Text>
      <Text style={payStyles.chipPct}>{pct}%</Text>
      <Text style={payStyles.chipCount}>{count}</Text>
    </View>
  );
}

const payStyles = StyleSheet.create({
  chip: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", gap: 2 },
  chipLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.text },
  chipPct: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.primary },
  chipCount: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textMuted },
});

function SaleCard({ item, listings, buyers }: { item: any; listings: any[]; buyers: any[] }) {
  const listing = listings.find((l: any) => l.id === item.listingId);
  const buyer = buyers.find((b: any) => b.id === item.buyerId);
  const date = new Date(item.soldAt);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const cost = listing?.cost ? parseFloat(listing.cost) : 0;
  const profit = parseFloat(item.salePrice) - cost;

  return (
    <Pressable
      style={styles.card}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/sales/form", params: { id: item.id } });
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View style={styles.saleIcon}>
            <Ionicons name="receipt" size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {listing?.title || "Unknown Item"}
            </Text>
            <Text style={styles.cardBuyer}>
              {buyer?.name || buyer?.phone || "Unknown Buyer"}
            </Text>
          </View>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardPrice}>${parseFloat(item.salePrice).toFixed(0)}</Text>
          <Text style={styles.cardDate}>{dateStr}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.detailChip}>
          <Ionicons name="wallet-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{PAYMENT_LABELS[item.paymentType] || item.paymentType}</Text>
        </View>
        {cost > 0 && (
          <View style={[styles.detailChip, { backgroundColor: profit >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }]}>
            <Ionicons name="trending-up" size={12} color={profit >= 0 ? Colors.success : Colors.danger} />
            <Text style={[styles.detailText, { color: profit >= 0 ? Colors.success : Colors.danger }]}>
              {profit >= 0 ? "+" : ""}${profit.toFixed(0)}
            </Text>
          </View>
        )}
        {item.meetupSpot && (
          <View style={styles.detailChip}>
            <Ionicons name="location-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.detailText} numberOfLines={1}>{item.meetupSpot}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function SalesScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [period, setPeriod] = useState("all");
  const [showAnalytics, setShowAnalytics] = useState(true);

  const { data: salesData = [], isLoading: salesLoading, refetch: refetchSales, isRefetching: salesRefetching } = useQuery<any[]>({
    queryKey: ["/api/sales"],
  });
  const { data: listingsData = [] } = useQuery<any[]>({ queryKey: ["/api/listings"] });
  const { data: buyersData = [] } = useQuery<any[]>({ queryKey: ["/api/buyers"] });
  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics, isRefetching: analyticsRefetching } = useQuery<any>({
    queryKey: ["/api/sales/analytics"],
  });

  const isRefetching = salesRefetching || analyticsRefetching;

  function onRefresh() {
    refetchSales();
    refetchAnalytics();
  }

  const filteredSales = useMemo(() => {
    if (period === "all") return salesData;
    const now = new Date();
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return salesData.filter((s) => new Date(s.soldAt) >= cutoff);
  }, [salesData, period]);

  const filteredRevenue = filteredSales.reduce((sum, s) => sum + parseFloat(s.salePrice), 0);

  const isLoading = salesLoading || analyticsLoading;

  function formatMoney(val: number) {
    if (val >= 10000) return "$" + (val / 1000).toFixed(1) + "k";
    return "$" + val.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  const categoryData = analytics?.categoryBreakdown
    ? Object.entries(analytics.categoryBreakdown as Record<string, { count: number; revenue: number }>)
        .sort(([, a], [, b]) => b.revenue - a.revenue)
    : [];
  const maxCatRevenue = categoryData.length > 0 ? Math.max(...categoryData.map(([, v]) => v.revenue)) : 0;

  const paymentData = analytics?.paymentBreakdown
    ? Object.entries(analytics.paymentBreakdown as Record<string, number>)
        .sort(([, a], [, b]) => b - a)
    : [];
  const totalPayments = paymentData.reduce((sum, [, c]) => sum + c, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sales</Text>
        <Pressable
          onPress={() => {
            setShowAnalytics(!showAnalytics);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={styles.analyticsToggle}
        >
          <Ionicons
            name={showAnalytics ? "stats-chart" : "stats-chart-outline"}
            size={20}
            color={showAnalytics ? Colors.primary : Colors.textMuted}
          />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {showAnalytics && analytics && (
            <View style={styles.analyticsSection}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Total Revenue</Text>
                  <Text style={styles.summaryValue}>{formatMoney(analytics.totalRevenue || 0)}</Text>
                  <Text style={[styles.summaryChange, { color: Colors.success }]}>
                    {analytics.totalSales || 0} sales
                  </Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Total Profit</Text>
                  <Text style={[styles.summaryValue, { color: Colors.success }]}>{formatMoney(analytics.totalProfit || 0)}</Text>
                  <Text style={styles.summaryChange}>
                    Avg ${(analytics.avgSalePrice || 0).toFixed(0)}/sale
                  </Text>
                </View>
              </View>

              <View style={styles.periodCards}>
                <View style={styles.periodCard}>
                  <Text style={styles.periodLabel}>7 Days</Text>
                  <Text style={styles.periodValue}>{formatMoney(analytics.revenue7d || 0)}</Text>
                  <Text style={styles.periodSub}>{analytics.count7d || 0} sales</Text>
                </View>
                <View style={styles.periodCard}>
                  <Text style={styles.periodLabel}>30 Days</Text>
                  <Text style={styles.periodValue}>{formatMoney(analytics.revenue30d || 0)}</Text>
                  <Text style={styles.periodSub}>{analytics.count30d || 0} sales</Text>
                </View>
                <View style={styles.periodCard}>
                  <Text style={styles.periodLabel}>90 Days</Text>
                  <Text style={styles.periodValue}>{formatMoney(analytics.revenue90d || 0)}</Text>
                  <Text style={styles.periodSub}>{analytics.count90d || 0} sales</Text>
                </View>
              </View>

              {analytics.weeklyTrend && analytics.weeklyTrend.length > 0 && (
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Weekly Revenue</Text>
                  <BarChart
                    data={analytics.weeklyTrend.map((w: any) => ({ label: w.week, value: w.revenue }))}
                  />
                </View>
              )}

              {categoryData.length > 0 && (
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>By Category</Text>
                  {categoryData.map(([cat, data]) => (
                    <CategoryBar
                      key={cat}
                      category={cat}
                      count={(data as any).count}
                      revenue={(data as any).revenue}
                      maxRevenue={maxCatRevenue}
                    />
                  ))}
                </View>
              )}

              {paymentData.length > 0 && (
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Payment Methods</Text>
                  <View style={styles.paymentRow}>
                    {paymentData.map(([type, count]) => (
                      <PaymentChip key={type} type={type} count={count as number} total={totalPayments} />
                    ))}
                  </View>
                </View>
              )}

              {analytics.topBuyers && analytics.topBuyers.length > 0 && (
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Top Buyers</Text>
                  {analytics.topBuyers.map((b: any, i: number) => (
                    <View key={b.id} style={styles.topBuyerRow}>
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.topBuyerName}>{b.name}</Text>
                        <Text style={styles.topBuyerSub}>{b.count} purchase{b.count !== 1 ? "s" : ""}</Text>
                      </View>
                      <Text style={styles.topBuyerSpent}>${b.totalSpent.toFixed(0)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              {period === "all" ? "All Sales" : `Last ${period}`}
            </Text>
            <View style={styles.filterRow}>
              {PERIOD_FILTERS.map((f) => (
                <Pressable
                  key={f.value}
                  style={[styles.filterChip, period === f.value && styles.filterChipActive]}
                  onPress={() => {
                    setPeriod(f.value);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[styles.filterText, period === f.value && styles.filterTextActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filteredSummary}>
            <Text style={styles.filteredCount}>{filteredSales.length} sale{filteredSales.length !== 1 ? "s" : ""}</Text>
            <Text style={styles.filteredRevenue}>{formatMoney(filteredRevenue)}</Text>
          </View>

          {filteredSales.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="cash-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {period === "all" ? "No sales recorded yet" : `No sales in the last ${period}`}
              </Text>
              <Text style={styles.emptySubtext}>Mark items as sold from inventory to track sales</Text>
            </View>
          ) : (
            filteredSales
              .sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime())
              .map((item) => (
                <View key={item.id} style={{ paddingHorizontal: 16 }}>
                  <SaleCard item={item} listings={listingsData} buyers={buyersData} />
                </View>
              ))
          )}
        </ScrollView>
      )}

      <Pressable
        style={[styles.fab, { bottom: Platform.OS === "web" ? 34 + 60 : insets.bottom + 70 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/sales/form");
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
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
    paddingVertical: 12,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.text,
  },
  analyticsToggle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
  },
  analyticsSection: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 18,
    gap: 4,
  },
  summaryLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.text,
  },
  summaryChange: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  periodCards: {
    flexDirection: "row",
    gap: 8,
  },
  periodCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 2,
  },
  periodLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  periodValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.text,
  },
  periodSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
  },
  chartCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 18,
  },
  chartTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
    marginBottom: 14,
  },
  paymentRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  topBuyerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  topBuyerName: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.text,
  },
  topBuyerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  topBuyerSpent: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.primary,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  listTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
  },
  filterRow: {
    flexDirection: "row",
    gap: 4,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.cardBg,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
  },
  filterTextActive: {
    color: "#fff",
  },
  filteredSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  filteredCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
  },
  filteredRevenue: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.primary,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  saleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(22, 163, 74, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
    maxWidth: 160,
  },
  cardBuyer: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  cardRight: {
    alignItems: "flex-end",
  },
  cardPrice: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.primary,
  },
  cardDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  detailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  detailText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    maxWidth: 120,
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
  emptySubtext: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});
