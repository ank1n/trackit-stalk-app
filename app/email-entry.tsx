import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { checkEmailIsMember, requestCode } from "../lib/portal-api";
import { colors } from "../lib/theme";
import { t } from "../lib/i18n";
import * as SecureStore from "expo-secure-store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MODE_KEY = "trackit_app_mode";

export default function EmailEntryScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert(t("common.error"), t("portal.enterEmail"));
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      Alert.alert(t("common.error"), t("portal.invalidEmail"));
      return;
    }

    setLoading(true);
    try {
      const isMember = await checkEmailIsMember(trimmed);

      if (isMember) {
        // Plane member → Keycloak login
        await SecureStore.setItemAsync(MODE_KEY, "pm");
        router.replace({ pathname: "/(auth)/login", params: { email: trimmed } });
      } else {
        // External user → send OTP code
        await SecureStore.setItemAsync(MODE_KEY, "portal");
        await SecureStore.setItemAsync("portal_pending_email", trimmed);
        const result = await requestCode(trimmed);
        if (result.success) {
          router.replace("/(portal)/login-code");
        } else {
          Alert.alert(t("common.error"), result.message || t("portal.codeSendFailed"));
        }
      }
    } catch {
      Alert.alert(t("common.error"), t("portal.codeSendFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={s.content}>
        <View style={s.logoBox}>
          <View style={s.logoIcon}>
            <Text style={s.logoLetter}>T</Text>
          </View>
        </View>
        <Text style={s.title}>TrackIT</Text>
        <Text style={s.subtitle}>Введите email для входа</Text>

        <View style={s.form}>
          <View style={[s.inputBox, email.length > 0 && !EMAIL_RE.test(email.trim()) && { borderColor: "#EF4444" }]}>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t("login.email")}
              placeholderTextColor="#C7C7CC"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="go"
              onSubmitEditing={handleContinue}
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[s.button, loading && { opacity: 0.6 }]}
            onPress={handleContinue}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.buttonText}>{t("common.continue") || "Продолжить"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  logoBox: { alignItems: "center", marginBottom: 16 },
  logoIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: "#1C1C1E", justifyContent: "center", alignItems: "center",
  },
  logoLetter: { fontSize: 36, fontWeight: "800", color: "#fff", letterSpacing: -2 },
  title: { fontSize: 32, fontWeight: "800", color: "#1A1A1A", textAlign: "center", letterSpacing: -1 },
  subtitle: { fontSize: 16, color: "#8E8E93", textAlign: "center", marginBottom: 40 },
  form: { gap: 14 },
  inputBox: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E5EA",
  },
  input: {
    paddingHorizontal: 18, paddingVertical: 16,
    fontSize: 17, color: "#1A1A1A",
  },
  button: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 18, alignItems: "center", marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
