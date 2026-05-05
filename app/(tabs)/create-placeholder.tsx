import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { fetchProjects, fetchIssues, type TProject, type TIssue } from "../../lib/api";

export default function CreateTabScreen() {
  const { userId } = useAuth();
  const [myCreated, setMyCreated] = useState<(TIssue & { projectIdentifier: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const projects = await fetchProjects();
      const all: (TIssue & { projectIdentifier: string })[] = [];
      for (const proj of projects.slice(0, 6)) {
        try {
          const issues = await fetchIssues(proj.id);
          const mine = issues.filter((i) => i.created_at && (i as any).created_by === userId);
          // Fallback: if created_by not in response, show recent issues
          const recent = mine.length > 0 ? mine : issues.slice(0, 5);
          for (const issue of recent) {
            all.push({ ...issue, projectIdentifier: proj.identifier });
          }
        } catch { continue; }
      }
      setMyCreated(all.sort((a, b) => (b.created_at ?? "") > (a.created_at ?? "") ? 1 : -1).slice(0, 20));
    } catch (e) { console.error("Create tab:", e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const timeAgo = (d?: string) => {
    if (!d) return "";
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}м`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}ч`;
    return `${Math.floor(h / 24)}д`;
  };

  return (
    <View style={s.container}>
      {/* Create button */}
      <TouchableOpacity style={s.createBtn} onPress={() => router.push("/issue/create")} activeOpacity={0.8}>
        <Ionicons name="add-circle" size={22} color="#fff" />
        <Text style={s.createText}>Создать задачу</Text>
      </TouchableOpacity>

      {/* Recent issues */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#4A7BF7" /></View>
      ) : (
        <FlatList
          data={myCreated}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#4A7BF7" />}
          ListHeaderComponent={<Text style={s.sectionTitle}>НЕДАВНИЕ</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => router.push(`/issue/${item.id}?projectId=${item.project || ""}&identifier=${item.projectIdentifier}`)}
              activeOpacity={0.7}
            >
              <View style={s.cardContent}>
                <Text style={s.cardId}>{item.projectIdentifier}-{item.sequence_id ?? 0}</Text>
                <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
                <View style={s.cardMeta}>
                  <Ionicons name="flag" size={10} color={prioColor(item.priority)} />
                  <Text style={[s.cardPrio, { color: prioColor(item.priority) }]}>{item.priority || "none"}</Text>
                  <Text style={s.cardTime}>{timeAgo(item.created_at)} назад</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="document-text-outline" size={48} color="#C7C7CC" />
              <Text style={s.emptyText}>Нет задач</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function prioColor(p?: string): string {
  switch (p) { case "urgent": return "#EF4444"; case "high": return "#F97316"; case "medium": return "#EAB308"; case "low": return "#3B82F6"; default: return "#9CA3AF"; }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  createBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginHorizontal: 16, marginTop: 12, paddingVertical: 16,
    backgroundColor: "#4A7BF7", borderRadius: 14,
  },
  createText: { fontSize: 17, fontWeight: "600", color: "#fff" },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#8E8E93", marginTop: 16, marginBottom: 8, letterSpacing: 0.5 },
  card: {
    padding: 14, backgroundColor: "#fff", borderRadius: 12, marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardContent: { gap: 3 },
  cardId: { fontSize: 12, fontWeight: "600", color: "#8E8E93" },
  cardName: { fontSize: 15, fontWeight: "500", color: "#1A1A1A", lineHeight: 21 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  cardPrio: { fontSize: 12, fontWeight: "500" },
  cardTime: { fontSize: 12, color: "#C7C7CC" },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 15, color: "#C7C7CC", marginTop: 12 },
});
