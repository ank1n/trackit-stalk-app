import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../../lib/auth-context";
import { t } from "../../lib/i18n";

export default function LoginScreen() {
  const { login } = useAuth();
  const { email: paramEmail } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(paramEmail || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t("login.error"), t("login.errorCredentials"));
      return;
    }
    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);
    if (result.ok) {
      await SecureStore.setItemAsync("trackit_app_mode", "pm");
      router.replace("/(tabs)");
    } else {
      Alert.alert(t("login.error"), result.error || t("login.errorFailed"));
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={s.content}>
        {/* Logo */}
        <View style={s.logoBox}>
          <View style={s.logoIcon}>
            <Text style={s.logoLetter}>T</Text>
          </View>
        </View>
        <Text style={s.title}>TrackIT</Text>
        <Text style={s.subtitle}>{paramEmail ? paramEmail : "Project Management"}</Text>

        {/* Form */}
        <View style={s.form}>
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
            />
          </View>
          <View style={s.inputBox}>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t("login.password")}
              placeholderTextColor="#C7C7CC"
              secureTextEntry
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity
            style={[s.button, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.buttonText}>{t("login.button")}</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.replace("/email-entry")} style={{ alignItems: "center", marginTop: 20 }}>
          <Text style={{ fontSize: 15, color: "#4A7BF7" }}>← Другой email</Text>
        </TouchableOpacity>
        <Text style={s.server}>trackit.implica.ru</Text>
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
    backgroundColor: "#4A7BF7", borderRadius: 14,
    paddingVertical: 18, alignItems: "center", marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  server: { textAlign: "center", color: "#C7C7CC", fontSize: 13, marginTop: 24 },
});
