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

const TEMPLATE_TYPES = [
  { value: "CHECK_IN", label: "Check In" },
  { value: "NEW_INVENTORY", label: "New Inventory" },
  { value: "MEETUP_REMINDER", label: "Meetup Reminder" },
  { value: "PRICE_DROP", label: "Price Drop" },
  { value: "CUSTOM", label: "Custom" },
];

export default function TemplatesScreen() {
  const insets = useSafeAreaInsets();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("");
  const [type, setType] = useState("CHECK_IN");

  const { data: templates = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/message-templates"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/message-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PUT", `/api/message-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/message-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  function resetForm() {
    setEditingId(null);
    setName("");
    setTemplate("");
    setType("CHECK_IN");
  }

  function startEdit(t: any) {
    setEditingId(t.id);
    setName(t.name);
    setTemplate(t.template);
    setType(t.type);
    Haptics.selectionAsync();
  }

  function handleSave() {
    if (!name.trim() || !template.trim()) {
      Alert.alert("Missing Info", "Please fill in name and template text");
      return;
    }
    const payload = { name: name.trim(), template: template.trim(), type };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function confirmDelete(id: string) {
    Alert.alert("Delete Template", "Remove this message template?", [
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
        <Text style={styles.headerTitle}>Message Templates</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {editingId ? "Edit Template" : "Add New Template"}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Template name"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.subLabel}>Type</Text>
          <View style={styles.typeRow}>
            {TEMPLATE_TYPES.map((t) => (
              <Pressable
                key={t.value}
                style={[
                  styles.typeChip,
                  type === t.value && styles.typeChipActive,
                ]}
                onPress={() => {
                  setType(t.value);
                  Haptics.selectionAsync();
                }}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    type === t.value && styles.typeChipTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Hey {name}! Just wanted to check in..."
            placeholderTextColor={Colors.textMuted}
            value={template}
            onChangeText={setTemplate}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

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
                    {editingId ? "Update" : "Add Template"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 30 }} />
        ) : templates.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No templates yet</Text>
          </View>
        ) : (
          templates.map((t: any) => (
            <View
              key={t.id}
              style={[styles.card, editingId === t.id && styles.cardEditing]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{t.name}</Text>
                  <View style={styles.cardTypeBadge}>
                    <Text style={styles.cardTypeText}>
                      {t.type.replace("_", " ")}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <Pressable onPress={() => startEdit(t)} hitSlop={8}>
                    <Ionicons name="pencil" size={20} color={Colors.info} />
                  </Pressable>
                  <Pressable onPress={() => confirmDelete(t.id)} hitSlop={8}>
                    <Ionicons name="trash" size={20} color={Colors.danger} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.cardTemplate}>{t.template}</Text>
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
  subLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
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
  textArea: { minHeight: 100 },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  typeChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  typeChipTextActive: { color: "#fff" },
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
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  cardEditing: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
  },
  cardTypeBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  cardTypeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
  },
  cardActions: {
    flexDirection: "row",
    gap: 14,
  },
  cardTemplate: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
});
