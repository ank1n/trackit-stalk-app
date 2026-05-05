import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchPages, type TPage } from "../../lib/api";
import { t, getLang } from "../../lib/i18n";

type Tab = "public" | "private" | "archived";

export default function PagesListScreen() {
  const { projectId, name, identifier } = useLocalSearchParams<{ projectId: string; name: string; identifier: string }>();
  const [pages, setPages] = useState<TPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("public");

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await fetchPages(projectId);
      setPages(data);
    } catch (e) {
      console.error("Pages load failed:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const locale = getLang() === "ru" ? "ru-RU" : "en-US";

  // Filter by tab: access=0 = public, access=1 = private, archived_at != null
  const filtered = pages.filter((p) => {
    if (tab === "archived") return !!p.archived_at;
    if (p.archived_at) return false; // exclude archived from other tabs
    if (tab === "public") return (p.access ?? 0) === 0;
    return (p.access ?? 0) === 1;
  }).sort((a, b) => (b.updated_at ?? "") > (a.updated_at ?? "") ? 1 : -1);

  // Build tree: group children under parents
  const rootPages = filtered.filter((p) => !p.parent);
  const childrenByParent: Record<string, TPage[]> = {};
  for (const p of filtered) {
    if (p.parent) {
      if (!childrenByParent[p.parent]) childrenByParent[p.parent] = [];
      childrenByParent[p.parent].push(p);
    }
  }

  // Flatten into display list with indent level
  type DisplayPage = TPage & { _indent: number };
  const displayList: DisplayPage[] = [];
  for (const p of rootPages) {
    displayList.push({ ...p, _indent: 0 });
    const children = childrenByParent[p.id];
    if (children) {
      for (const c of children) {
        displayList.push({ ...c, _indent: 1 });
      }
    }
  }
  // Add orphaned children (parent not in filtered list)
  for (const p of filtered) {
    if (p.parent && !displayList.find((d) => d.id === p.id)) {
      displayList.push({ ...p, _indent: 1 });
    }
  }

  const countPublic = pages.filter((p) => !p.archived_at && (p.access ?? 0) === 0).length;
  const countPrivate = pages.filter((p) => !p.archived_at && (p.access ?? 0) === 1).length;
  const countArchived = pages.filter((p) => !!p.archived_at).length;

  return (
    <>
      <Stack.Screen options={{ title: `${identifier || ""} — ${t("projects.pages")}`, headerBackTitle: t("issue.back") }} />
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#4A7BF7" /></View>
      ) : (
        <View style={s.container}>
          {/* Tabs */}
          <View style={s.tabRow}>
            <TouchableOpacity style={[s.tab, tab === "public" && s.tabActive]} onPress={() => setTab("public")}>
              <Text style={[s.tabText, tab === "public" && s.tabTextActive]}>Public ({countPublic})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.tab, tab === "private" && s.tabActive]} onPress={() => setTab("private")}>
              <Text style={[s.tabText, tab === "private" && s.tabTextActive]}>Private ({countPrivate})</Text>
            </TouchableOpacity>
            {countArchived > 0 && (
              <TouchableOpacity style={[s.tab, tab === "archived" && s.tabActive]} onPress={() => setTab("archived")}>
                <Text style={[s.tabText, tab === "archived" && s.tabTextActive]}>Archived ({countArchived})</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={displayList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#4A7BF7" />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.card, { marginLeft: item._indent * 24 }]}
                onPress={() => router.push(`/page/${item.id}?projectId=${projectId}&name=${encodeURIComponent(item.name)}`)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item._indent > 0 ? "document-outline" : "document-text-outline"}
                  size={20}
                  color={item._indent > 0 ? "#8E8E93" : "#4A7BF7"}
                />
                <View style={s.cardContent}>
                  <Text style={[s.pageName, item.archived_at && s.archivedName]} numberOfLines={2}>{item.name}</Text>
                  <Text style={s.pageMeta}>
                    {new Date(item.updated_at).toLocaleDateString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="document-outline" size={48} color="#C7C7CC" />
                <Text style={s.emptyText}>{t("projects.noPages")}</Text>
              </View>
            }
          />
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  tabRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  tabActive: { backgroundColor: "#4A7BF7" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#8E8E93" },
  tabTextActive: { color: "#fff" },
  list: { padding: 16, gap: 6 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, backgroundColor: "#fff", borderRadius: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardContent: { flex: 1 },
  pageName: { fontSize: 15, fontWeight: "600", color: "#1A1A1A", lineHeight: 21 },
  archivedName: { color: "#8E8E93", textDecorationLine: "line-through" },
  pageMeta: { fontSize: 12, color: "#8E8E93", marginTop: 3 },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 15, color: "#C7C7CC", marginTop: 12 },
});
