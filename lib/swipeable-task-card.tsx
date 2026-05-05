import { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { type TIssue, type TState, issueStateId, updateIssue } from "./api";
import { t, tPriority } from "./i18n";
import { priorityColors } from "./theme";

type Props = {
  issue: TIssue;
  state: TState | undefined;
  projectId: string;
  identifier: string;
  allStates: Record<string, TState>;
  onPress: () => void;
  onStateChanged: () => void;
  userId?: string;
};

const CLOSED_GROUPS = ["completed", "cancelled"];

// Find first state in a target group from the same project's states
function findState(allStates: Record<string, TState>, targetGroup: string): TState | undefined {
  return Object.values(allStates)
    .filter((s) => s.group === targetGroup)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))[0];
}

type SwipeAction = { label: string; icon: string; color: string; action: string };

function getActions(currentGroup: string, assignedToMe: boolean): SwipeAction[] {
  const actions: SwipeAction[] = [];
  switch (currentGroup) {
    case "backlog":
    case "unstarted":
      actions.push({ label: t("swipe.inProgress"), icon: "play", color: "#F59E0B", action: "group:started" });
      break;
    case "started":
      actions.push({ label: t("swipe.done"), icon: "checkmark-circle", color: "#22C55E", action: "group:completed" });
      actions.push({ label: t("swipe.cancel"), icon: "close-circle", color: "#EF4444", action: "group:cancelled" });
      break;
    case "cancelled":
      actions.push({ label: t("swipe.reopen"), icon: "refresh", color: "#3B82F6", action: "group:unstarted" });
      break;
  }
  if (!assignedToMe && !CLOSED_GROUPS.includes(currentGroup)) {
    actions.push({ label: t("swipe.assign"), icon: "person-add", color: "#8B5CF6", action: "assign_me" });
  }
  return actions;
}

export function SwipeableTaskCard({ issue, state, projectId, identifier, allStates, onPress, onStateChanged, userId }: Props) {
  const swipeRef = useRef<Swipeable>(null);
  const currentGroup = state?.group ?? "";
  const isClosed = CLOSED_GROUPS.includes(currentGroup);
  const assignedToMe = !!userId && (issue.assignee_ids ?? []).includes(userId);
  const actions = getActions(currentGroup, assignedToMe);

  const handleAction = async (action: string) => {
    swipeRef.current?.close();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      if (action === "assign_me") {
        if (!userId) return;
        const next = [...(issue.assignee_ids ?? []), userId];
        await updateIssue(projectId, issue.id, { assignee_ids: next } as any);
      } else if (action.startsWith("group:")) {
        const targetGroup = action.slice("group:".length);
        const targetState = findState(allStates, targetGroup);
        if (!targetState) return;
        await updateIssue(projectId, issue.id, { state: targetState.id } as any);
      }
      onStateChanged();
    } catch {
      // Silently fail — refresh will show correct state
    }
  };

  const handleSwipeRight = () => {
    if (isClosed) return;
    handleAction("group:completed");
  };

  const renderRightActions = (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    if (actions.length === 0) return null;
    return (
      <View style={s.actionsRight}>
        {actions.map((a) => (
          <TouchableOpacity
            key={a.action}
            style={[s.actionBtn, { backgroundColor: a.color }]}
            onPress={() => handleAction(a.action)}
          >
            <Ionicons name={a.icon as any} size={20} color="#fff" />
            <Text style={s.actionText}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderLeftActions = (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    if (isClosed) return null;
    return (
      <TouchableOpacity style={s.actionLeft} onPress={handleSwipeRight}>
        <Ionicons name="checkmark-circle" size={24} color="#fff" />
        <Text style={s.actionText}>{t("swipe.done")}</Text>
      </TouchableOpacity>
    );
  };

  const pc = priorityColors[issue.priority ?? "none"] || "#9CA3AF";

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={actions.length > 0 ? renderRightActions : undefined}
      renderLeftActions={!isClosed ? renderLeftActions : undefined}
      onSwipeableOpen={(direction) => {
        if (direction === "left") handleSwipeRight();
      }}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      rightThreshold={40}
      leftThreshold={80}
    >
      <TouchableOpacity style={[s.card, isClosed && s.cardClosed]} onPress={onPress} activeOpacity={0.7}>
        <View style={[s.dot, { backgroundColor: state?.color || "#999" }]} />
        <View style={s.cardContent}>
          <Text style={s.cardId}>{identifier}-{issue.sequence_id ?? 0}</Text>
          <Text style={[s.cardName, isClosed && s.cardNameClosed]} numberOfLines={2}>{issue.name}</Text>
          <View style={s.cardMeta}>
            <Text style={[s.metaState, { color: state?.color }]}>{state?.name || ""}</Text>
            <Ionicons name="flag" size={10} color={pc} />
            <Text style={[s.metaPrio, { color: pc }]}>{tPriority(issue.priority)}</Text>
            {issue.target_date && (
              <>
                <Text style={s.metaSep}>·</Text>
                <Ionicons name="calendar-outline" size={10} color="#8E8E93" />
                <Text style={s.metaDate}>{new Date(issue.target_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</Text>
              </>
            )}
          </View>
        </View>
        {/* Swipe hint */}
        {actions.length > 0 && <Ionicons name="chevron-back" size={12} color="#E5E7EB" style={{ marginTop: 8 }} />}
      </TouchableOpacity>
    </Swipeable>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 14, backgroundColor: "#fff", borderRadius: 12, marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardClosed: { opacity: 0.6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  cardContent: { flex: 1, gap: 3 },
  cardId: { fontSize: 12, fontWeight: "600", color: "#8E8E93" },
  cardName: { fontSize: 15, fontWeight: "500", color: "#1A1A1A", lineHeight: 21 },
  cardNameClosed: { textDecorationLine: "line-through", color: "#8E8E93" },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  metaState: { fontSize: 12, fontWeight: "500" },
  metaPrio: { fontSize: 12, fontWeight: "500" },
  metaSep: { fontSize: 10, color: "#D1D5DB" },
  metaDate: { fontSize: 11, color: "#8E8E93" },

  // Swipe actions
  actionsRight: { flexDirection: "row", marginBottom: 8 },
  actionBtn: {
    justifyContent: "center", alignItems: "center", width: 80,
    borderRadius: 12, marginLeft: 4, gap: 4,
  },
  actionLeft: {
    justifyContent: "center", alignItems: "center", width: 100,
    backgroundColor: "#22C55E", borderRadius: 12, marginBottom: 8, marginRight: 4, gap: 4,
  },
  actionText: { fontSize: 11, fontWeight: "700", color: "#fff" },
});
