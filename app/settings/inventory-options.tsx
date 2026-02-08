import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";

type OptionType = "conditions" | "powerTypes" | "categories";

const SECTION_CONFIG: Record<OptionType, { label: string; icon: string; color: string }> = {
  conditions: { label: "Condition", icon: "construct", color: Colors.info },
  powerTypes: { label: "Power Type", icon: "flash", color: Colors.warning },
  categories: { label: "Category", icon: "grid", color: Colors.primary },
};

export default function InventoryOptionsScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: options, isLoading } = useQuery<{
    conditions: string[];
    powerTypes: string[];
    categories: string[];
  }>({ queryKey: ["/api/inventory-options"] });

  const [conditions, setConditions] = useState<string[]>([]);
  const [powerTypes, setPowerTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [newItem, setNewItem] = useState<Record<OptionType, string>>({
    conditions: "",
    powerTypes: "",
    categories: "",
  });
  const [editingSection, setEditingSection] = useState<OptionType | null>(null);

  useEffect(() => {
    if (options) {
      setConditions(options.conditions);
      setPowerTypes(options.powerTypes);
      setCategories(options.categories);
    }
  }, [options]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/inventory-options", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-options"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Alert.alert("Error", "Failed to save options");
    },
  });

  function getList(type: OptionType): string[] {
    switch (type) {
      case "conditions": return conditions;
      case "powerTypes": return powerTypes;
      case "categories": return categories;
    }
  }

  function setList(type: OptionType, list: string[]) {
    switch (type) {
      case "conditions": setConditions(list); break;
      case "powerTypes": setPowerTypes(list); break;
      case "categories": setCategories(list); break;
    }
  }

  function handleAdd(type: OptionType) {
    const val = newItem[type].trim().toUpperCase().replace(/\s+/g, "_");
    if (!val) return;
    const list = getList(type);
    if (list.includes(val)) {
      Alert.alert("Duplicate", "This option already exists");
      return;
    }
    const updated = [...list, val];
    setList(type, updated);
    setNewItem({ ...newItem, [type]: "" });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveMutation.mutate({ [type]: updated });
  }

  function handleRemove(type: OptionType, item: string) {
    Alert.alert("Remove Option", `Remove "${item.replace(/_/g, " ")}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          const updated = getList(type).filter((i) => i !== item);
          setList(type, updated);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          saveMutation.mutate({ [type]: updated });
        },
      },
    ]);
  }

  function handleReorder(type: OptionType, index: number, direction: "up" | "down") {
    const list = [...getList(type)];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    setList(type, list);
    Haptics.selectionAsync();
    saveMutation.mutate({ [type]: list });
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Inventory Options</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {(Object.keys(SECTION_CONFIG) as OptionType[]).map((type) => {
          const config = SECTION_CONFIG[type];
          const list = getList(type);
          const isExpanded = editingSection === type;

          return (
            <View key={type} style={styles.section}>
              <Pressable
                style={styles.sectionHeader}
                onPress={() => {
                  setEditingSection(isExpanded ? null : type);
                  Haptics.selectionAsync();
                }}
              >
                <View style={[styles.sectionIcon, { backgroundColor: `${config.color}20` }]}>
                  <Ionicons name={config.icon as any} size={20} color={config.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{config.label}</Text>
                  <Text style={styles.sectionCount}>{list.length} options</Text>
                </View>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={Colors.textMuted}
                />
              </Pressable>

              {isExpanded && (
                <View style={styles.sectionBody}>
                  {list.map((item, index) => (
                    <View key={item} style={styles.optionRow}>
                      <View style={styles.optionReorder}>
                        <Pressable
                          onPress={() => handleReorder(type, index, "up")}
                          hitSlop={8}
                          disabled={index === 0}
                          style={{ opacity: index === 0 ? 0.3 : 1 }}
                        >
                          <Ionicons name="chevron-up" size={16} color={Colors.textMuted} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleReorder(type, index, "down")}
                          hitSlop={8}
                          disabled={index === list.length - 1}
                          style={{ opacity: index === list.length - 1 ? 0.3 : 1 }}
                        >
                          <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
                        </Pressable>
                      </View>
                      <Text style={styles.optionLabel}>{item.replace(/_/g, " ")}</Text>
                      <Pressable
                        onPress={() => handleRemove(type, item)}
                        hitSlop={10}
                      >
                        <Ionicons name="close-circle" size={22} color={Colors.danger} />
                      </Pressable>
                    </View>
                  ))}

                  <View style={styles.addRow}>
                    <TextInput
                      style={styles.addInput}
                      value={newItem[type]}
                      onChangeText={(v) => setNewItem({ ...newItem, [type]: v })}
                      placeholder={`Add new ${config.label.toLowerCase()}...`}
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="characters"
                      onSubmitEditing={() => handleAdd(type)}
                      returnKeyType="done"
                    />
                    <Pressable
                      style={[styles.addBtn, !newItem[type].trim() && { opacity: 0.4 }]}
                      onPress={() => handleAdd(type)}
                      disabled={!newItem[type].trim()}
                    >
                      <Ionicons name="add" size={22} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.text,
  },
  section: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  sectionCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  optionReorder: {
    alignItems: "center",
    gap: 2,
  },
  optionLabel: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.text,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  addInput: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
});
