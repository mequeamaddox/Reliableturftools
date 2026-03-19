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
  Modal,
  ScrollView,
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

function PalletSummary({ listings }: { listings: any[] }) {
  const totalValue = listings.reduce((sum, l) => sum + parseFloat(l.price || "0"), 0);
  const totalCost = listings.reduce((sum, l) => sum + parseFloat(l.cost || "0"), 0);
  const profit = totalValue - totalCost;
  const available = listings.filter((l) => l.status === "AVAILABLE").length;
  const sold = listings.filter((l) => l.status === "SOLD").length;

  return (
    <View style={styles.palletSummary}>
      <View style={styles.palletSummaryRow}>
        <View style={styles.palletStat}>
          <Text style={styles.palletStatValue}>{listings.length}</Text>
          <Text style={styles.palletStatLabel}>Items</Text>
        </View>
        <View style={styles.palletDivider} />
        <View style={styles.palletStat}>
          <Text style={styles.palletStatValue}>{available}</Text>
          <Text style={styles.palletStatLabel}>Available</Text>
        </View>
        <View style={styles.palletDivider} />
        <View style={styles.palletStat}>
          <Text style={styles.palletStatValue}>{sold}</Text>
          <Text style={styles.palletStatLabel}>Sold</Text>
        </View>
        <View style={styles.palletDivider} />
        <View style={styles.palletStat}>
          <Text style={[styles.palletStatValue, { color: Colors.primary }]}>${totalValue.toFixed(0)}</Text>
          <Text style={styles.palletStatLabel}>Value</Text>
        </View>
        {totalCost > 0 && (
          <>
            <View style={styles.palletDivider} />
            <View style={styles.palletStat}>
              <Text style={[styles.palletStatValue, { color: profit >= 0 ? Colors.success : Colors.danger }]}>
                ${profit.toFixed(0)}
              </Text>
              <Text style={styles.palletStatLabel}>Profit</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === "web" ? 84 : 50 + insets.bottom;
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [listingType, setListingType] = useState<"ITEM" | "PART">("ITEM");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activePallet, setActivePallet] = useState<string | null>(null);
  const [palletPickerVisible, setPalletPickerVisible] = useState(false);

  const { data: pallets = [] } = useQuery<string[]>({ queryKey: ["/api/pallets"] });

  const queryParams = new URLSearchParams();
  if (activeFilter !== "ALL") queryParams.set("status", activeFilter);
  if (search) queryParams.set("search", search);
  queryParams.set("listingType", listingType);
  if (activePallet) queryParams.set("pallet", activePallet);
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

  function selectPallet(p: string | null) {
    setActivePallet(p);
    setPalletPickerVisible(false);
    setActiveFilter("ALL");
    Haptics.selectionAsync();
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

          {/* Filter row with pallet chip */}
          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <Pressable
                key={f}
                style={[styles.filterChip, !activePallet && activeFilter === f && styles.filterChipActive]}
                onPress={() => { setActiveFilter(f); setActivePallet(null); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.filterText, !activePallet && activeFilter === f && styles.filterTextActive]}>
                  {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.filterChip, styles.palletChip, !!activePallet && styles.palletChipActive]}
              onPress={() => { setPalletPickerVisible(true); Haptics.selectionAsync(); }}
            >
              <Ionicons name="layers-outline" size={13} color={activePallet ? "#fff" : Colors.primary} />
              <Text style={[styles.filterText, styles.palletChipText, !!activePallet && styles.filterTextActive]}>
                {activePallet ? activePallet : "Pallets"}
              </Text>
              {activePallet && (
                <Pressable hitSlop={8} onPress={() => selectPallet(null)}>
                  <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.8)" />
                </Pressable>
              )}
            </Pressable>
          </View>
        </>
      )}

      {/* Pallet Summary */}
      {activePallet && listings.length > 0 && !isLoading && (
        <PalletSummary listings={listings} />
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
          contentContainerStyle={{ paddingBottom: selectMode ? tabBarHeight + 80 : tabBarHeight + 20, paddingHorizontal: 16 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {activePallet ? `No items in "${activePallet}"` : "No listings found"}
              </Text>
              {!activePallet && (
                <Pressable style={styles.emptyBtn} onPress={() => router.push("/inventory/new" as any)}>
                  <Text style={styles.emptyBtnText}>Add your first item</Text>
                </Pressable>
              )}
            </View>
          }
          scrollEnabled={true}
        />
      )}

      {selectMode && selectedIds.size > 0 && (
        <View style={[styles.batchBar, { bottom: tabBarHeight }]}>
          <Pressable style={styles.batchBtn} onPress={handleBatchPrint}>
            <Ionicons name="print" size={22} color="#fff" />
            <Text style={styles.batchBtnText}>Print {selectedIds.size} Label{selectedIds.size > 1 ? "s" : ""}</Text>
          </Pressable>
        </View>
      )}

      {/* Pallet Picker Modal */}
      <Modal
        visible={palletPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPalletPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPalletPickerVisible(false)}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Pallets</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {pallets.length > 0 && (
                <Pressable style={styles.palletOption} onPress={() => selectPallet(null)}>
                  <Ionicons name="list-outline" size={20} color={Colors.textSecondary} />
                  <Text style={styles.palletOptionText}>All Items</Text>
                  {!activePallet && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                </Pressable>
              )}
              {pallets.map((p) => (
                <Pressable key={p} style={styles.palletOption} onPress={() => selectPallet(p)}>
                  <Ionicons name="layers-outline" size={20} color={Colors.primary} />
                  <Text style={styles.palletOptionText}>{p}</Text>
                  {activePallet === p && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                </Pressable>
              ))}
              {pallets.length === 0 && (
                <View style={styles.palletEmpty}>
                  <Ionicons name="layers-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.palletEmptyText}>No pallets yet</Text>
                  <Text style={styles.palletEmptySubtext}>
                    Use pallet mode when adding items to group them together
                  </Text>
                </View>
              )}
            </ScrollView>
            <Pressable
              style={styles.newPalletBtn}
              onPress={() => {
                setPalletPickerVisible(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({ pathname: "/inventory/new" as any, params: { startPallet: "1" } });
              }}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.newPalletBtnText}>Start New Pallet Intake</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
    flexWrap: "wrap",
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
  palletChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.cardBg,
  },
  palletChipActive: {
    backgroundColor: Colors.primary,
  },
  palletChipText: {
    color: Colors.primary,
  },
  palletSummary: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: `${Colors.primary}12`,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: `${Colors.primary}25`,
  },
  palletSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  palletStat: {
    alignItems: "center",
    gap: 2,
  },
  palletStatValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
  },
  palletStatLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  palletDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
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
    textAlign: "center",
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
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBg,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: "60%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
    marginBottom: 16,
  },
  palletOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  palletOptionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  palletEmpty: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  palletEmptyText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  palletEmptySubtext: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  newPalletBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 12,
    marginHorizontal: 4,
  },
  newPalletBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#fff",
  },
});
