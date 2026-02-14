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
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
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
  const photoUrl = item.photos && item.photos.length > 0
    ? `${getApiUrl()}${item.photos[0]}`
    : "";

  return (
    <Pressable
      style={styles.productCard}
      onPress={() => router.push({ pathname: "/store/[id]", params: { id: item.id } })}
    >
      {photoUrl ? (
        <View style={styles.productImageWrap}>
          <Image source={{ uri: photoUrl }} style={styles.productImage} resizeMode="cover" />
          <View style={[styles.fulfillmentBadge, canShip ? styles.shipBadge : styles.pickupBadge]}>
            <Ionicons
              name={canShip ? "cube-outline" : "location-outline"}
              size={11}
              color="#fff"
            />
            <Text style={styles.fulfillmentText}>
              {canShip ? "Ships" : "Pickup"}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.productImagePlaceholder}>
          <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.2)" />
          <View style={[styles.fulfillmentBadge, canShip ? styles.shipBadge : styles.pickupBadge]}>
            <Ionicons
              name={canShip ? "cube-outline" : "location-outline"}
              size={11}
              color="#fff"
            />
            <Text style={styles.fulfillmentText}>
              {canShip ? "Ships" : "Pickup"}
            </Text>
          </View>
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productCategory}>
          {(item.category || "").replace(/_/g, " ")}
        </Text>
        <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
        {item.brand && <Text style={styles.productBrand}>{item.brand}</Text>}
        <View style={styles.productMeta}>
          <Text style={styles.conditionBadge}>{getConditionLabel(item.condition)}</Text>
          <Text style={styles.powerBadge}>{(item.powerType || "").replace("_", " ")}</Text>
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
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerBrand}>
          <Image
            source={{ uri: `${getApiUrl()}/public/logo.png` }}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.headerTitle}>Reliable Turf Tools</Text>
            <Text style={styles.headerSub}>Outdoor Power Equipment</Text>
          </View>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="rgba(255,255,255,0.35)" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search tools..."
          placeholderTextColor="rgba(255,255,255,0.3)"
        />
      </View>

      <View style={styles.locationNotice}>
        <Ionicons name="location" size={16} color="#4ade80" />
        <Text style={styles.locationText}>Columbia, SC — Local pickup & nationwide shipping</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#22c55e" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ProductCard item={item} />}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20, paddingHorizontal: 12 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22c55e" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={48} color="rgba(255,255,255,0.2)" />
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
    backgroundColor: "#111",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    justifyContent: "center",
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#fff",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#fff",
    paddingVertical: 12,
  },
  locationNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: "rgba(34,197,94,0.06)",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.12)",
  },
  locationText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#4ade80",
    flex: 1,
  },
  gridRow: {
    gap: 10,
    marginBottom: 10,
  },
  productCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  productImageWrap: {
    height: 130,
    backgroundColor: "#1a1a1a",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  productImagePlaceholder: {
    height: 130,
    backgroundColor: "#1a1a1a",
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
    backgroundColor: "rgba(59,130,246,0.85)",
  },
  pickupBadge: {
    backgroundColor: "rgba(34,197,94,0.85)",
  },
  fulfillmentText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: "#fff",
  },
  productInfo: {
    padding: 12,
    gap: 4,
  },
  productCategory: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: "#22c55e",
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  productTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
    lineHeight: 18,
  },
  productBrand: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
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
    color: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  powerBadge: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  productPrice: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: "#4ade80",
    marginTop: 6,
    letterSpacing: -0.5,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: "rgba(255,255,255,0.4)",
  },
  emptySubtext: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.25)",
  },
});
