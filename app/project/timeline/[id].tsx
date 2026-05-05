import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchIssues, fetchStates, issueStateId, type TIssue, type TState } from "../../../lib/api";
import { getLang } from "../../../lib/i18n";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_WIDTH = 40; // px per day in the timeline
const ROW_HEIGHT = 36;
const TIMELINE_DAYS = 60; // show a 60-day window

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.slice(0, 10));
  return isNaN(d.getTime()) ? null : startOfDay(d);
}

export default function ProjectTimelineScreen() {
  const { id, name, identifier } = useLocalSearchParams<{
    id: string;
    name?: string;
    identifier?: string;
  }>();
  const [issues, setIssues] = useState<TIssue[]>([]);
  const [states, setStates] = useState<Record<string, TState>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [anchor, setAnchor] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // start 7 days before today
    return startOfDay(d);
  });

  const ru = getLang() === "ru";

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [issueData, stateData] = await Promise.all([
        fetchIssues(id),
        fetchStates(id),
      ]);
      setIssues(issueData);
      const sm: Record<string, TState> = {};
      for (const s of stateData) sm[s.id] = s;
      setStates(sm);
    } catch (e) {
      console.error("Timeline load failed:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Issues with at least a target_date
  const rows = useMemo(() => {
    return issues
      .filter((i) => i.target_date || (i as any).start_date)
      .sort((a, b) => {
        const ad = parseDate(a.target_date)?.getTime() ?? 0;
        const bd = parseDate(b.target_date)?.getTime() ?? 0;
        return ad - bd;
      });
  }, [issues]);

  const days: Date[] = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < TIMELINE_DAYS; i++) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [anchor]);

  const today = startOfDay(new Date());
  const todayOffsetDays = Math.round(
    (today.getTime() - anchor.getTime()) / DAY_MS,
  );

  const shift = (days: number) => {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + days);
    setAnchor(startOfDay(d));
  };

  const monthLabel = (d: Date) =>
    d.toLocaleDateString(ru ? "ru-RU" : "en-US", {
      month: "short",
      day: "numeric",
    });

  return (
    <>
      <Stack.Screen
        options={{
          title: `${name || ""} · Timeline`,
        }}
      />
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#4A7BF7" />
        </View>
      ) : (
        <View style={s.container}>
          {/* Nav bar */}
          <View style={s.navBar}>
            <TouchableOpacity style={s.navBtn} onPress={() => shift(-14)}>
              <Ionicons name="chevron-back" size={20} color="#4A7BF7" />
              <Text style={s.navBtnText}>{ru ? "2 нед" : "2 wk"}</Text>
            </TouchableOpacity>
            <Text style={s.navLabel}>
              {monthLabel(days[0])} — {monthLabel(days[days.length - 1])}
            </Text>
            <TouchableOpacity style={s.navBtn} onPress={() => shift(14)}>
              <Text style={s.navBtnText}>{ru ? "2 нед" : "2 wk"}</Text>
              <Ionicons name="chevron-forward" size={20} color="#4A7BF7" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor="#4A7BF7"
              />
            }
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              contentOffset={{
                x: Math.max(0, todayOffsetDays * DAY_WIDTH - 100),
                y: 0,
              }}
            >
              <View>
                {/* Days header */}
                <View style={s.daysRow}>
                  {days.map((d, i) => {
                    const isToday = d.getTime() === today.getTime();
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <View
                        key={i}
                        style={[
                          s.dayCell,
                          isWeekend && s.dayCellWeekend,
                          isToday && s.dayCellToday,
                        ]}
                      >
                        <Text
                          style={[s.dayMonth, isToday && s.dayMonthToday]}
                        >
                          {d.getDate() === 1 || i === 0
                            ? d
                                .toLocaleDateString(
                                  ru ? "ru-RU" : "en-US",
                                  { month: "short" },
                                )
                                .replace(".", "")
                            : ""}
                        </Text>
                        <Text
                          style={[s.dayNum, isToday && s.dayNumToday]}
                        >
                          {d.getDate()}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Rows */}
                {rows.length === 0 ? (
                  <View style={s.empty}>
                    <Text style={s.emptyText}>
                      {ru
                        ? "Нет задач со сроками"
                        : "No tasks with dates"}
                    </Text>
                  </View>
                ) : (
                  rows.map((issue) => {
                    const st = states[issueStateId(issue)];
                    const target = parseDate(issue.target_date);
                    const start =
                      parseDate((issue as any).start_date) ||
                      parseDate(issue.created_at) ||
                      target;
                    if (!start || !target) return null;
                    const fromDays = Math.max(
                      0,
                      Math.round(
                        (start.getTime() - anchor.getTime()) / DAY_MS,
                      ),
                    );
                    const toDays = Math.min(
                      TIMELINE_DAYS - 1,
                      Math.round(
                        (target.getTime() - anchor.getTime()) / DAY_MS,
                      ),
                    );
                    if (toDays < 0 || fromDays >= TIMELINE_DAYS)
                      return null; // entire bar off-screen
                    const left = fromDays * DAY_WIDTH;
                    const width = Math.max(
                      DAY_WIDTH / 2,
                      (toDays - fromDays + 1) * DAY_WIDTH,
                    );
                    return (
                      <TouchableOpacity
                        key={issue.id}
                        style={s.row}
                        onPress={() =>
                          router.push(
                            `/issue/${issue.id}?projectId=${id}&identifier=${identifier || ""}`,
                          )
                        }
                      >
                        <View
                          style={[
                            s.bar,
                            {
                              left,
                              width,
                              backgroundColor:
                                (st?.color ?? "#4A7BF7") + "CC",
                            },
                          ]}
                        >
                          <Text style={s.barText} numberOfLines={1}>
                            {identifier}-{issue.sequence_id} {issue.name}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}

                {/* Today vertical line */}
                {todayOffsetDays >= 0 &&
                  todayOffsetDays < TIMELINE_DAYS && (
                    <View
                      pointerEvents="none"
                      style={[
                        s.todayLine,
                        { left: todayOffsetDays * DAY_WIDTH + DAY_WIDTH / 2 },
                      ]}
                    />
                  )}
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1, backgroundColor: "#F5F5F7" },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  navBtn: { flexDirection: "row", alignItems: "center", padding: 6 },
  navBtnText: { fontSize: 13, color: "#4A7BF7", fontWeight: "600" },
  navLabel: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },

  daysRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  dayCell: {
    width: DAY_WIDTH,
    paddingVertical: 6,
    alignItems: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#F3F4F6",
  },
  dayCellWeekend: { backgroundColor: "#FAFAFA" },
  dayCellToday: { backgroundColor: "#EBF4FF" },
  dayMonth: { fontSize: 10, color: "#8E8E93", textTransform: "uppercase" },
  dayMonthToday: { color: "#4A7BF7", fontWeight: "700" },
  dayNum: { fontSize: 13, fontWeight: "500", color: "#1A1A1A" },
  dayNumToday: { color: "#4A7BF7", fontWeight: "700" },

  row: { height: ROW_HEIGHT, position: "relative" },
  bar: {
    position: "absolute",
    top: 6,
    bottom: 6,
    borderRadius: 6,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  barText: { color: "#fff", fontSize: 11, fontWeight: "600" },

  empty: { padding: 32, alignItems: "center", width: TIMELINE_DAYS * DAY_WIDTH },
  emptyText: { fontSize: 14, color: "#8E8E93", fontStyle: "italic" },

  todayLine: {
    position: "absolute",
    top: 40,
    bottom: 0,
    width: 1,
    backgroundColor: "#FF3B30",
  },
});
