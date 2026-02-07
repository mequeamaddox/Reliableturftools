import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

function SaleCard({ item, listings, buyers }: { item: any; listings: any[]; buyers: any[] }) {
  const listing = listings.find((l: any) => l.id === item.listingId);
  const buyer = buyers.find((b: any) => b.id === item.buyerId);
  const date = new Date(item.soldAt);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View style={styles.saleIcon}>
            <Ionicons name="receipt" size={18} color={Colors.primary} />
          </View>
          <View>
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
          <Text style={styles.detailText}>{item.paymentType}</Text>
        </View>
        {item.meetupSpot && (
          <View style={styles.detailChip}>
            <Ionicons name="location-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.detailText} numberOfLines={1}>{item.meetupSpot}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function SalesScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: salesData = [], isLoading: salesLoading, refetch: refetchSales, isRefetching } = useQuery<any[]>({
    queryKey: ["/api/sales"],
  });
  const { data: listingsData = [] } = useQuery<any[]>({ queryKey: ["/api/listings"] });
  const { data: buyersData = [] } = useQuery<any[]>({ queryKey: ["/api/buyers"] });

  const isLoading = salesLoading;

  const totalRevenue = salesData.reduce((sum, s) => sum + parseFloat(s.salePrice), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sales</Text>
        <View style={styles.totalBadge}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>${totalRevenue.toFixed(0)}</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={salesData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SaleCard item={item} listings={listingsData} buyers={buyersData} />
          )}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchSales} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cash-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No sales recorded yet</Text>
              <Text style={styles.emptySubtext}>Mark items as sold from inventory to track sales</Text>
            </View>
          }
          scrollEnabled={salesData.length > 0}
        />
      )}
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
  totalBadge: {
    alignItems: "flex-end",
  },
  totalLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  totalValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
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
    gap: 10,
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
});
