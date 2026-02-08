import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
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

function isShippable(item: any): boolean {
  return item.weightLbs && parseFloat(item.weightLbs) > 0;
}

function ProductCard({ item }: { item: any }) {
  const canShip = isShippable(item);
  return (
    <Pressable
      style={styles.productCard}
      onPress={() => router.push({ pathname: "/store/[id]", params: { id: item.id } })}
    >
      <View style={styles.productImagePlaceholder}>
        <Ionicons name="image-outline" size={40} color="#94a3b8" />
        <View style={[styles.fulfillmentBadge, canShip ? styles.shipBadge : styles.pickupBadge]}>
          <Ionicons
            name={canShip ? "cube-outline" : "location-outline"}
            size={11}
            color={canShip ? "#2563eb" : "#15803d"}
          />
          <Text style={[styles.fulfillmentText, canShip ? styles.shipText : styles.pickupText]}>
            {canShip ? "Ships" : "Pickup"}
          </Text>
        </View>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
        {item.brand && <Text style={styles.productBrand}>{item.brand}</Text>}
        <View style={styles.productMeta}>
          <Text style={styles.conditionBadge}>{getConditionLabel(item.condition)}</Text>
          <Text style={styles.powerBadge}>{item.powerType.replace("_", " ")}</Text>
        </View>
        <Text style={styles.productPrice}>${parseFloat(item.price).toFixed(0)}</Text>
      </View>
    </Pressable>
  );
}

export default function StorefrontScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [search, setSearch] = useState("");

  const { data: listings = [], isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ["store-listings"],
    queryFn: async () => {
      const baseUrl = getApiUrl();
      const url = new URL("/api/store/listings", baseUrl);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const filtered = search
    ? listings.filter(
        (l) =>
          l.title.toLowerCase().includes(search.toLowerCase()) ||
          (l.brand || "").toLowerCase().includes(search.toLowerCase()),
      )
    : listings;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Reliable Turf Tools</Text>
          <Text style={styles.headerSub}>Quality outdoor power equipment</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search tools..."
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View style={styles.locationNotice}>
        <Ionicons name="location" size={16} color="#15803d" />
        <Text style={styles.locationText}>Columbia, SC — Local pickup & nationwide shipping</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ProductCard item={item} />}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20, paddingHorizontal: 12 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#16a34a" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No items available right now</Text>
              <Text style={styles.emptySubtext}>Check back soon for new inventory!</Text>
            </View>
          }
          scrollEnabled={true}
        />
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: "#0f172a",
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#64748b",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#0f172a",
    paddingVertical: 12,
  },
  locationNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: "#f0fdf4",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  locationText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#15803d",
    flex: 1,
  },
  gridRow: {
    gap: 10,
    marginBottom: 10,
  },
  productCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  productImagePlaceholder: {
    height: 120,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  fulfillmentBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  shipBadge: {
    backgroundColor: "rgba(239,246,255,0.95)",
  },
  pickupBadge: {
    backgroundColor: "rgba(240,253,244,0.95)",
  },
  fulfillmentText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
  },
  shipText: {
    color: "#2563eb",
  },
  pickupText: {
    color: "#15803d",
  },
  productInfo: {
    padding: 12,
    gap: 4,
  },
  productTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#0f172a",
    lineHeight: 18,
  },
  productBrand: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#64748b",
  },
  productMeta: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  conditionBadge: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "#16a34a",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  powerBadge: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "#3b82f6",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  productPrice: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#0f172a",
    marginTop: 4,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: "#64748b",
  },
  emptySubtext: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#94a3b8",
  },
});
