import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { t, getLang, setLang, type Lang } from "../../lib/i18n";

export default function ProfileScreen() {
  const { logout, userName } = useAuth();
  const [lang, setLangState] = useState<Lang>(getLang());

  const handleLogout = () => {
    Alert.alert(t("profile.logout"), t("profile.logoutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("profile.logout"), style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
    ]);
  };

  const toggleLang = async () => {
    const next: Lang = lang === "ru" ? "en" : "ru";
    await setLang(next);
    setLangState(next);
    router.replace("/(tabs)/profile");
  };

  return (
    <View style={s.container}>
      <View style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.avatarLetter}>{(userName || "U").charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={s.userName}>{userName || "User"}</Text>
        <Text style={s.serverText}>trackit.implica.ru</Text>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>{t("profile.connection")}</Text>
        <View style={s.row}>
          <Ionicons name="server-outline" size={20} color="#8E8E93" />
          <Text style={s.rowLabel}>{t("profile.server")}</Text>
          <View style={{ flex: 1 }} />
          <View style={s.statusDot} />
          <Text style={s.rowValue}>{t("profile.connected")}</Text>
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>{t("profile.display")}</Text>
        <TouchableOpacity style={s.row} onPress={() => router.push("/card-settings")}>
          <Ionicons name="card-outline" size={20} color="#8E8E93" />
          <Text style={s.rowLabel}>{t("profile.cardView")}</Text>
          <View style={{ flex: 1 }} />
          <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
        </TouchableOpacity>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>{t("profile.app")}</Text>
        <View style={s.row}>
          <Ionicons name="moon-outline" size={20} color="#8E8E93" />
          <Text style={s.rowLabel}>{t("profile.theme")}</Text>
          <View style={{ flex: 1 }} />
          <Text style={s.rowValue}>{t("profile.themeSystem")}</Text>
        </View>
        <TouchableOpacity style={[s.row, { borderTopWidth: 0.5, borderTopColor: "#E5E5EA" }]} onPress={toggleLang}>
          <Ionicons name="language-outline" size={20} color="#8E8E93" />
          <Text style={s.rowLabel}>{t("profile.language")}</Text>
          <View style={{ flex: 1 }} />
          <Text style={s.rowValue}>{lang === "ru" ? "Русский" : "English"}</Text>
          <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
        </TouchableOpacity>
        <View style={[s.row, { borderTopWidth: 0.5, borderTopColor: "#E5E5EA" }]}>
          <Ionicons name="information-circle-outline" size={20} color="#8E8E93" />
          <Text style={s.rowLabel}>{t("profile.version")}</Text>
          <View style={{ flex: 1 }} />
          <Text style={s.rowValue}>1.0.0</Text>
        </View>
      </View>

      <TouchableOpacity style={s.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
        <Text style={s.logoutText}>{t("profile.logout")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  avatarSection: { alignItems: "center", paddingVertical: 28, backgroundColor: "#fff" },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: "#4A7BF7",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  avatarLetter: { fontSize: 28, fontWeight: "700", color: "#fff" },
  userName: { fontSize: 20, fontWeight: "700", color: "#1A1A1A" },
  serverText: { fontSize: 13, color: "#8E8E93", marginTop: 4 },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 12, fontWeight: "600", color: "#8E8E93", paddingHorizontal: 16, marginBottom: 6, letterSpacing: 0.8 },
  row: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    paddingHorizontal: 16, paddingVertical: 15, gap: 12,
  },
  rowLabel: { fontSize: 16, color: "#1A1A1A" },
  rowValue: { fontSize: 15, color: "#8E8E93" },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#34C759" },
  logoutButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 16, marginHorizontal: 16, marginTop: 36,
    backgroundColor: "#fff", borderRadius: 14,
  },
  logoutText: { fontSize: 17, color: "#FF3B30", fontWeight: "600" },
});
