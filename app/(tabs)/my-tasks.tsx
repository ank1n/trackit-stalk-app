import { useEffect, useState, useCallback } from "react";
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../lib/auth-context";
import { fetchProjects, fetchIssues, fetchStates, issueStateId, type TProject, type TIssue, type TState } from "../../lib/api";
import { t } from "../../lib/i18n";
import { SwipeableTaskCard } from "../../lib/swipeable-task-card";

type Mode = "assigned" | "created";
type StatusFilter = "active" | "closed";
type Section = { title: string; identifier: string; projectId: string; data: TIssue[] };

const CLOSED_GROUPS = ["completed", "cancelled"];

export default function MyTasksScreen() {
  const { userId } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [allStates, setAllStates] = useState<Record<string, TState>>({});
  const [mode, setMode] = useState<Mode>("assigned");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const projects = await fetchProjects();
      const stateMap: Record<string, TState> = {};
      const projectSections: Section[] = [];

      const results = await Promise.allSettled(
        projects.slice(0, 10).map(async (proj) => {
          const [issues, states] = await Promise.all([fetchIssues(proj.id), fetchStates(proj.id)]);
          for (const st of states) stateMap[st.id] = st;
          return { proj, issues };
        })
      );

      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const { proj, issues } = r.value;
        // Get ALL my issues (both assigned and created) — filter later in render
        const myIssues = issues.filter((i) =>
          (i.assignee_ids ?? []).includes(userId) || i.created_by === userId
        );
        if (myIssues.length > 0) {
          projectSections.push({
            title: proj.name, identifier: proj.identifier, projectId: proj.id,
            data: myIssues.sort((a, b) => (b.updated_at ?? "") > (a.updated_at ?? "") ? 1 : -1),
          });
        }
      }

      setAllStates(stateMap);
      setSections(projectSections);
    } catch (e) { console.error("My tasks:", e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Filter sections by mode + status
  const filteredSections = sections.map((sec) => ({
    ...sec,
    data: sec.data.filter((issue) => {
      // Mode filter
      if (mode === "assigned" && !(issue.assignee_ids ?? []).includes(userId!)) return false;
      if (mode === "created" && issue.created_by !== userId) return false;

      // Status filter
      const group = allStates[issueStateId(issue)]?.group ?? "";
      if (statusFilter === "active") return !CLOSED_GROUPS.includes(group);
      return CLOSED_GROUPS.includes(group);
    }),
  })).filter((sec) => sec.data.length > 0);

  const totalCount = filteredSections.reduce((sum, sec) => sum + sec.data.length, 0);

  // Counts for badges
  const countByModeAndStatus = (m: Mode, sf: StatusFilter) => {
    let count = 0;
    for (const sec of sections) {
      for (const issue of sec.data) {
        if (m === "assigned" && !(issue.assignee_ids ?? []).includes(userId!)) continue;
        if (m === "created" && issue.created_by !== userId) continue;
        const group = allStates[issueStateId(issue)]?.group ?? "";
        if (sf === "active" && CLOSED_GROUPS.includes(group)) continue;
        if (sf === "closed" && !CLOSED_GROUPS.includes(group)) continue;
        count++;
      }
    }
    return count;
  };

  const assignedCount = countByModeAndStatus("assigned", statusFilter);
  const createdCount = countByModeAndStatus("created", statusFilter);
  const activeCount = countByModeAndStatus(mode, "active");
  const closedCount = countByModeAndStatus(mode, "closed");

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#4A7BF7" /></View>;
  }

  return (
    <View style={s.container}>
      {/* Mode toggle */}
      <View style={s.modeRow}>
        <TouchableOpacity
          style={[s.modeBtn, mode === "assigned" && s.modeBtnActive]}
          onPress={() => setMode("assigned")}
        >
          <Ionicons name="person" size={14} color={mode === "assigned" ? "#fff" : "#8E8E93"} />
          <Text style={[s.modeBtnText, mode === "assigned" && s.modeBtnTextActive]}>{t("myTasks.assigned")}</Text>
          <View style={[s.badge, mode === "assigned" && s.badgeActive]}>
            <Text style={[s.badgeText, mode === "assigned" && s.badgeTextActive]}>{assignedCount}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.modeBtn, mode === "created" && s.modeBtnActive]}
          onPress={() => setMode("created")}
        >
          <Ionicons name="create" size={14} color={mode === "created" ? "#fff" : "#8E8E93"} />
          <Text style={[s.modeBtnText, mode === "created" && s.modeBtnTextActive]}>{t("myTasks.created")}</Text>
          <View style={[s.badge, mode === "created" && s.badgeActive]}>
            <Text style={[s.badgeText, mode === "created" && s.badgeTextActive]}>{createdCount}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Status filter */}
      <View style={s.filterRow}>
        <TouchableOpacity
          style={[s.pill, statusFilter === "active" && s.pillActive]}
          onPress={() => setStatusFilter("active")}
        >
          <Text style={[s.pillText, statusFilter === "active" && s.pillTextActive]}>
            {t("myTasks.active")} ({activeCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.pill, statusFilter === "closed" && s.pillActive]}
          onPress={() => setStatusFilter("closed")}
        >
          <Text style={[s.pillText, statusFilter === "closed" && s.pillTextActive]}>
            {t("myTasks.closed")} ({closedCount})
          </Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={filteredSections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#4A7BF7" />}
        renderSectionHeader={({ section }) => (
          <Text style={s.sectionTitle}>{section.identifier} — {section.title}</Text>
        )}
        renderItem={({ item, section }) => (
          <SwipeableTaskCard
            issue={item}
            state={allStates[issueStateId(item)]}
            projectId={section.projectId}
            identifier={section.identifier}
            allStates={allStates}
            userId={userId ?? undefined}
            onPress={() => router.push(`/issue/${item.id}?projectId=${section.projectId}&identifier=${section.identifier}`)}
            onStateChanged={() => { setRefreshing(true); load(); }}
          />
        )}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name={statusFilter === "active" ? "rocket-outline" : "archive-outline"} size={48} color="#C7C7CC" />
            <Text style={s.emptyText}>{t("myTasks.empty")}</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },

  // Mode toggle
  modeRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  modeBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB",
  },
  modeBtnActive: { backgroundColor: "#4A7BF7", borderColor: "#4A7BF7" },
  modeBtnText: { fontSize: 13, fontWeight: "600", color: "#8E8E93" },
  modeBtnTextActive: { color: "#fff" },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#E5E7EB",
    justifyContent: "center", alignItems: "center", paddingHorizontal: 5,
  },
  badgeActive: { backgroundColor: "rgba(255,255,255,0.3)" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#8E8E93" },
  badgeTextActive: { color: "#fff" },

  // Status filter
  filterRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: "center" },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: "#F2F2F7" },
  pillActive: { backgroundColor: "#1A1A1A" },
  pillText: { fontSize: 13, fontWeight: "500", color: "#8E8E93" },
  pillTextActive: { color: "#fff" },

  // List
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#8E8E93", marginTop: 16, marginBottom: 8, letterSpacing: 0.3 },

  // Empty
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 15, color: "#C7C7CC", marginTop: 12 },
});
