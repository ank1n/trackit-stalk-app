import { useEffect, useState } from "react";
import { View, Text, Switch, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getCardSettings, saveCardSettings, type CardDisplaySettings } from "../lib/card-settings";
import { t } from "../lib/i18n";

const FIELDS: { key: keyof CardDisplaySettings; labelKey: string; icon: string }[] = [
  { key: "showLabels", labelKey: "cardSettings.labels", icon: "pricetag-outline" },
  { key: "showPriority", labelKey: "cardSettings.priority", icon: "flag-outline" },
  { key: "showAssignees", labelKey: "cardSettings.assignees", icon: "people-outline" },
  { key: "showDueDate", labelKey: "cardSettings.dueDate", icon: "calendar-outline" },
  { key: "showId", labelKey: "cardSettings.id", icon: "code-outline" },
  { key: "showAttachments", labelKey: "cardSettings.attachments", icon: "attach-outline" },
  { key: "showCoverImage", labelKey: "cardSettings.coverImage", icon: "image-outline" },
];

export default function CardSettingsScreen() {
  const [settings, setSettings] = useState<CardDisplaySettings | null>(null);

  useEffect(() => {
    getCardSettings().then(setSettings);
  }, []);

  const toggle = async (key: keyof CardDisplaySettings) => {
    if (!settings) return;
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    await saveCardSettings(updated);
  };

  if (!settings) return null;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerBackTitle: t("issue.back"), title: t("cardSettings.title") }} />
      <View style={s.container}>
        <Text style={s.hint}>{t("cardSettings.hint")}</Text>

        <View style={s.section}>
          {FIELDS.map((field) => (
            <View key={field.key} style={s.row}>
              <Ionicons name={field.icon as any} size={20} color="#8E8E93" />
              <Text style={s.rowLabel}>{t(field.labelKey)}</Text>
              <Switch
                value={settings[field.key]}
                onValueChange={() => toggle(field.key)}
                trackColor={{ true: "#4A7BF7", false: "#E5E5EA" }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        <Text style={s.note}>{t("cardSettings.note")}</Text>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA", paddingTop: 16 },
  hint: { fontSize: 14, color: "#8E8E93", paddingHorizontal: 16, marginBottom: 16, lineHeight: 20 },
  section: { backgroundColor: "#fff", borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: "#E5E5EA" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: "#E5E5EA",
  },
  rowLabel: { flex: 1, fontSize: 16, color: "#1A1A1A" },
  note: { fontSize: 13, color: "#C7C7CC", paddingHorizontal: 16, marginTop: 12 },
});
