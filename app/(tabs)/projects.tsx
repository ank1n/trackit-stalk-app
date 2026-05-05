import { useEffect, useState, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchProjects, fetchIssues, fetchStates, fetchLabels, issueStateId,
  type TProject, type TState, type TIssue, type TLabel,
} from "../../lib/api";

const ACCESSIBLE_PROJECTS_KEY = "trackit_accessible_projects";
const VISITED_PROJECTS_KEY = "trackit_visited_projects";
const PROJECT_STATS_KEY = "trackit_project_stats";
const PINNED_PROJECTS_KEY = "trackit_pinned_projects";
import { t } from "../../lib/i18n";
import { useAuth } from "../../lib/auth-context";
import { KanbanBoard } from "../../lib/kanban-board";

const STATE_GROUP_ORDER = ["backlog", "unstarted", "started", "completed", "cancelled"];

function sortProjects(
  projects: TProject[],
  visitedOrder: string[],
  pinnedIds: Set<string>,
  stats?: Record<string, { total: number; done: number; inProgress: number }>,
): TProject[] {
  return [...projects].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id);
    const bPinned = pinnedIds.has(b.id);
    // Pinned first
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    // Within same pin group: visited first
    const aIdx = visitedOrder.indexOf(a.id);
    const bIdx = visitedOrder.indexOf(b.id);
    if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
    if (aIdx >= 0) return -1;
    if (bIdx >= 0) return 1;
    // Then by activity
    if (stats) {
      const aAct = (stats[a.id]?.inProgress ?? 0) + (stats[a.id]?.total ?? 0);
      const bAct = (stats[b.id]?.inProgress ?? 0) + (stats[b.id]?.total ?? 0);
      return bAct - aAct;
    }
    return a.name.localeCompare(b.name);
  });
}
type Column = { state: TState; issues: TIssue[] };

