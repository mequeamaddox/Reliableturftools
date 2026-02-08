import React, { useState } from "react";
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

export default function MeetupSpotsScreen() {
  const insets = useSafeAreaInsets();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const { data: spots = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/meetup-spots"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/meetup-spots", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetup-spots"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PUT", `/api/meetup-spots/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetup-spots"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/meetup-spots/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetup-spots"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  function resetForm() {
    setEditingId(null);
    setLabel("");
    setAddress("");
    setIsDefault(false);
  }

  function startEdit(spot: any) {
    setEditingId(spot.id);
    setLabel(spot.label);
    setAddress(spot.address || "");
    setIsDefault(spot.isDefault);
    Haptics.selectionAsync();
  }

  function handleSave() {
    if (!label.trim()) {
      Alert.alert("Missing Info", "Please enter a spot name");
      return;
    }
    const payload = {
      label: label.trim(),
      address: address.trim() || null,
      isDefault,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function confirmDelete(id: string) {
    Alert.alert("Delete Spot", "Remove this meetup spot?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Meetup Spots</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {editingId ? "Edit Spot" : "Add New Spot"}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Spot name (e.g. Target Parking Lot)"
            placeholderTextColor={Colors.textMuted}
            value={label}
            onChangeText={setLabel}
          />
          <TextInput
            style={styles.input}
            placeholder="Address (optional)"
            placeholderTextColor={Colors.textMuted}
            value={address}
            onChangeText={setAddress}
          />
          <Pressable
            style={styles.defaultToggle}
            onPress={() => {
              setIsDefault(!isDefault);
              Haptics.selectionAsync();
            }}
          >
            <Ionicons
              name={isDefault ? "checkbox" : "square-outline"}
              size={22}
              color={isDefault ? Colors.primary : Colors.textMuted}
            />
            <Text style={styles.defaultToggleText}>Set as default spot</Text>
          </Pressable>

          <View style={styles.formActions}>
            {editingId && (
              <Pressable style={styles.cancelBtn} onPress={resetForm}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.saveFormBtn, isSaving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={editingId ? "checkmark" : "add"}
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.saveFormBtnText}>
                    {editingId ? "Update" : "Add Spot"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 30 }} />
        ) : spots.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="location-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No meetup spots yet</Text>
          </View>
        ) : (
          spots.map((spot: any) => (
            <View
              key={spot.id}
              style={[styles.spotCard, editingId === spot.id && styles.spotCardEditing]}
            >
              <View style={styles.spotInfo}>
                <View style={styles.spotIcon}>
                  <Ionicons name="location" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.spotLabelRow}>
                    <Text style={styles.spotLabel}>{spot.label}</Text>
                    {spot.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  {spot.address && (
                    <Text style={styles.spotAddress}>{spot.address}</Text>
                  )}
                </View>
              </View>
              <View style={styles.spotActions}>
                <Pressable onPress={() => startEdit(spot)} hitSlop={8}>
                  <Ionicons name="pencil" size={20} color={Colors.info} />
                </Pressable>
                <Pressable onPress={() => confirmDelete(spot.id)} hitSlop={8}>
                  <Ionicons name="trash" size={20} color={Colors.danger} />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
  },
  content: { padding: 16, paddingBottom: 120 },
  formCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
    marginBottom: 12,
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  defaultToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  defaultToggleText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  formActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  cancelBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  saveFormBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveFormBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
  empty: {
    alignItems: "center",
    paddingTop: 40,
    gap: 8,
  },
  emptyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: Colors.textMuted,
  },
  spotCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  spotCardEditing: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  spotInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  spotIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(22, 163, 74, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  spotLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  spotLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  defaultBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: "#fff",
  },
  spotAddress: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  spotActions: {
    flexDirection: "row",
    gap: 14,
  },
});
