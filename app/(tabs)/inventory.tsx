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
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import SwipeableRow from "@/components/SwipeableRow";
import { apiRequest, queryClient } from "@/lib/query-client";

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: Colors.available,
  PENDING: Colors.pending,
  SOLD: Colors.sold,
  ARCHIVED: Colors.archived,
};

const FILTERS = ["ALL", "AVAILABLE", "PENDING", "SOLD", "ARCHIVED"] as const;

function ListingCard({ item, onArchive, onDelete }: { item: any; onArchive: () => void; onDelete: () => void }) {
  const leftAction = item.status === "AVAILABLE" ? {
    icon: "archive" as const,
    color: Colors.warning,
    label: "Archive",
    onPress: onArchive,
  } : undefined;

  const rightAction = {
    icon: "trash" as const,
    color: Colors.danger,
    label: "Delete",
    onPress: onDelete,
  };

  return (
    <SwipeableRow leftAction={leftAction} rightAction={rightAction}>
      <Pressable
        style={styles.card}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: "/inventory/[id]", params: { id: item.id } });
        }}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardLeft}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardSub}>
                {item.brand || "No brand"} | {item.condition?.replace("_", " ")} | Qty: {item.quantity}
                {item.palletName ? ` | ${item.palletName}` : ""}
              </Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.cardPrice}>${parseFloat(item.price).toFixed(0)}</Text>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {item.listingType === "PART" && (
                <View style={styles.partBadge}>
                  <Text style={styles.partText}>PART</Text>
                </View>
              )}
              {item.isPublished && (
                <View style={styles.pubBadge}>
                  <Text style={styles.pubText}>LIVE</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </SwipeableRow>
  );
}

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [listingType, setListingType] = useState<"ITEM" | "PART">("ITEM");

  const queryParams = new URLSearchParams();
  if (activeFilter !== "ALL") queryParams.set("status", activeFilter);
  if (search) queryParams.set("search", search);
  queryParams.set("listingType", listingType);
  const queryString = queryParams.toString();

  const { data: listings = [], isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ["/api/listings" + (queryString ? `?${queryString}` : "")],
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/listings/${id}`, { status: "ARCHIVED", isPublished: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/listings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  function confirmArchive(item: any) {
    Alert.alert("Archive Item", `Archive "${item.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Archive", onPress: () => archiveMutation.mutate(item.id) },
    ]);
  }

  function confirmDelete(item: any) {
    Alert.alert("Delete Item", `Permanently delete "${item.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(item.id) },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/inventory/scan" as any); }}>
            <Ionicons name="barcode-outline" size={26} color={Colors.primary} />
          </Pressable>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/inventory/new" as any); }}>
            <Ionicons name="add-circle" size={30} color={Colors.primary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search title, SKU, barcode..."
          placeholderTextColor={Colors.textMuted}
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.typeToggleRow}>
        <Pressable
          style={[styles.typeToggle, listingType === "ITEM" && styles.typeToggleActive]}
          onPress={() => { setListingType("ITEM"); Haptics.selectionAsync(); }}
        >
          <Ionicons name="build-outline" size={16} color={listingType === "ITEM" ? "#fff" : Colors.textSecondary} />
          <Text style={[styles.typeToggleText, listingType === "ITEM" && styles.typeToggleTextActive]}>Items</Text>
        </Pressable>
        <Pressable
          style={[styles.typeToggle, listingType === "PART" && styles.typeToggleActive]}
          onPress={() => { setListingType("PART"); Haptics.selectionAsync(); }}
        >
          <Ionicons name="cog-outline" size={16} color={listingType === "PART" ? "#fff" : Colors.textSecondary} />
          <Text style={[styles.typeToggleText, listingType === "PART" && styles.typeToggleTextActive]}>Parts</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
            onPress={() => { setActiveFilter(f); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ListingCard item={item} onArchive={() => confirmArchive(item)} onDelete={() => confirmDelete(item)} />}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No listings found</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push("/inventory/new" as any)}>
                <Text style={styles.emptyBtnText}>Add your first item</Text>
              </Pressable>
            </View>
          }
          scrollEnabled={listings.length > 0}
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
  headerActions: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 12,
  },
  typeToggleRow: {
    flexDirection: "row",
    gap: 0,
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    overflow: "hidden",
  },
  typeToggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  typeToggleActive: {
    backgroundColor: Colors.primary,
  },
  typeToggleText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  typeToggleTextActive: {
    color: "#fff",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.cardBg,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: "#fff",
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  cardRow: {
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
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  cardSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  cardPrice: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.primary,
  },
  partBadge: {
    backgroundColor: "rgba(99,102,241,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  partText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: "#818cf8",
  },
  pubBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pubText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: Colors.success,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: Colors.textMuted,
  },
  emptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
});
