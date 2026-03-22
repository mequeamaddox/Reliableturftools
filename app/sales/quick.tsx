import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import Colors from "@/constants/colors";
import { apiRequest, queryClient, getApiUrl } from "@/lib/query-client";

const FALLBACK_PAYMENT_TYPES = ["CASH", "CASH_APP", "ZELLE", "VENMO", "APPLE_PAY", "SQUARE", "OTHER"];
const FALLBACK_LEAD_SOURCES = ["FACEBOOK", "OFFERUP", "WORD_OF_MOUTH", "RANDOM_MEETUP", "CRAIGSLIST", "OTHER"];

export default function QuickSaleScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerScanned, setScannerScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [salePrice, setSalePrice] = useState("");
  const [paymentType, setPaymentType] = useState("CASH");
  const [leadSource, setLeadSource] = useState("");
  const [meetupSpot, setMeetupSpot] = useState("");

  const [buyerSearch, setBuyerSearch] = useState("");
  const [selectedBuyer, setSelectedBuyer] = useState<any>(null);

  const { data: listings = [] } = useQuery<any[]>({ queryKey: ["/api/listings"] });
  const { data: meetupSpots = [] } = useQuery<any[]>({ queryKey: ["/api/meetup-spots"] });
  const { data: inventoryOptions } = useQuery<any>({ queryKey: ["/api/inventory-options"] });
  const { data: allBuyers = [] } = useQuery<any[]>({ queryKey: ["/api/buyers"] });

  const payTypes = inventoryOptions?.paymentTypes ?? FALLBACK_PAYMENT_TYPES;
  const leadSources = inventoryOptions?.leadSources ?? FALLBACK_LEAD_SOURCES;

  const availableListings = listings.filter(
    (l: any) => l.status === "AVAILABLE" || l.status === "PENDING"
  );

  const filteredListings = search.trim()
    ? availableListings.filter((l: any) => {
        const q = search.toLowerCase();
        return (
          (l.title || "").toLowerCase().includes(q) ||
          (l.sku || "").toLowerCase().includes(q) ||
          (l.barcode || "").toLowerCase().includes(q) ||
          (l.brand || "").toLowerCase().includes(q)
        );
      })
    : availableListings;

  const filteredBuyers = buyerSearch.trim().length > 0
    ? allBuyers.filter((b: any) => {
        const q = buyerSearch.toLowerCase();
        return (b.name || "").toLowerCase().includes(q) || (b.phone || "").includes(q);
      }).slice(0, 6)
    : [];

  const sellMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/listings/${selectedListing.id}/sell`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/listings") });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/pallets") });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/buyers"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Sale recorded!", `${selectedListing.title} marked as sold.`, [
        { text: "Done", onPress: () => router.back() },
        {
          text: "New Sale",
          onPress: () => {
            setSelectedListing(null);
            setSearch("");
            setSalePrice("");
            setPaymentType("CASH");
            setBuyerSearch("");
            setSelectedBuyer(null);
            setLeadSource("");
            setMeetupSpot("");
          },
        },
      ]);
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err?.message || "";
      if (msg.includes("401")) {
        Alert.alert("Session expired", "Please log out and log back in, then try again.");
      } else {
        Alert.alert("Error", "Could not record sale. Please try again.");
      }
    },
  });

  function selectListing(listing: any) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedListing(listing);
    setSalePrice(listing.price || "");
    setSearch("");
  }

  async function openScanner() {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert("Camera needed", "Allow camera access to scan barcodes.");
        return;
      }
    }
    setScannerScanned(false);
    setScannerVisible(true);
  }

  async function handleBarcodeScanned(data: string) {
    setScannerScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setScannerVisible(false);
    try {
      const url = new URL(`/api/listings/barcode/${encodeURIComponent(data)}`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: "include" });
      if (res.ok) {
        const listing = await res.json();
        if (listing && (listing.status === "AVAILABLE" || listing.status === "PENDING")) {
          selectListing(listing);
        } else if (listing) {
          Alert.alert("Item not available", `${listing.title} is already ${listing.status.toLowerCase()}.`);
        } else {
          Alert.alert("Not found", "No item found with that barcode.");
        }
      } else {
        Alert.alert("Not found", "No item found with that barcode.");
      }
    } catch {
      Alert.alert("Error", "Could not look up barcode.");
    }
  }

  function handleConfirm() {
    const hasExistingBuyer = selectedBuyer?.id;
    const newBuyerName = selectedBuyer && !selectedBuyer.id ? selectedBuyer.name : undefined;
    sellMutation.mutate({
      selectedBuyerId: hasExistingBuyer || undefined,
      buyerName: newBuyerName,
      salePrice: salePrice || selectedListing?.price,
      paymentType,
      leadSource: leadSource || undefined,
      meetupSpot: meetupSpot || undefined,
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Quick Sale</Text>
        <View style={{ width: 28 }} />
      </View>

      {!selectedListing ? (
        <View style={{ flex: 1 }}>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search by title, SKU, or barcode..."
                placeholderTextColor={Colors.textMuted}
                autoFocus
                returnKeyType="search"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </Pressable>
              )}
            </View>
            <Pressable style={styles.scanBtn} onPress={openScanner} hitSlop={8}>
              <Ionicons name="barcode-outline" size={24} color="#fff" />
            </Pressable>
          </View>

          <FlatList
            data={filteredListings}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>
                  {search.trim() ? "No matching items" : "No available items"}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable style={styles.listingRow} onPress={() => selectListing(item)}>
                <View style={styles.listingInfo}>
                  <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.listingMeta}>
                    {item.sku ? `${item.sku}  ·  ` : ""}{(item.condition || "").replace(/_/g, " ")}
                  </Text>
                </View>
                <View style={styles.listingRight}>
                  <Text style={styles.listingPrice}>${parseFloat(item.price || 0).toFixed(0)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </View>
              </Pressable>
            )}
          />
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24 }}
        >
          <Pressable style={styles.selectedCard} onPress={() => setSelectedListing(null)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedTitle} numberOfLines={1}>{selectedListing.title}</Text>
              <Text style={styles.selectedMeta}>
                {selectedListing.sku ? `${selectedListing.sku}  ·  ` : ""}{(selectedListing.condition || "").replace(/_/g, " ")}
              </Text>
            </View>
            <View style={styles.selectedRight}>
              <Text style={styles.selectedListPrice}>Listed at ${parseFloat(selectedListing.price || 0).toFixed(0)}</Text>
              <Text style={styles.changeTap}>Tap to change</Text>
            </View>
          </Pressable>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Sale Price</Text>
            <TextInput
              style={styles.input}
              value={salePrice}
              onChangeText={setSalePrice}
              keyboardType="decimal-pad"
              placeholderTextColor={Colors.textMuted}
              placeholder={selectedListing.price}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Payment</Text>
            <View style={styles.chipRow}>
              {payTypes.map((pt: string) => (
                <Pressable
                  key={pt}
                  style={[styles.chip, paymentType === pt && styles.chipActive]}
                  onPress={() => { setPaymentType(pt); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.chipText, paymentType === pt && styles.chipTextActive]}>
                    {pt.replace(/_/g, " ")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Buyer <Text style={styles.labelHint}>(optional)</Text></Text>
            {selectedBuyer ? (
              <Pressable
                style={styles.selectedBuyerChip}
                onPress={() => { setSelectedBuyer(null); setBuyerSearch(""); }}
              >
                <Ionicons name="person-circle" size={18} color={Colors.primary} />
                <Text style={styles.selectedBuyerText}>
                  {selectedBuyer.name || selectedBuyer.phone || "Unknown"}
                  {selectedBuyer.name && selectedBuyer.phone ? ` · ${selectedBuyer.phone}` : ""}
                </Text>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </Pressable>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={buyerSearch}
                  onChangeText={setBuyerSearch}
                  placeholder="Search name or phone, or type new"
                  placeholderTextColor={Colors.textMuted}
                  autoCorrect={false}
                />
                {buyerSearch.trim().length > 0 && (
                  <View style={styles.buyerDropdown}>
                    {filteredBuyers.map((b: any) => (
                      <Pressable
                        key={b.id}
                        style={styles.buyerDropdownItem}
                        onPress={() => { setSelectedBuyer(b); setBuyerSearch(""); Haptics.selectionAsync(); }}
                      >
                        <Ionicons name="person" size={14} color={Colors.textMuted} />
                        <Text style={styles.buyerDropdownName}>{b.name || "Unnamed"}</Text>
                        {b.phone ? <Text style={styles.buyerDropdownPhone}>{b.phone}</Text> : null}
                      </Pressable>
                    ))}
                    <Pressable
                      style={styles.buyerDropdownNew}
                      onPress={() => { setSelectedBuyer({ id: null, name: buyerSearch.trim(), phone: "" }); setBuyerSearch(""); Haptics.selectionAsync(); }}
                    >
                      <Ionicons name="add-circle-outline" size={14} color={Colors.primary} />
                      <Text style={styles.buyerDropdownNewText}>Add "{buyerSearch.trim()}" as new buyer</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Where'd They Find You? <Text style={styles.labelHint}>(optional)</Text></Text>
            <View style={styles.chipRow}>
              {leadSources.map((src: string) => (
                <Pressable
                  key={src}
                  style={[styles.chip, leadSource === src && styles.chipActive]}
                  onPress={() => { setLeadSource(leadSource === src ? "" : src); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.chipText, leadSource === src && styles.chipTextActive]}>
                    {src.replace(/_/g, " ")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {meetupSpots.length > 0 && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Meetup Spot <Text style={styles.labelHint}>(optional)</Text></Text>
              <View style={styles.chipRow}>
                {meetupSpots.map((spot: any) => (
                  <Pressable
                    key={spot.id}
                    style={[styles.chip, meetupSpot === spot.label && styles.chipActive]}
                    onPress={() => { setMeetupSpot(meetupSpot === spot.label ? "" : spot.label); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.chipText, meetupSpot === spot.label && styles.chipTextActive]}>
                      {spot.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Pressable
            style={[styles.confirmBtn, sellMutation.isPending && { opacity: 0.5 }]}
            onPress={handleConfirm}
            disabled={sellMutation.isPending}
          >
            {sellMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.confirmText}>Confirm Sale</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}

      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={[styles.scanHeader, { paddingTop: insets.top + 12 }]}>
            <Pressable onPress={() => setScannerVisible(false)} hitSlop={12}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
            <Text style={styles.scanTitle}>Scan Item Barcode</Text>
            <View style={{ width: 28 }} />
          </View>
          {cameraPermission?.granted && (
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code39", "code128", "qr"] }}
              onBarcodeScanned={scannerScanned ? undefined : ({ data }) => handleBarcodeScanned(data)}
            />
          )}
          <View style={[styles.scanHintBar, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.scanHintText}>Point at the item's barcode or SKU label</Text>
          </View>
        </View>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.text,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },
  scanBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  listingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 8,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  listingMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  listingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  listingPrice: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.primary,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.textMuted,
  },
  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${Colors.primary}18`,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${Colors.primary}40`,
    gap: 8,
  },
  selectedTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  selectedMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  selectedRight: {
    alignItems: "flex-end",
  },
  selectedListPrice: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.primary,
  },
  changeTap: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  labelHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  input: {
    backgroundColor: Colors.cardBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.text,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: "#fff",
  },
  selectedBuyerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: `${Colors.primary}18`,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: `${Colors.primary}40`,
  },
  selectedBuyerText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.text,
  },
  buyerDropdown: {
    marginTop: 4,
    backgroundColor: Colors.cardBg,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  buyerDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  buyerDropdownName: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  buyerDropdownPhone: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  buyerDropdownNew: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  buyerDropdownNewText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.primary,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.success,
    borderRadius: 14,
    paddingVertical: 18,
    marginTop: 8,
  },
  confirmText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#fff",
  },
  scanHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  scanTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#fff",
  },
  scanHintBar: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingTop: 16,
    alignItems: "center",
  },
  scanHintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
});
