import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  useWindowDimensions, TouchableOpacity, Alert,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import RenderHtml from "react-native-render-html";
import { fetchPage, updatePage, type TPage } from "../../lib/api";
import { t, getLang } from "../../lib/i18n";
import { RichEditor } from "../../lib/rich-editor";

const tagsStyles = {
  body: { color: "#374151", fontSize: 15, lineHeight: 24 },
  h1: { fontSize: 24, fontWeight: "700" as const, color: "#1A1A1A", marginTop: 20, marginBottom: 8 },
  h2: { fontSize: 20, fontWeight: "700" as const, color: "#1A1A1A", marginTop: 20, marginBottom: 8 },
  h3: { fontSize: 17, fontWeight: "700" as const, color: "#1A1A1A", marginTop: 14, marginBottom: 6 },
  h4: { fontSize: 15, fontWeight: "700" as const, color: "#1A1A1A", marginTop: 12, marginBottom: 4 },
  p: { marginBottom: 8 },
  li: { marginBottom: 4 },
  strong: { fontWeight: "700" as const },
  em: { fontStyle: "italic" as const },
  code: { fontFamily: "Courier", fontSize: 13, backgroundColor: "#F3F4F6", color: "#DC2626", paddingHorizontal: 4 },
  pre: { backgroundColor: "#F3F4F6", padding: 12, borderRadius: 8, marginVertical: 8 },
  blockquote: { borderLeftWidth: 3, borderLeftColor: "#4A7BF7", paddingLeft: 12, marginVertical: 8, color: "#6B7280" },
  hr: { borderBottomWidth: 1, borderBottomColor: "#E5E7EB", marginVertical: 16 },
  table: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, marginVertical: 12 },
  th: { backgroundColor: "#F9FAFB", padding: 8, fontWeight: "700" as const, fontSize: 13 },
  td: { padding: 8, borderTopWidth: 1, borderTopColor: "#E5E7EB", fontSize: 13 },
  a: { color: "#4A7BF7", textDecorationLine: "none" as const },
};

export default function PageDetailScreen() {
  const { id, projectId, name } = useLocalSearchParams<{ id: string; projectId: string; name: string }>();
  const [page, setPage] = useState<TPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftHtml, setDraftHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const { width } = useWindowDimensions();

  const load = useCallback(async () => {
    if (!id || !projectId) return;
    try {
      const data = await fetchPage(projectId, id);
      setPage(data);
    } catch (e) {
      console.error("Page load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [id, projectId]);

  useEffect(() => { load(); }, [load]);

  const locale = getLang() === "ru" ? "ru-RU" : "en-US";

  const startEdit = () => {
    setDraftHtml(page?.description_html ?? "");
    setEditing(true);
  };

  const save = async () => {
    if (!projectId || !id) return;
    setSaving(true);
    try {
      const updated = await updatePage(projectId, id, { description_html: draftHtml });
      setPage(updated);
      setEditing(false);
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: name || page?.name || "",
          headerBackTitle: t("issue.back"),
          headerRight: () =>
            editing ? (
              <View style={{ flexDirection: "row", gap: 4 }}>
                <TouchableOpacity style={{ padding: 8 }} onPress={() => setEditing(false)} disabled={saving}>
                  <Ionicons name="close" size={22} color="#8E8E93" />
                </TouchableOpacity>
                <TouchableOpacity style={{ padding: 8 }} onPress={save} disabled={saving}>
                  <Ionicons name="checkmark" size={22} color={saving ? "#C7C7CC" : "#22C55E"} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={{ padding: 8 }} onPress={startEdit}>
                <Ionicons name="create-outline" size={22} color="#4A7BF7" />
              </TouchableOpacity>
            ),
        }}
      />
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#4A7BF7" /></View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
          <Text style={s.title}>{page?.name}</Text>
          {page?.updated_at && (
            <Text style={s.meta}>
              {new Date(page.updated_at).toLocaleDateString(locale, {
                day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </Text>
          )}
          <View style={s.divider} />
          {editing ? (
            <RichEditor
              valueHtml={draftHtml}
              onChangeHtml={setDraftHtml}
              minHeight={300}
              autoFocus
            />
          ) : page?.description_html ? (
            <RenderHtml
              contentWidth={width - 40}
              source={{ html: page.description_html }}
              tagsStyles={tagsStyles}
              enableExperimentalBRCollapsing
              enableExperimentalGhostLinesPrevention
              enableExperimentalMarginCollapsing
            />
          ) : (
            <Text style={s.emptyBody}>—</Text>
          )}
        </ScrollView>
      )}
    </>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },
  scroll: { flex: 1, backgroundColor: "#FAFAFA" },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#1A1A1A", lineHeight: 30 },
  meta: { fontSize: 13, color: "#8E8E93", marginTop: 6 },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 16 },
  emptyBody: { fontSize: 15, color: "#C7C7CC", fontStyle: "italic" },
});
