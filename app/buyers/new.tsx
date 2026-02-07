import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";

export default function NewBuyerScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/buyers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buyers"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: () => {
      Alert.alert("Error", "Failed to create buyer. Phone number may already exist.");
    },
  });

  function handleSave() {
    if (!phone.trim()) {
      Alert.alert("Required", "Phone number is required");
      return;
    }
    createMutation.mutate({
      name: name.trim() || null,
      phone: phone.trim(),
      notes: notes.trim() || null,
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Buyer</Text>
        <Pressable
          onPress={handleSave}
          disabled={createMutation.isPending}
          style={[styles.saveBtn, createMutation.isPending && { opacity: 0.5 }]}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="checkmark" size={24} color="#fff" />
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone *</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="555-0100" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" autoFocus />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Buyer name (optional)" placeholderTextColor={Colors.textMuted} />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Notes</Text>
          <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: "top" as const }]} value={notes} onChangeText={setNotes} placeholder="Notes..." placeholderTextColor={Colors.textMuted} multiline />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },
  saveBtn: { backgroundColor: Colors.primary, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  fieldGroup: { marginBottom: 16 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.textSecondary, marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: Colors.inputBg, borderRadius: 12, padding: 14, fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.inputBorder },
});