export default function ProjectsScreen() {
  const { userId } = useAuth();
  const navigation = useNavigation();

  // === List state ===
  const [projects, setProjects] = useState<TProject[]>([]);
  const [projectStats, setProjectStats] = useState<Record<string, { total: number; done: number; inProgress: number }>>({});
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const visitedOrderRef = useRef<string[]>([]);

  // === Active project (kanban mode) ===
  const [activeProject, setActiveProject] = useState<TProject | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [labels, setLabels] = useState<Record<string, TLabel>>({});
  const [labelOrder, setLabelOrder] = useState<string[]>([]);
  const [kanbanLoading, setKanbanLoading] = useState(false);

  // Load projects list
  const loadList = useCallback(async () => {
    try {
      const data = await fetchProjects();
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));

      // Load cached data — show instantly
      const [cachedRaw, visitedRaw, statsRaw, pinnedRaw] = await Promise.all([
        AsyncStorage.getItem(ACCESSIBLE_PROJECTS_KEY).catch(() => null),
        AsyncStorage.getItem(VISITED_PROJECTS_KEY).catch(() => null),
        AsyncStorage.getItem(PROJECT_STATS_KEY).catch(() => null),
        AsyncStorage.getItem(PINNED_PROJECTS_KEY).catch(() => null),
      ]);
      const cachedIds: Set<string> = cachedRaw ? new Set(JSON.parse(cachedRaw)) : new Set(sorted.map((p) => p.id));
      const visitedOrder: string[] = visitedRaw ? JSON.parse(visitedRaw) : [];
      const pinned: Set<string> = pinnedRaw ? new Set(JSON.parse(pinnedRaw)) : new Set();
      setPinnedIds(pinned);
      visitedOrderRef.current = visitedOrder;
      // Show cached stats immediately
      if (statsRaw) {
        try { setProjectStats(JSON.parse(statsRaw)); } catch {}
      }
      setProjects(sortProjects(sorted.filter((p) => cachedIds.has(p.id)), visitedOrder, pinned));
      setLoading(false);

      // Check access in background — update list if changed
      const accessResults = await Promise.allSettled(
        sorted.map(async (proj) => {
          const [issues, states] = await Promise.all([fetchIssues(proj.id), fetchStates(proj.id)]);
          if (!states || states.length === 0) return null;
          const stateMap: Record<string, TState> = {};
          for (const st of states) stateMap[st.id] = st;
          const done = issues.filter((i) => stateMap[issueStateId(i)]?.group === "completed").length;
          const inProg = issues.filter((i) => stateMap[issueStateId(i)]?.group === "started").length;
          return { id: proj.id, total: issues.length, done, inProgress: inProg };
        })
      );
      const stats: Record<string, { total: number; done: number; inProgress: number }> = {};
      const accessibleIds: string[] = [];
      for (const r of accessResults) {
        if (r.status === "fulfilled" && r.value) {
          stats[r.value.id] = r.value;
          accessibleIds.push(r.value.id);
        }
      }
      // Update list and cache — sort by visits + activity
      const accessSet = new Set(accessibleIds);
      const accessible = sorted.filter((p) => accessSet.has(p.id));
      setProjects(sortProjects(accessible, visitedOrder, pinned, stats));
      setProjectStats(stats);
      await Promise.all([
        AsyncStorage.setItem(ACCESSIBLE_PROJECTS_KEY, JSON.stringify(accessibleIds)),
        AsyncStorage.setItem(PROJECT_STATS_KEY, JSON.stringify(stats)),
      ]).catch(() => {});
    } catch (e) {
      console.error("Projects load:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load kanban for active project
  const loadKanban = useCallback(async (projectId: string) => {
    setKanbanLoading(true);
    try {
      const [issueData, stateData, labelData] = await Promise.all([
        fetchIssues(projectId), fetchStates(projectId), fetchLabels(projectId),
      ]);

      const lm: Record<string, TLabel> = {};
      const lo: string[] = [];
      for (const l of labelData) { lm[l.id] = l; lo.push(l.id); }
      setLabels(lm);
      setLabelOrder(lo);

      const sorted = [...stateData].sort((a, b) => {
        const ga = STATE_GROUP_ORDER.indexOf(a.group);
        const gb = STATE_GROUP_ORDER.indexOf(b.group);
        return ga !== gb ? ga - gb : (a.sequence ?? 0) - (b.sequence ?? 0);
      });

      setColumns(sorted.map((state) => ({
        state,
        issues: issueData
          .filter((i) => issueStateId(i) === state.id)
          .sort((a, b) => (b.created_at ?? "") > (a.created_at ?? "") ? 1 : -1),
      })));
    } catch (e) {
      console.error("Kanban load failed:", e);
    } finally {
      setKanbanLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // Update header based on mode
  useEffect(() => {
    if (activeProject) {
      navigation.setOptions({
        headerTitle: activeProject.name,
        headerLeft: () => (
          <TouchableOpacity onPress={() => setActiveProject(null)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="chevron-back" size={24} color="#4A7BF7" />
            <Text style={{ color: "#4A7BF7", fontSize: 16 }}>{t("issue.back")}</Text>
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({
        headerTitle: t("projects.title"),
        headerLeft: undefined,
      });
    }
  }, [activeProject, navigation]);

  const openProject = async (project: TProject) => {
    setActiveProject(project);
    loadKanban(project.id);
    // Save to visit history (most recent first, max 10)
    try {
      const raw = await AsyncStorage.getItem(VISITED_PROJECTS_KEY);
      const history: string[] = raw ? JSON.parse(raw) : [];
      const updated = [project.id, ...history.filter((id) => id !== project.id)].slice(0, 10);
      await AsyncStorage.setItem(VISITED_PROJECTS_KEY, JSON.stringify(updated));
    } catch {}
  };

  const togglePin = useCallback((projectId: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      AsyncStorage.setItem(PINNED_PROJECTS_KEY, JSON.stringify([...next])).catch(() => {});
      setProjects((curr) => sortProjects(curr, visitedOrderRef.current, next, projectStats));
      return next;
    });
  }, [projectStats]);

  // Bump refresh key when tab gets focus (e.g. returning from issue detail)
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []));

  // === KANBAN MODE ===
  if (activeProject) {
    if (kanbanLoading) {
      return <View style={s.center}><ActivityIndicator size="large" color="#4A7BF7" /></View>;
    }
    return (
      <KanbanBoard
        columns={columns}
        labels={labels}
        labelOrder={labelOrder}
        projectId={activeProject.id}
        projectIdentifier={activeProject.identifier}
        onIssuePress={(issue) => router.push(`/issue/${issue.id}?projectId=${activeProject.id}&identifier=${activeProject.identifier}`)}
        onRefresh={() => { loadKanban(activeProject.id); setRefreshKey((k) => k + 1); }}
        onColumnsChange={setColumns}
        userId={userId}
        refreshKey={refreshKey}
      />
    );
  }

  // === LIST MODE ===
  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#4A7BF7" /></View>;
  }

  return (
    <FlatList
      data={projects}
      keyExtractor={(item) => item.id}
      contentContainerStyle={s.list}
      style={{ backgroundColor: "#FAFAFA" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadList(); }} tintColor="#4A7BF7" />}
      renderItem={({ item }) => {
        const stat = projectStats[item.id];
        const isPinned = pinnedIds.has(item.id);
        return (
          <TouchableOpacity
            style={[s.card, isPinned && s.cardPinned]}
            onPress={() => openProject(item)}
            onLongPress={() => {
              Alert.alert(
                item.name,
                undefined,
                [
                  { text: isPinned ? t("projects.unpin") : t("projects.pin"), onPress: () => togglePin(item.id) },
                  { text: t("kanban.cancel"), style: "cancel" },
                ],
              );
            }}
            activeOpacity={0.7}
          >
            <View style={s.emojiBox}>
              <Text style={s.emoji}>{item.emoji || item.identifier.charAt(0)}</Text>
            </View>
            <View style={s.cardContent}>
              <View style={s.cardTop}>
                {isPinned && <Ionicons name="pin" size={12} color="#4A7BF7" style={{ marginRight: 2 }} />}
                <Text style={s.identifier}>{item.identifier}</Text>
                {item.inbox_view && (
                  <View style={s.intakeBadge}>
                    <Ionicons name="mail" size={10} color="#4A7BF7" />
                  </View>
                )}
              </View>
              <Text style={s.name} numberOfLines={1}>{item.name}</Text>
              {stat && (
                <View style={s.statsRow}>
                  <Text style={s.statText}>{stat.total} {t("projects.tasks")}</Text>
                  <View style={s.statDot} />
                  <Text style={[s.statText, { color: "#F59E0B" }]}>{stat.inProgress} {t("projects.inProgress")}</Text>
                  <View style={s.statDot} />
                  <Text style={[s.statText, { color: "#22C55E" }]}>{stat.done} {t("projects.done")}</Text>
                </View>
              )}
            </View>
            <View style={s.cardActions}>
              <TouchableOpacity
                style={s.pagesBtn}
                onPress={() => router.push(`/pages/${item.id}?name=${encodeURIComponent(item.name)}&identifier=${item.identifier}`)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="document-text-outline" size={16} color="#8E8E93" />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={s.center}>
          <Ionicons name="folder-open-outline" size={48} color="#C7C7CC" />
          <Text style={{ fontSize: 15, color: "#C7C7CC", marginTop: 12 }}>{t("projects.empty")}</Text>
        </View>
      }
    />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 14, padding: 16, gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardPinned: {
    borderLeftWidth: 3, borderLeftColor: "#4A7BF7",
  },
  emojiBox: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: "#F2F2F7",
    justifyContent: "center", alignItems: "center",
  },
  emoji: { fontSize: 22 },
  cardContent: { flex: 1, gap: 2 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  identifier: { fontSize: 12, fontWeight: "600", color: "#8E8E93", letterSpacing: 0.5 },
  intakeBadge: { padding: 2 },
  name: { fontSize: 17, fontWeight: "600", color: "#1A1A1A" },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  statText: { fontSize: 11, color: "#8E8E93" },
  statDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#D1D5DB" },
  cardActions: { alignItems: "center", gap: 10 },
  pagesBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: "#F2F2F7",
    justifyContent: "center", alignItems: "center",
  },
});
