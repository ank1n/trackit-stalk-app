import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, ScrollView, Modal, Pressable,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../lib/auth-context";
import {
  fetchDashboard, fetchProjects, fetchIssues, fetchStates, issueStateId,
  type TDashboard, type TProject, type TIssue, type TState,
} from "../../lib/api";
import { t, getLang } from "../../lib/i18n";
import { priorityColors } from "../../lib/theme";

const RECENT_PROJECTS_KEY = "trackit_recent_projects";
type Period = "week" | "month";

type MyProgress = { assigned: number; closed: number; created: number };
type ProjectCard = {
  project: TProject;
  todo: number; wip: number; done: number;
  newThisPeriod: number; closedThisPeriod: number;
};
type AttentionItem = {
  issue: TIssue;
  reason: string;
  projectId: string;
  identifier: string;
};

export default function HomeScreen() {
  const { userName, userId } = useAuth();
  const [period, setPeriod] = useState<Period>("week");
  const [dashboard, setDashboard] = useState<TDashboard | null>(null);
  const [myStats, setMyStats] = useState({ todo: 0, wip: 0, review: 0, done: 0, dTodo: 0, dWip: 0, dReview: 0, dDone: 0 });
  const [myProgress, setMyProgress] = useState<MyProgress>({ assigned: 0, closed: 0, created: 0 });
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [weekDeadlines, setWeekDeadlines] = useState<(TIssue & { _proj: TProject })[]>([]);
  const [projectCards, setProjectCards] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Progress drill-down
  type TaggedIssue = TIssue & { _proj: TProject };
  const [progressIssues, setProgressIssues] = useState<{ assigned: TaggedIssue[]; closed: TaggedIssue[]; created: TaggedIssue[] }>({ assigned: [], closed: [], created: [] });
  const [drillDown, setDrillDown] = useState<{ title: string; issues: TaggedIssue[] } | null>(null);

  // Restore cached dashboard on mount — instant display
  useEffect(() => {
    AsyncStorage.getItem("dashboard_cache").then((raw) => {
      if (!raw) return;
      try {
        const c = JSON.parse(raw);
        if (c.myStats) setMyStats(c.myStats);
        if (c.myProgress) setMyProgress(c.myProgress);
        if (c.projectCards) setProjectCards(c.projectCards);
        if (c.attentionItems) setAttentionItems(c.attentionItems);
        setLoading(false);
      } catch {}
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      // Show spinner only on very first load
      const [dash, projects] = await Promise.all([
        fetchDashboard().catch(() => null),
        fetchProjects().catch(() => []),
      ]);
      setDashboard(dash);

      const now = new Date();
      const periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - (period === "week" ? 7 : 30));
      const deadlineEnd = new Date(now);
      deadlineEnd.setDate(deadlineEnd.getDate() + 7);

      let todo = 0, wip = 0, review = 0, done = 0;
      let dTodo = 0, dWip = 0, dReview = 0, dDone = 0;
      let pAssigned = 0, pClosed = 0, pCreated = 0;
      const pAssignedList: (TIssue & { _proj: TProject })[] = [];
      const pClosedList: (TIssue & { _proj: TProject })[] = [];
      const pCreatedList: (TIssue & { _proj: TProject })[] = [];
      const attention: AttentionItem[] = [];
      const allDeadlines: (TIssue & { _proj: TProject })[] = [];
      const cards: ProjectCard[] = [];

      const results = await Promise.allSettled(
        projects.map(async (proj) => {
          const [issues, states] = await Promise.all([fetchIssues(proj.id), fetchStates(proj.id)]);
          if (!states || states.length === 0) return null;
          return { proj, issues, states };
        })
      );

      for (const r of results) {
        if (r.status !== "fulfilled" || !r.value) continue;
        const { proj, issues, states } = r.value;

        const stateMap: Record<string, TState> = {};
        for (const st of states) stateMap[st.id] = st;

        let pTodo = 0, pWip = 0, pDone = 0, pNew = 0, pClosedP = 0;

        for (const issue of issues) {
          const group = stateMap[issueStateId(issue)]?.group;
          const stateName = stateMap[issueStateId(issue)]?.name?.toLowerCase() ?? "";
          const isMine = userId && (issue.assignee_ids ?? []).includes(userId);
          const isMyCreated = issue.created_by === userId;

          // Project-level stats
          if (group === "unstarted") pTodo++;
          else if (group === "started") pWip++;
          else if (group === "completed") pDone++;

          // Period project stats
          if (issue.created_at && new Date(issue.created_at) >= periodStart) pNew++;
          if (group === "completed" && issue.updated_at && new Date(issue.updated_at) >= periodStart) pClosedP++;

          if (!isMine && !isMyCreated) continue;

          // My current status counts + period deltas
          if (isMine) {
            const enteredInPeriod = issue.updated_at && new Date(issue.updated_at) >= periodStart;
            if (group === "unstarted") { todo++; if (enteredInPeriod) dTodo++; }
            else if (group === "started" && stateName.includes("review")) { review++; if (enteredInPeriod) dReview++; }
            else if (group === "started") { wip++; if (enteredInPeriod) dWip++; }
            else if (group === "completed") { done++; if (enteredInPeriod) dDone++; }
          }

          // My progress for period
          const tagged = { ...issue, _proj: proj } as TIssue & { _proj: TProject };
          if (isMine && issue.created_at && new Date(issue.created_at) >= periodStart && group !== "completed" && group !== "cancelled") {
            pAssigned++;
            pAssignedList.push(tagged);
          }
          if (isMine && group === "completed" && issue.updated_at && new Date(issue.updated_at) >= periodStart) {
            pClosed++;
            pClosedList.push(tagged);
          }
          if (isMyCreated && issue.created_at && new Date(issue.created_at) >= periodStart) {
            pCreated++;
            pCreatedList.push(tagged);
          }

          // Attention items — overdue
          if (isMine && issue.target_date && group !== "completed" && group !== "cancelled") {
            const dd = new Date(issue.target_date);
            if (dd < now) {
              const daysLate = Math.ceil((now.getTime() - dd.getTime()) / 86400000);
              const reason = getLang() === "ru"
                ? `Просрочено ${daysLate} д.`
                : `${daysLate}d overdue`;
              attention.push({ issue, reason, projectId: proj.id, identifier: proj.identifier });
            }
          }
          // Attention — urgent/high in progress
          if (isMine && (issue.priority === "urgent" || issue.priority === "high") && group === "started") {
            const reason = issue.priority === "urgent"
              ? (getLang() === "ru" ? "Срочный приоритет" : "Urgent priority")
              : (getLang() === "ru" ? "Высокий приоритет" : "High priority");
            if (!attention.find((a) => a.issue.id === issue.id)) {
              attention.push({ issue, reason, projectId: proj.id, identifier: proj.identifier });
            }
          }

          // Deadlines this week
          if (isMine && issue.target_date && group !== "completed" && group !== "cancelled") {
            const dd = new Date(issue.target_date);
            if (dd >= now && dd <= deadlineEnd) {
              allDeadlines.push({ ...issue, _proj: proj } as TIssue & { _proj: TProject });
            }
          }
        }

        cards.push({ project: proj, todo: pTodo, wip: pWip, done: pDone, newThisPeriod: pNew, closedThisPeriod: pClosedP });
      }

      setMyStats({ todo, wip, review, done, dTodo, dWip, dReview, dDone });
      setMyProgress({ assigned: pAssigned, closed: pClosed, created: pCreated });
      setProgressIssues({ assigned: pAssignedList, closed: pClosedList, created: pCreatedList });
      setAttentionItems(attention.sort((a, b) => {
        // Overdue first, then urgent
        const aOver = a.reason.includes("Просрочено") || a.reason.includes("overdue") ? 0 : 1;
        const bOver = b.reason.includes("Просрочено") || b.reason.includes("overdue") ? 0 : 1;
        return aOver - bOver;
      }).slice(0, 3));
      allDeadlines.sort((a, b) => (a.target_date ?? "") > (b.target_date ?? "") ? 1 : -1);
      setWeekDeadlines(allDeadlines.slice(0, 6));
      // Sort projects: recently visited first, then by activity
      const visitedRaw = await AsyncStorage.getItem("trackit_visited_projects").catch(() => null);
      const visitedOrder: string[] = visitedRaw ? JSON.parse(visitedRaw) : [];
      const filtered = cards.filter((c) => c.todo + c.wip + c.done > 0);
      filtered.sort((a, b) => {
        const aIdx = visitedOrder.indexOf(a.project.id);
        const bIdx = visitedOrder.indexOf(b.project.id);
        // Visited projects first, in visit order
        if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
        if (aIdx >= 0) return -1;
        if (bIdx >= 0) return 1;
        // Then by activity
        return (b.wip + b.newThisPeriod) - (a.wip + a.newThisPeriod);
      });
      setProjectCards(filtered.slice(0, 6));

      // Cache dashboard state for instant next open
      const statsData = { todo, wip, review, done, dTodo, dWip, dReview, dDone };
      const progressData = { assigned: pAssigned, closed: pClosed, created: pCreated };
      AsyncStorage.setItem("dashboard_cache", JSON.stringify({
        myStats: statsData, myProgress: progressData,
        projectCards: filtered.slice(0, 6),
        attentionItems: attention.slice(0, 3),
      })).catch(() => {});
      await AsyncStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(cards.slice(0, 4).map((c) => c.project))).catch(() => {});
    } catch (e) {
      console.error("Dashboard load failed:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, period]);

  useEffect(() => { load(); }, [load]);

  const locale = getLang() === "ru" ? "ru-RU" : "en-US";
  const dateStr = new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  const progressTotal = myProgress.assigned + myProgress.closed + myProgress.created;

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#4A7BF7" /></View>;
  }

  return (
    <>
    <FlatList
      data={[1]}
      keyExtractor={() => "dashboard"}
      style={{ backgroundColor: "#FAFAFA" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#4A7BF7" />}
      renderItem={() => (
        <View style={s.content}>
          {/* 1. Greeting + Period toggle */}
          <View style={s.greeting}>
            <View style={s.greetingTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.greetingText}>{t("home.greeting.welcome")}, {userName || "User"}</Text>
                <Text style={s.dateText}>{dateStr}</Text>
              </View>
              <View style={s.periodToggle}>
                <TouchableOpacity
                  style={[s.periodBtn, period === "week" && s.periodBtnActive]}
                  onPress={() => setPeriod("week")}
                >
                  <Text style={[s.periodBtnText, period === "week" && s.periodBtnTextActive]}>
                    {getLang() === "ru" ? "Нед" : "Week"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.periodBtn, period === "month" && s.periodBtnActive]}
                  onPress={() => setPeriod("month")}
                >
                  <Text style={[s.periodBtnText, period === "month" && s.periodBtnTextActive]}>
                    {getLang() === "ru" ? "Мес" : "Month"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 2. Status cards */}
          <View style={s.statsRow}>
            <StatCard label="Todo" count={myStats.todo} delta={myStats.dTodo} color="#3B82F6" />
            <StatCard label={getLang() === "ru" ? "В работе" : "WIP"} count={myStats.wip} delta={myStats.dWip} color="#F59E0B" />
            <StatCard label="Review" count={myStats.review} delta={myStats.dReview} color="#8B5CF6" />
            <StatCard label={getLang() === "ru" ? "Готово" : "Done"} count={myStats.done} delta={myStats.dDone} color="#22C55E" />
          </View>

          {/* 3. Needs Attention — with reasons */}
          {attentionItems.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionRow}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={s.attentionTitle}>{t("home.attention")} ({attentionItems.length})</Text>
              </View>
              {attentionItems.map((item) => (
                <TouchableOpacity
                  key={item.issue.id}
                  style={s.overdueCard}
                  onPress={() => router.push(`/issue/${item.issue.id}?projectId=${item.projectId}&identifier=${item.identifier}`)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.reason.includes("Просрочено") || item.reason.includes("overdue") ? "time-outline" : "flag"}
                    size={16}
                    color={item.reason.includes("Urgent") || item.reason.includes("Срочный") ? "#EF4444" : "#F97316"}
                  />
                  <View style={s.overdueContent}>
                    <Text style={s.overdueName} numberOfLines={1}>{item.issue.name}</Text>
                    <View style={s.overdueMetaRow}>
                      <Text style={s.overdueMeta}>{item.identifier}-{item.issue.sequence_id}</Text>
                      <View style={s.reasonBadge}>
                        <Text style={s.reasonText}>{item.reason}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 4. My Progress */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              {getLang() === "ru" ? "Мой прогресс" : "My progress"} ({period === "week" ? (getLang() === "ru" ? "неделя" : "week") : (getLang() === "ru" ? "месяц" : "month")})
            </Text>
            <View style={s.progressCard}>
              <View style={s.progressStatsRow}>
                <TouchableOpacity style={s.progressStat} onPress={() => progressIssues.assigned.length > 0 && setDrillDown({ title: getLang() === "ru" ? "Назначено" : "Assigned", issues: progressIssues.assigned })}>
                  <Text style={[s.progressNum, { color: "#3B82F6" }]}>{myProgress.assigned}</Text>
                  <Text style={s.progressLabel}>{getLang() === "ru" ? "Назначено" : "Assigned"}</Text>
                </TouchableOpacity>
                <View style={s.progressDivider} />
                <TouchableOpacity style={s.progressStat} onPress={() => progressIssues.closed.length > 0 && setDrillDown({ title: getLang() === "ru" ? "Сделал" : "Closed", issues: progressIssues.closed })}>
                  <Text style={[s.progressNum, { color: "#22C55E" }]}>{myProgress.closed}</Text>
                  <Text style={s.progressLabel}>{getLang() === "ru" ? "Сделал" : "Closed"}</Text>
                </TouchableOpacity>
                <View style={s.progressDivider} />
                <TouchableOpacity style={s.progressStat} onPress={() => progressIssues.created.length > 0 && setDrillDown({ title: getLang() === "ru" ? "Создал" : "Created", issues: progressIssues.created })}>
                  <Text style={[s.progressNum, { color: "#F59E0B" }]}>{myProgress.created}</Text>
                  <Text style={s.progressLabel}>{getLang() === "ru" ? "Создал" : "Created"}</Text>
                </TouchableOpacity>
              </View>
              {progressTotal > 0 && (
                <View style={s.progressBarBg}>
                  {myProgress.closed > 0 && <View style={[s.progressSeg, { flex: myProgress.closed, backgroundColor: "#22C55E" }]} />}
                  {myProgress.assigned > 0 && <View style={[s.progressSeg, { flex: myProgress.assigned, backgroundColor: "#3B82F6" }]} />}
                  {myProgress.created > 0 && <View style={[s.progressSeg, { flex: myProgress.created, backgroundColor: "#F59E0B" }]} />}
                </View>
              )}
            </View>
          </View>

          {/* 5. Deadlines */}
          {weekDeadlines.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t("home.deadlines")}</Text>
              {weekDeadlines.map((issue) => {
                const dd = new Date(issue.target_date!);
                const isToday = dd.toDateString() === new Date().toDateString();
                const isTomorrow = dd.toDateString() === new Date(Date.now() + 86400000).toDateString();
                const dateLabel = isToday ? t("home.today") : isTomorrow ? t("home.tomorrow") : dd.toLocaleDateString(locale, { day: "numeric", month: "short" });
                return (
                  <TouchableOpacity
                    key={issue.id}
                    style={s.deadlineRow}
                    onPress={() => router.push(`/issue/${issue.id}?projectId=${issue._proj.id}&identifier=${issue._proj.identifier}`)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.deadlineBadge, isToday && { backgroundColor: "#FEF3C7" }]}>
                      <Ionicons name="calendar" size={14} color={isToday ? "#D97706" : "#8E8E93"} />
                      <Text style={[s.deadlineDate, isToday && { color: "#D97706", fontWeight: "700" }]}>{dateLabel}</Text>
                    </View>
                    <View style={s.deadlineContent}>
                      <Text style={s.deadlineName} numberOfLines={1}>{issue.name}</Text>
                      <Text style={s.deadlineMeta}>{issue._proj.identifier}-{issue.sequence_id}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* 6. Project cards with mini stats */}
          {projectCards.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{getLang() === "ru" ? "Проекты" : "Projects"}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.projectsScroll}>
                {projectCards.map((pc) => {
                  const total = pc.todo + pc.wip + pc.done;
                  const donePercent = total > 0 ? Math.round((pc.done / total) * 100) : 0;
                  return (
                    <TouchableOpacity
                      key={pc.project.id}
                      style={s.projectCard}
                      onPress={() => router.push({ pathname: "/(tabs)/projects", params: { openProject: pc.project.id } })}
                      activeOpacity={0.7}
                    >
                      <View style={s.projectHeader}>
                        <Text style={s.projectEmoji}>{pc.project.emoji || pc.project.identifier.charAt(0)}</Text>
                        <Text style={s.projectId}>{pc.project.identifier}</Text>
                      </View>
                      {/* Mini bar */}
                      <View style={s.miniBar}>
                        {pc.done > 0 && <View style={[s.miniBarSeg, { flex: pc.done, backgroundColor: "#22C55E" }]} />}
                        {pc.wip > 0 && <View style={[s.miniBarSeg, { flex: pc.wip, backgroundColor: "#F59E0B" }]} />}
                        {pc.todo > 0 && <View style={[s.miniBarSeg, { flex: pc.todo, backgroundColor: "#3B82F6" }]} />}
                      </View>
                      <Text style={s.projectPercent}>{donePercent}%</Text>
                      {/* Period trend */}
                      <View style={s.trendRow}>
                        <View style={s.trendItem}>
                          <Ionicons name="arrow-up" size={10} color="#3B82F6" />
                          <Text style={s.trendText}>{pc.newThisPeriod}</Text>
                        </View>
                        <View style={s.trendItem}>
                          <Ionicons name="checkmark" size={10} color="#22C55E" />
                          <Text style={s.trendText}>{pc.closedThisPeriod}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={{ height: 20 }} />
        </View>
      )}
    />

    {/* Drill-down modal */}
    {drillDown && (
      <Modal visible transparent animationType="slide" onRequestClose={() => setDrillDown(null)}>
        <View style={s.drillOverlay}>
          <View style={s.drillSheet}>
            <View style={s.drillHeader}>
              <Text style={s.drillTitle}>{drillDown.title} ({drillDown.issues.length})</Text>
              <TouchableOpacity onPress={() => setDrillDown(null)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={drillDown.issues}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.drillCard}
                  onPress={() => {
                    setDrillDown(null);
                    router.push(`/issue/${item.id}?projectId=${item._proj.id}&identifier=${item._proj.identifier}`);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="flag" size={12} color={priorityColors[item.priority ?? "none"] || "#9CA3AF"} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.drillName} numberOfLines={1}>{item.name}</Text>
                    <Text style={s.drillMeta}>{item._proj.identifier}-{item.sequence_id}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    )}
    </>
  );
}

function StatCard({ label, count, delta, color }: { label: string; count: number; delta?: number; color: string }) {
  return (
    <View style={s.statCard}>
      <Text style={[s.statCount, { color }]}>{count}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {delta !== undefined && delta > 0 && (
        <Text style={s.statDelta}>+{delta}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA" },
  content: { padding: 16, gap: 20 },

  // Greeting
  greeting: {},
  greetingTop: { flexDirection: "row", alignItems: "flex-start" },
  greetingText: { fontSize: 22, fontWeight: "700", color: "#1A1A1A" },
  dateText: { fontSize: 14, color: "#8E8E93", marginTop: 2 },
  periodToggle: {
    flexDirection: "row", backgroundColor: "#F2F2F7", borderRadius: 10, padding: 2,
  },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  periodBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  periodBtnText: { fontSize: 13, fontWeight: "600", color: "#8E8E93" },
  periodBtnTextActive: { color: "#1A1A1A" },

  // Stats
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1, alignItems: "center", paddingVertical: 14,
    backgroundColor: "#fff", borderRadius: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statCount: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 10, fontWeight: "600", color: "#8E8E93", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.3 },
  statDelta: { fontSize: 10, fontWeight: "700", color: "#22C55E", marginTop: 2 },

  // Section
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 2 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 6 },

  // Attention
  attentionTitle: { fontSize: 15, fontWeight: "700", color: "#EF4444" },
  overdueCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, backgroundColor: "#FEF2F2", borderRadius: 10,
  },
  overdueContent: { flex: 1 },
  overdueName: { fontSize: 14, fontWeight: "500", color: "#1A1A1A" },
  overdueMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  overdueMeta: { fontSize: 11, color: "#8E8E93" },
  reasonBadge: { backgroundColor: "#FEE2E2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  reasonText: { fontSize: 10, fontWeight: "600", color: "#DC2626" },

  // Progress
  progressCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  progressStatsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  progressStat: { alignItems: "center" },
  progressNum: { fontSize: 24, fontWeight: "800" },
  progressLabel: { fontSize: 11, color: "#8E8E93", fontWeight: "500", marginTop: 2 },
  progressDivider: { width: 1, height: 30, backgroundColor: "#E5E7EB" },
  progressBarBg: { flexDirection: "row", height: 8, borderRadius: 4, backgroundColor: "#E5E7EB", overflow: "hidden" },
  progressSeg: { height: 8 },

  // Deadlines
  deadlineRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, backgroundColor: "#fff", borderRadius: 10,
  },
  deadlineBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#F2F2F7",
  },
  deadlineDate: { fontSize: 11, fontWeight: "600", color: "#8E8E93" },
  deadlineContent: { flex: 1 },
  deadlineName: { fontSize: 14, fontWeight: "500", color: "#1A1A1A" },
  deadlineMeta: { fontSize: 11, color: "#8E8E93", marginTop: 1 },

  // Projects
  projectsScroll: { gap: 10 },
  projectCard: {
    width: 120, padding: 12, backgroundColor: "#fff", borderRadius: 14, gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  projectHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  projectEmoji: { fontSize: 18 },
  projectId: { fontSize: 11, fontWeight: "700", color: "#8E8E93", letterSpacing: 0.5 },
  projectPercent: { fontSize: 13, fontWeight: "700", color: "#22C55E" },
  miniBar: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "#E5E7EB" },
  miniBarSeg: { height: 6 },
  trendRow: { flexDirection: "row", gap: 10 },
  trendItem: { flexDirection: "row", alignItems: "center", gap: 2 },
  trendText: { fontSize: 11, fontWeight: "600", color: "#6B7280" },

  // Drill-down modal
  drillOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  drillSheet: {
    backgroundColor: "#FAFAFA", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "70%", paddingTop: 16,
  },
  drillHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB",
  },
  drillTitle: { fontSize: 18, fontWeight: "700", color: "#1A1A1A" },
  drillCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, marginHorizontal: 16, marginTop: 8,
    backgroundColor: "#fff", borderRadius: 12,
  },
  drillName: { fontSize: 15, fontWeight: "500", color: "#1A1A1A" },
  drillMeta: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
});
