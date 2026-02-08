import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";

const FOLLOW_UP_TYPES = [
  { value: "CHECK_IN", label: "Check In", icon: "chatbubble" as const },
  { value: "NEW_INVENTORY", label: "New Inventory", icon: "cube" as const },
  { value: "MEETUP_REMINDER", label: "Meetup Reminder", icon: "location" as const },
  { value: "PRICE_DROP", label: "Price Drop", icon: "pricetag" as const },
  { value: "CUSTOM", label: "Custom", icon: "create" as const },
];

export default function NewFollowUpScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ editId?: string; buyerId?: string }>();
  const isEditing = !!params.editId;

  const { data: buyers = [] } = useQuery<any[]>({ queryKey: ["/api/buyers"] });
  const { data: templates = [] } = useQuery<any[]>({ queryKey: ["/api/message-templates"] });
  const { data: allFollowUps = [] } = useQuery<any[]>({
    queryKey: ["/api/followups?all=true"],
    enabled: isEditing,
  });

  const existingFollowUp = isEditing
    ? allFollowUps.find((f: any) => f.id === params.editId)
    : null;

  const [selectedBuyerId, setSelectedBuyerId] = useState(
    params.buyerId || existingFollowUp?.buyerId || ""
  );
  const [type, setType] = useState(existingFollowUp?.type || "CHECK_IN");
  const [message, setMessage] = useState(existingFollowUp?.message || "");
  const [dueDate, setDueDateRaw] = useState(
    existingFollowUp?.dueDate
      ? new Date(existingFollowUp.dueDate).toISOString().split("T")[0]
      : ""
  );
  const [showBuyerPicker, setShowBuyerPicker] = useState(false);
  const [buyerSearch, setBuyerSearch] = useState("");

  React.useEffect(() => {
    if (existingFollowUp && !selectedBuyerId) {
      setSelectedBuyerId(existingFollowUp.buyerId || "");
      setType(existingFollowUp.type);
      setMessage(existingFollowUp.message || "");
      if (existingFollowUp.dueDate) {
        setDueDateRaw(new Date(existingFollowUp.dueDate).toISOString().split("T")[0]);
      }
    }
  }, [existingFollowUp]);

  function invalidateFollowUps() {
    queryClient.invalidateQueries({ queryKey: ["/api/followups?all=true"] });
    queryClient.invalidateQueries({ queryKey: ["/api/followups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/followups", data),
    onSuccess: () => {
      invalidateFollowUps();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("PUT", `/api/followups/${params.editId}`, data),
    onSuccess: () => {
      invalidateFollowUps();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
  });

  function handleSave() {
    if (!selectedBuyerId) {
      Alert.alert("Missing Info", "Please select a buyer");
      return;
    }
    const payload: any = {
      buyerId: selectedBuyerId,
      type,
      message: message.trim() || null,
      dueDate: dueDate ? new Date(dueDate + "T12:00:00").toISOString() : null,
    };
    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      payload.isCompleted = false;
      createMutation.mutate(payload);
    }
  }

  function fillPlaceholders(text: string, buyerName?: string) {
    let filled = text;
    filled = filled.replace(/\{buyer_name\}/gi, buyerName || "there");
    filled = filled.replace(/\{listing_title\}/gi, "");
    filled = filled.replace(/\s{2,}/g, " ");
    return filled.trim();
  }

  function applyTemplate(t: any) {
    const buyerName = buyers.find((b: any) => b.id === selectedBuyerId)?.name;
    setMessage(fillPlaceholders(t.template, buyerName));
    setType(t.type);
    Haptics.selectionAsync();
  }

  const selectedBuyer = buyers.find((b: any) => b.id === selectedBuyerId);
  const filteredBuyers = buyers.filter(
    (b: any) =>
      !buyerSearch ||
      (b.name || "").toLowerCase().includes(buyerSearch.toLowerCase()) ||
      (b.phone || "").includes(buyerSearch)
  );
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const quickDates = [
    { label: "Today", days: 0 },
    { label: "Tomorrow", days: 1 },
    { label: "3 Days", days: 3 },
    { label: "1 Week", days: 7 },
  ];

  function setQuickDate(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDueDateRaw(d.toISOString().split("T")[0]);
    Haptics.selectionAsync();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isEditing ? "Edit Follow-Up" : "New Follow-Up"}
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          hitSlop={12}
          style={[styles.saveBtn, isSaving && { opacity: 0.5 }]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="checkmark" size={24} color="#fff" />
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Buyer</Text>
        <Pressable
          style={styles.buyerSelect}
          onPress={() => setShowBuyerPicker(!showBuyerPicker)}
        >
          <Ionicons
            name="person"
            size={18}
            color={selectedBuyer ? Colors.primary : Colors.textMuted}
          />
          <Text
            style={[
              styles.buyerSelectText,
              !selectedBuyer && { color: Colors.textMuted },
            ]}
          >
            {selectedBuyer
              ? selectedBuyer.name || selectedBuyer.phone
              : "Select a buyer"}
          </Text>
          <Ionicons
            name={showBuyerPicker ? "chevron-up" : "chevron-down"}
            size={18}
            color={Colors.textMuted}
          />
        </Pressable>

        {showBuyerPicker && (
          <View style={styles.buyerPicker}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search buyers..."
              placeholderTextColor={Colors.textMuted}
              value={buyerSearch}
              onChangeText={setBuyerSearch}
            />
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {filteredBuyers.map((b: any) => (
                <Pressable
                  key={b.id}
                  style={[
                    styles.buyerOption,
                    b.id === selectedBuyerId && styles.buyerOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedBuyerId(b.id);
                    setShowBuyerPicker(false);
                    setBuyerSearch("");
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={styles.buyerOptionText}>
                    {b.name || b.phone}
                  </Text>
                  {b.name && b.phone && (
                    <Text style={styles.buyerOptionSub}>{b.phone}</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={styles.label}>Type</Text>
        <View style={styles.typeGrid}>
          {FOLLOW_UP_TYPES.map((t) => (
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
              <Ionicons
                name={t.icon}
                size={16}
                color={type === t.value ? "#fff" : Colors.textSecondary}
              />
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

        <Text style={styles.label}>Due Date</Text>
        <View style={styles.quickDates}>
          {quickDates.map((qd) => (
            <Pressable
              key={qd.label}
              style={styles.quickDateBtn}
              onPress={() => setQuickDate(qd.days)}
            >
              <Text style={styles.quickDateText}>{qd.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.textMuted}
          value={dueDate}
          onChangeText={setDueDateRaw}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.label}>Message</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Type your follow-up message..."
          placeholderTextColor={Colors.textMuted}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {templates.length > 0 && (
          <>
            <Text style={[styles.label, { marginTop: 8 }]}>Quick Templates</Text>
            {templates.map((t: any) => (
              <Pressable
                key={t.id}
                style={styles.templateBtn}
                onPress={() => applyTemplate(t)}
              >
                <Ionicons name="document-text" size={16} color={Colors.info} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.templateName}>{t.name}</Text>
                  <Text style={styles.templatePreview} numberOfLines={1}>
                    {t.template}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
              </Pressable>
            ))}
          </>
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
  saveBtn: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  form: { padding: 16, paddingBottom: 120 },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  buyerSelect: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    padding: 14,
  },
  buyerSelectText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.text,
  },
  buyerPicker: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
    overflow: "hidden",
  },
  searchInput: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.inputBg,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  buyerOption: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  buyerOptionActive: {
    backgroundColor: "rgba(22, 163, 74, 0.15)",
  },
  buyerOptionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.text,
  },
  buyerOptionSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  typeChipTextActive: { color: "#fff" },
  quickDates: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  quickDateBtn: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  quickDateText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.info,
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    padding: 14,
  },
  textArea: {
    minHeight: 100,
  },
  templateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.cardBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  templateName: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.text,
  },
  templatePreview: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
});
