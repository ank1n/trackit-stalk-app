import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { usePortalAuth } from "../../lib/portal-auth-context";
import { colors } from "../../lib/theme";
import { t } from "../../lib/i18n";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PortalLoginEmailScreen() {
  const { sendCode, setPendingEmail } = usePortalAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
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
    const result = await sendCode(trimmed);
    setLoading(false);
    if (result.ok) {
      setPendingEmail(trimmed);
      router.push("/(portal)/login-code");
    } else {
      Alert.alert(t("common.error"), result.error || t("portal.codeSendFailed"));
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
        <Text style={s.subtitle}>{t("portal.title")}</Text>

        <View style={s.form}>
          <Text style={s.label}>{t("portal.emailHint")}</Text>
          <View style={s.inputBox}>
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
              onSubmitEditing={handleSend}
            />
          </View>

          <TouchableOpacity
            style={[s.button, loading && { opacity: 0.6 }]}
            onPress={handleSend}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.buttonText}>{t("portal.sendCode")}</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.back()} style={s.backLink}>
          <Text style={s.backText}>{t("portal.backToLogin")}</Text>
        </TouchableOpacity>
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
  label: { fontSize: 14, color: colors.textSecondary, marginBottom: 2 },
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
  backLink: { alignItems: "center", marginTop: 24 },
  backText: { fontSize: 15, color: colors.primary },
});
