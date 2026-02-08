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
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const TAG_COLORS: Record<string, string> = {
  REPEAT_BUYER: Colors.info,
  GOOD_BUYER: Colors.success,
  FLAKE_RISK: Colors.warning,
};

function BuyerCard({ item }: { item: any }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/buyers/[id]", params: { id: item.id } });
      }}
    >
      <View style={styles.cardRow}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={22} color={Colors.textMuted} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name || "Unknown"}</Text>
          <Text style={styles.cardPhone}>{item.phone}</Text>
          <View style={styles.tagRow}>
            {(item.tags || []).map((tag: string) => (
              <View key={tag} style={[styles.tag, { backgroundColor: TAG_COLORS[tag] + "22" }]}>
                <Text style={[styles.tagText, { color: TAG_COLORS[tag] }]}>
                  {tag.replace("_", " ")}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.cardStats}>
          <Text style={styles.statNum}>{item.totalPurchases || 0}</Text>
          <Text style={styles.statLabel}>Sales</Text>
          <Text style={styles.statSpend}>${(item.totalSpend || 0).toFixed(0)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function BuyersScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [search, setSearch] = useState("");

  const { data: buyers = [], isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ["/api/buyers"],
  });

  const filtered = search
    ? buyers.filter(
        (b) =>
          (b.name || "").toLowerCase().includes(search.toLowerCase()) ||
          b.phone.includes(search),
      )
    : buyers;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Buyers</Text>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/buyers/new" as any); }}>
          <Ionicons name="person-add" size={26} color={Colors.primary} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or phone..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BuyerCard item={item} />}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No buyers yet</Text>
              <Text style={styles.emptySubtext}>Buyers are auto-created when you make a sale</Text>
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
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  cardPhone: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 1,
  },
  tagRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    flexWrap: "wrap",
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    textTransform: "uppercase" as const,
  },
  cardStats: {
    alignItems: "center",
  },
  statNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  statSpend: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.primary,
    marginTop: 2,
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
