import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";

export default function LoginScreen() {
  const { user, isLoading, login } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (user) {
    setTimeout(() => router.replace("/(tabs)"), 0);
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password");
      return;
    }
    setError("");
    setLoggingIn(true);
    try {
      await login(email.trim(), password.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err?.message || "";
      if (msg.includes("401")) {
        setError("Invalid email or password");
      } else if (msg.includes("Network") || msg.includes("fetch") || msg.includes("Failed")) {
        setError("Unable to connect to server. Check your internet connection.");
      } else {
        setError(msg || "Login failed. Please try again.");
      }
    } finally {
      setLoggingIn(false);
    }
  }

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <LinearGradient
      colors={["#0f172a", "#1e293b", "#0f172a"]}
      style={[styles.container, { paddingTop: insets.top + webTopInset }]}
    >
      <View style={styles.logoContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="construct" size={48} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Reliable Turf Tools</Text>
        <Text style={styles.subtitle}>Admin Dashboard</Text>
      </View>

      <View style={styles.form}>
        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="demo@reliable.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={Colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.loginBtn,
            pressed && styles.loginBtnPressed,
            loggingIn && styles.loginBtnDisabled,
          ]}
          onPress={handleLogin}
          disabled={loggingIn}
        >
          {loggingIn ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginBtnText}>Sign In</Text>
          )}
        </Pressable>
      </View>

      <View style={{ height: Platform.OS === "web" ? 34 : insets.bottom + 20 }} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(22, 163, 74, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.textSecondary,
  },
  form: {
    width: "100%",
    maxWidth: 400,
    gap: 20,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.danger,
    flex: 1,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  inputIcon: {
    marginLeft: 16,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.text,
    padding: 16,
    paddingLeft: 12,
  },
  eyeBtn: {
    padding: 16,
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    marginTop: 8,
  },
  loginBtnPressed: {
    backgroundColor: Colors.primaryDark,
    transform: [{ scale: 0.98 }],
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: "#fff",
  },
});
