import { useEffect, useState, useCallback } from "react";
import { View, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchIssues, fetchStates, fetchLabels, issueStateId, type TIssue, type TState, type TLabel } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { KanbanBoard } from "../../lib/kanban-board";

const STATE_GROUP_ORDER = ["backlog", "unstarted", "started", "completed", "cancelled"];

type Column = { state: TState; issues: TIssue[] };

export default function ProjectKanbanScreen() {
  const { id, name, identifier } = useLocalSearchParams<{ id: string; name?: string; identifier?: string }>();
  const { userId } = useAuth();
  const [columns, setColumns] = useState<Column[]>([]);
  const [labels, setLabels] = useState<Record<string, TLabel>>({});
  const [labelOrder, setLabelOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [issueData, stateData, labelData] = await Promise.all([
        fetchIssues(id), fetchStates(id), fetchLabels(id),
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
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <Stack.Screen
        options={{
          title: name || "",
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 8, paddingRight: 4 }}>
              <TouchableOpacity
                style={{ padding: 8 }}
                onPress={() =>
                  router.push(
                    `/project/calendar/${id}?name=${encodeURIComponent(name || "")}&identifier=${encodeURIComponent(identifier || "")}`,
                  )
                }
              >
                <Ionicons name="calendar-outline" size={22} color="#4A7BF7" />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ padding: 8 }}
                onPress={() =>
                  router.push(
                    `/project/timeline/${id}?name=${encodeURIComponent(name || "")}&identifier=${encodeURIComponent(identifier || "")}`,
                  )
                }
              >
                <Ionicons name="bar-chart-outline" size={22} color="#4A7BF7" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#4A7BF7" /></View>
      ) : (
        <KanbanBoard
          columns={columns}
          labels={labels}
          labelOrder={labelOrder}
          projectId={id || ""}
          projectIdentifier={identifier || ""}
          onIssuePress={(issue) => router.push(`/issue/${issue.id}?projectId=${id}&identifier=${identifier}`)}
          onRefresh={() => { setRefreshing(true); load(); }}
          onColumnsChange={setColumns}
          userId={userId}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },
});
