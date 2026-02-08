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

function ListingCard({
  item,
  onArchive,
  onDelete,
  selectMode,
  isSelected,
  onToggle,
}: {
  item: any;
  onArchive: () => void;
  onDelete: () => void;
  selectMode: boolean;
  isSelected: boolean;
  onToggle: () => void;
}) {
  if (selectMode) {
    return (
      <Pressable
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => {
          Haptics.selectionAsync();
          onToggle();
        }}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardLeft}>
            <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
              {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardSub}>
                {item.sku || "No SKU"} | ${parseFloat(item.price).toFixed(0)}
              </Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.cardPrice}>${parseFloat(item.price).toFixed(0)}</Text>
          </View>
        </View>
      </Pressable>
    );
  }

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
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          onToggle();
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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const queryParams = new URLSearchParams();
  if (activeFilter !== "ALL") queryParams.set("status", activeFilter);
  if (search) queryParams.set("search", search);
  queryParams.set("listingType", listingType);
  const queryString = queryParams.toString();

  const listingsUrl = "/api/listings" + (queryString ? `?${queryString}` : "");
  const { data: listings = [], isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: [listingsUrl],
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/listings/${id}`, { status: "ARCHIVED", isPublished: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/listings") });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/listings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/listings") });
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

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
    if (!selectMode) setSelectMode(true);
    if (next.size === 0) setSelectMode(false);
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function selectAll() {
    Haptics.selectionAsync();
    setSelectedIds(new Set(listings.map((l) => l.id)));
  }

  function handleBatchPrint() {
    if (selectedIds.size === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ids = Array.from(selectedIds).join(",");
    exitSelectMode();
    router.push(`/inventory/batch-labels?ids=${ids}` as any);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      {selectMode ? (
        <View style={styles.selectHeader}>
          <Pressable onPress={exitSelectMode} hitSlop={12}>
            <Ionicons name="close" size={26} color={Colors.text} />
          </Pressable>
          <Text style={styles.selectHeaderTitle}>{selectedIds.size} selected</Text>
          <Pressable onPress={selectAll} hitSlop={12}>
            <Text style={styles.selectAllText}>All</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Inventory</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setSelectMode(true); }}>
              <Ionicons name="pricetags-outline" size={24} color={Colors.primary} />
            </Pressable>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/inventory/scan" as any); }}>
              <Ionicons name="barcode-outline" size={26} color={Colors.primary} />
            </Pressable>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/inventory/new" as any); }}>
              <Ionicons name="add-circle" size={30} color={Colors.primary} />
            </Pressable>
          </View>
        </View>
      )}

      {!selectMode && (
        <>
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
        </>
      )}

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListingCard
              item={item}
              onArchive={() => confirmArchive(item)}
              onDelete={() => confirmDelete(item)}
              selectMode={selectMode}
              isSelected={selectedIds.has(item.id)}
              onToggle={() => toggleSelect(item.id)}
            />
          )}
          contentContainerStyle={{ paddingBottom: selectMode ? 140 : 120, paddingHorizontal: 16 }}
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
          scrollEnabled={true}
        />
      )}

      {selectMode && selectedIds.size > 0 && (
        <View style={[styles.batchBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
          <Pressable style={styles.batchBtn} onPress={handleBatchPrint}>
            <Ionicons name="print" size={22} color="#fff" />
            <Text style={styles.batchBtnText}>Print {selectedIds.size} Label{selectedIds.size > 1 ? "s" : ""}</Text>
          </Pressable>
        </View>
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
  selectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
  },
  selectHeaderTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#fff",
  },
  selectAllText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
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
  cardSelected: {
    backgroundColor: `${Colors.primary}20`,
    borderWidth: 2,
    borderColor: Colors.primary,
    padding: 14,
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
  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  selectCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
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
  batchBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBg,
    zIndex: 999,
  },
  batchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
  },
  batchBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: "#fff",
  },
});
