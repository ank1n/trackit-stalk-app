import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchIssues, fetchStates, issueStateId, type TIssue, type TState } from "../../../lib/api";
import { t, getLang } from "../../../lib/i18n";
import { priorityColors } from "../../../lib/theme";

const DOW_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DOW_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function dayOfWeekMondayFirst(year: number, month: number, day: number): number {
  // 0 = Mon ... 6 = Sun
  const jsDow = new Date(year, month, day).getDay(); // 0=Sun..6=Sat
  return (jsDow + 6) % 7;
}

function toISODate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export default function ProjectCalendarScreen() {
  const { id, name, identifier } = useLocalSearchParams<{
    id: string;
    name: string;
    identifier: string;
  }>();
  const [issues, setIssues] = useState<TIssue[]>([]);
  const [states, setStates] = useState<Record<string, TState>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string>(
    toISODate(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  const ru = getLang() === "ru";
  const dow = ru ? DOW_RU : DOW_EN;
  const monthLabel = (ru ? MONTHS_RU : MONTHS_EN)[month];

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
      console.error("Calendar load failed:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const byDate = useMemo(() => {
    const m: Record<string, TIssue[]> = {};
    for (const i of issues) {
      const dateStr = i.target_date;
      if (!dateStr) continue;
      const key = dateStr.slice(0, 10);
      (m[key] ||= []).push(i);
    }
    return m;
  }, [issues]);

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };
  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  // Build grid: starts on Monday, spans 6 rows × 7 cols
  const firstDow = dayOfWeekMondayFirst(year, month, 1);
  const daysCount = daysInMonth(year, month);
  const cells: { day: number | null; iso: string | null }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, iso: null });
  for (let d = 1; d <= daysCount; d++) {
    cells.push({ day: d, iso: toISODate(year, month, d) });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });

  const selectedIssues = selected ? byDate[selected] ?? [] : [];
  const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <>
      <Stack.Screen
        options={{
          title: `${name || ""} · ${ru ? "Календарь" : "Calendar"}`,
        }}
      />
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#4A7BF7" />
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
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
          {/* Month header */}
          <View style={s.monthBar}>
            <TouchableOpacity style={s.navBtn} onPress={goPrev}>
              <Ionicons name="chevron-back" size={22} color="#4A7BF7" />
            </TouchableOpacity>
            <Text style={s.monthLabel}>
              {monthLabel} {year}
            </Text>
            <TouchableOpacity style={s.navBtn} onPress={goNext}>
              <Ionicons name="chevron-forward" size={22} color="#4A7BF7" />
            </TouchableOpacity>
          </View>

          {/* Day-of-week labels */}
          <View style={s.dowRow}>
            {dow.map((d) => (
              <Text key={d} style={s.dowText}>
                {d}
              </Text>
            ))}
          </View>

          {/* Grid */}
          <View style={s.grid}>
            {cells.map((cell, idx) => {
              if (!cell.day || !cell.iso) {
                return <View key={idx} style={s.cellEmpty} />;
              }
              const list = byDate[cell.iso] ?? [];
              const isSelected = selected === cell.iso;
              const isToday = cell.iso === todayISO;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    s.cell,
                    isSelected && s.cellSelected,
                    isToday && !isSelected && s.cellToday,
                  ]}
                  onPress={() => setSelected(cell.iso!)}
                >
                  <Text
                    style={[
                      s.cellDay,
                      isSelected && s.cellDaySelected,
                      isToday && !isSelected && s.cellDayToday,
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {list.length > 0 && (
                    <View style={s.dots}>
                      {list.slice(0, 3).map((i, di) => {
                        const st = states[issueStateId(i)];
                        return (
                          <View
                            key={di}
                            style={[
                              s.dot,
                              { backgroundColor: st?.color ?? "#9CA3AF" },
                            ]}
                          />
                        );
                      })}
                      {list.length > 3 && (
                        <Text style={s.dotMore}>+{list.length - 3}</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected date list */}
          <View style={s.listSection}>
            <Text style={s.listTitle}>
              {selected
                ? new Date(selected).toLocaleDateString(
                    ru ? "ru-RU" : "en-US",
                    { day: "numeric", month: "long", weekday: "long" },
                  )
                : ""}
            </Text>
            {selectedIssues.length === 0 ? (
              <Text style={s.empty}>
                {ru ? "Нет задач на эту дату" : "No tasks for this date"}
              </Text>
            ) : (
              selectedIssues.map((i) => {
                const st = states[issueStateId(i)];
                const pc = priorityColors[i.priority ?? "none"] || "#9CA3AF";
                return (
                  <TouchableOpacity
                    key={i.id}
                    style={s.issueRow}
                    onPress={() =>
                      router.push(
                        `/issue/${i.id}?projectId=${id}&identifier=${identifier}`,
                      )
                    }
                  >
                    <View
                      style={[
                        s.issueDot,
                        { backgroundColor: st?.color ?? "#9CA3AF" },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.issueId}>
                        {identifier}-{i.sequence_id ?? 0}
                      </Text>
                      <Text style={s.issueName} numberOfLines={2}>
                        {i.name}
                      </Text>
                    </View>
                    <Ionicons name="flag" size={12} color={pc} />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1, backgroundColor: "#F5F5F7" },
  content: { padding: 16, paddingBottom: 32 },

  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  navBtn: { padding: 8 },
  monthLabel: { fontSize: 18, fontWeight: "700", color: "#1A1A1A" },

  dowRow: { flexDirection: "row", paddingVertical: 6 },
  dowText: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 6,
    marginBottom: 16,
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 4,
    justifyContent: "flex-start",
    alignItems: "center",
    borderRadius: 8,
  },
  cellEmpty: { width: `${100 / 7}%`, aspectRatio: 1 },
  cellSelected: { backgroundColor: "#4A7BF7" },
  cellToday: { backgroundColor: "#EBF4FF" },
  cellDay: { fontSize: 14, fontWeight: "500", color: "#1A1A1A", marginTop: 2 },
  cellDaySelected: { color: "#fff", fontWeight: "700" },
  cellDayToday: { color: "#4A7BF7", fontWeight: "700" },
  dots: { flexDirection: "row", gap: 2, marginTop: 4, alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotMore: { fontSize: 9, color: "#8E8E93", fontWeight: "600" },

  listSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 10,
    textTransform: "capitalize",
  },
  empty: { fontSize: 13, color: "#9CA3AF", fontStyle: "italic" },

  issueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  issueDot: { width: 10, height: 10, borderRadius: 5 },
  issueId: { fontSize: 11, fontWeight: "600", color: "#8E8E93" },
  issueName: { fontSize: 14, color: "#1A1A1A", lineHeight: 19 },
});
