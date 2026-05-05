import { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ScrollView, Dimensions, TextInput, Keyboard, Alert, Animated,
  type GestureResponderEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type TIssue, type TState, type TLabel, type TMember, updateIssue, createIssue, fetchAllMembers, getSessionCookie, BASE_URL } from "./api";
import { cacheImage } from "./image-cache";
import { getCardSettings, type CardDisplaySettings } from "./card-settings";
import { priorityColors } from "./theme";
import { t, tPriority } from "./i18n";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const COLUMN_WIDTH = SCREEN_WIDTH * 0.82;
const COLUMN_GAP = 14;
// COLUMN_HEIGHT will be measured dynamically via onLayout
const BOARD_PADDING = 16;

const STATE_ICONS: Record<string, string> = {
  backlog: "ellipse-outline", unstarted: "radio-button-off", started: "trending-up",
  completed: "checkmark-circle", cancelled: "close-circle",
};

const LABEL_PALETTE = [
  { bg: "#EDE9FE", text: "#7C3AED", icon: "flash" },
  { bg: "#DBEAFE", text: "#2563EB", icon: "bookmark" },
  { bg: "#D1FAE5", text: "#059669", icon: "code-slash" },
  { bg: "#FEF3C7", text: "#D97706", icon: "bulb" },
  { bg: "#FCE7F3", text: "#DB2777", icon: "heart" },
  { bg: "#E0F2FE", text: "#0284C7", icon: "star" },
  { bg: "#FEE2E2", text: "#DC2626", icon: "bug" },
];

type Column = { state: TState; issues: TIssue[] };

// Cover URL cache
let _coverUrls: Record<string, string> = {};
let _coverAssetIds: Record<string, string> = {};

// Avatar cache — download once, reuse as data URI
const _avatarCache: Record<string, string | null> = {}; // userId → data:image URI or null
const _avatarLoading: Record<string, Promise<string | null>> = {};

async function getAvatarUri(avatarPath: string, cookie: string): Promise<string | null> {
  if (_avatarCache[avatarPath] !== undefined) return _avatarCache[avatarPath];
  if (_avatarLoading[avatarPath]) return _avatarLoading[avatarPath];
  _avatarLoading[avatarPath] = (async () => {
    try {
      const res = await fetch(`${BASE_URL}${avatarPath}`, { headers: { Cookie: cookie } });
      if (!res.ok) { _avatarCache[avatarPath] = null; return null; }
      const blob = await res.blob();
      return new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => { const uri = reader.result as string; _avatarCache[avatarPath] = uri; resolve(uri); };
        reader.onerror = () => { _avatarCache[avatarPath] = null; resolve(null); };
        reader.readAsDataURL(blob);
      });
    } catch { _avatarCache[avatarPath] = null; return null; }
    finally { delete _avatarLoading[avatarPath]; }
  })();
  return _avatarLoading[avatarPath];
}

type Props = {
  columns: Column[];
  labels: Record<string, TLabel>;
  labelOrder: string[];
  projectId: string;
  projectIdentifier: string;
  onIssuePress: (issue: TIssue) => void;
  onRefresh: () => void;
  onColumnsChange: (columns: Column[]) => void;
  userId?: string;
  refreshKey?: number;
};

export function KanbanBoard({
  columns, labels, labelOrder, projectId, projectIdentifier,
  onIssuePress, onRefresh, onColumnsChange, userId, refreshKey,
}: Props) {
  const [cardSettings, setCardSettings] = useState<CardDisplaySettings>({
    showLabels: true, showPriority: true, showAssignees: true, showDueDate: true, showId: true, showAttachments: true,
  });
  const [allMembers, setAllMembers] = useState<TMember[]>([]);

  const [avatarUris, setAvatarUris] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const members = await fetchAllMembers().catch(() => []);
      setAllMembers(members);
      // Preload avatars once
      const cookie = await getSessionCookie();
      if (!cookie) return;
      for (const m of members) {
        if (m.avatar && m.avatar.startsWith("/") && !_avatarCache[m.avatar]) {
          getAvatarUri(m.avatar, cookie).then((uri) => {
            if (uri) setAvatarUris((prev) => ({ ...prev, [m.id]: uri }));
          });
        } else if (_avatarCache[m.avatar]) {
          setAvatarUris((prev) => ({ ...prev, [m.id]: _avatarCache[m.avatar]! }));
        }
      }
    })();
  }, []);

  // Board height measured via onLayout
  const [boardHeight, setBoardHeight] = useState(SCREEN_HEIGHT - 180);
  const [activeColIdx, setActiveColIdx] = useState(0);

  // Drag state
  const [dragItem, setDragItem] = useState<{ issue: TIssue; fromColId: string } | null>(null);
  const [dropColIdx, setDropColIdx] = useState<number>(-1);
  // Action modal state
  const [actionIssue, setActionIssue] = useState<{ issue: TIssue; colId: string } | null>(null);
  const dragPos = useRef(new Animated.ValueXY()).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  const scrollXRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  // Inline create
  const [inlineCreateCol, setInlineCreateCol] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineCreating, setInlineCreating] = useState(false);

  const [coverUrls, setCoverUrls] = useState<Record<string, string>>(_coverUrls);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});

  useEffect(() => { getCardSettings().then(setCardSettings); }, []);

  useEffect(() => {
    getSessionCookie().then((c) => { if (c) setAuthHeaders({ Cookie: c }); });
  }, []);

  // Build cover URLs — invalidate cache on refreshKey change
  useEffect(() => {
    if (!cardSettings.showCoverImage) return;
    // Clear cache on refresh to pick up new star selections
    _coverAssetIds = {};
    _coverUrls = {};
    console.log("[KanbanBoard] Rebuilding covers, refreshKey=", refreshKey, "columns=", columns.length);
    (async () => {
      for (const col of columns) {
        for (const issue of col.issues) {
          // Cover is now authoritative on the server; clear any legacy local
          // entry so stale AsyncStorage values can't mask a server-side removal.
          const assetId = issue.cover_image_asset_id;
          if (!assetId) {
            AsyncStorage.removeItem(`cover_${issue.id}`).catch(() => {});
            continue;
          }
          _coverAssetIds[issue.id] = assetId;
          const remoteUrl = `${BASE_URL}/api/assets/v2/workspaces/implica/projects/${projectId}/issues/${issue.id}/proxy/${assetId}/?w=400`;
          const localUri = await cacheImage(remoteUrl).catch(() => remoteUrl);
          _coverUrls[issue.id] = localUri;
        }
      }
      console.log("[KanbanBoard] Cover URLs updated, count=", Object.keys(_coverUrls).length);
      // Always publish the fresh map — otherwise removed covers keep their old URL.
      setCoverUrls({ ..._coverUrls });
    })();
  }, [columns, cardSettings.showCoverImage, projectId, refreshKey]);

  const getAllLabels = (issue: TIssue) => {
    const ids = issue.label_ids ?? [];
    return ids.map((lid, i) => {
      const label = labels[lid];
      if (!label) return null;
      const idx = labelOrder.indexOf(lid);
      return { label, style: LABEL_PALETTE[(idx >= 0 ? idx : i) % LABEL_PALETTE.length] };
    }).filter(Boolean) as { label: TLabel; style: typeof LABEL_PALETTE[0] }[];
  };

  // Calculate which column the finger is over
  const getColumnAtX = useCallback((pageX: number): number => {
    const x = pageX + scrollXRef.current - BOARD_PADDING;
    const colIdx = Math.floor(x / (COLUMN_WIDTH + COLUMN_GAP));
    return Math.max(0, Math.min(colIdx, columns.length - 1));
  }, [columns.length]);

  // Start drag — immediate visual feedback on long press
  const startDrag = useCallback((issue: TIssue, fromColId: string, pageX: number, pageY: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setDragItem({ issue, fromColId });
    dragPos.setValue({ x: pageX - SCREEN_WIDTH / 2, y: pageY - 200 });
    dragScale.setValue(1.05);
  }, []);

  // Drop
  const handleDrop = useCallback(async () => {
    if (!dragItem || dropColIdx < 0) {
      cancelDrag();
      return;
    }
    const targetCol = columns[dropColIdx];
    if (!targetCol || targetCol.state.id === dragItem.fromColId) {
      cancelDrag();
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const newColumns = columns.map((col) => {
      if (col.state.id === dragItem.fromColId) {
        return { ...col, issues: col.issues.filter((i) => i.id !== dragItem.issue.id) };
      }
      if (col.state.id === targetCol.state.id) {
        return { ...col, issues: [{ ...dragItem.issue, state: targetCol.state.id }, ...col.issues] };
      }
      return col;
    });

    onColumnsChange(newColumns);
    cancelDrag();

    try {
      await updateIssue(projectId, dragItem.issue.id, { state: targetCol.state.id } as any);
    } catch {
      onRefresh();
    }
  }, [dragItem, dropColIdx, columns, projectId]);

  const cancelDrag = () => {
    stopAutoScroll();
    setDragItem(null);
    setDropColIdx(-1);
    dragScale.setValue(1);
    dragPos.setValue({ x: 0, y: 0 });
  };

  // Auto-scroll edges
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startAutoScroll = useCallback((direction: "left" | "right") => {
    if (autoScrollTimer.current) return;
    autoScrollTimer.current = setInterval(() => {
      const delta = direction === "right" ? 80 : -80;
      scrollRef.current?.scrollTo({ x: Math.max(0, scrollXRef.current + delta), animated: true });
      scrollXRef.current = Math.max(0, scrollXRef.current + delta);
    }, 100);
  }, []);
  const stopAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) { clearInterval(autoScrollTimer.current); autoScrollTimer.current = null; }
  }, []);

  // Touch handlers for drag — minimize re-renders
  const lastDropCol = useRef(-1);
  const onTouchMove = useCallback((e: GestureResponderEvent) => {
    if (!dragItem) return;
    const { pageX, pageY } = e.nativeEvent;
    dragPos.setValue({ x: pageX - SCREEN_WIDTH / 2, y: pageY - 200 });

    // Only re-render when column changes
    const colIdx = getColumnAtX(pageX);
    if (colIdx !== lastDropCol.current) {
      lastDropCol.current = colIdx;
      setDropColIdx(colIdx);
    }

    // Auto-scroll when near edges
    if (pageX > SCREEN_WIDTH - 60) {
      startAutoScroll("right");
    } else if (pageX < 60) {
      startAutoScroll("left");
    } else {
      stopAutoScroll();
    }
  }, [dragItem, getColumnAtX, startAutoScroll, stopAutoScroll]);

  const onTouchEnd = useCallback(() => {
    if (!dragItem) return;
    stopAutoScroll();
    handleDrop();
  }, [dragItem, handleDrop, stopAutoScroll]);

  // Inline create
  const handleInlineCreate = useCallback(async (stateId: string) => {
    if (!inlineTitle.trim()) { setInlineCreateCol(null); return; }
    setInlineCreating(true);
    try {
      const newIssue = await createIssue(projectId, { name: inlineTitle.trim(), state: stateId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onColumnsChange(columns.map((col) => col.state.id === stateId ? { ...col, issues: [newIssue, ...col.issues] } : col));
    } catch { Alert.alert(t("common.error"), "Failed to create task"); }
    finally { setInlineTitle(""); setInlineCreateCol(null); setInlineCreating(false); Keyboard.dismiss(); }
  }, [inlineTitle, projectId, columns]);

  const renderCard = (item: TIssue, colId: string) => {
    const itemLabels = getAllLabels(item);
    const isDragging = dragItem?.issue.id === item.id;

    return (
      <TouchableOpacity
        key={item.id}
        style={[s.card, isDragging && s.cardGhost]}
        onPress={() => !dragItem && onIssuePress(item)}
        onLongPress={(e) => startDrag(item, colId, e.nativeEvent.pageX, e.nativeEvent.pageY)}
        delayLongPress={400}
        activeOpacity={0.8}
        disabled={!!dragItem}
      >
        {/* Cover image — like Trello */}
        {cardSettings.showCoverImage && coverUrls[item.id] && authHeaders.Cookie && (
          <Image source={coverUrls[item.id].startsWith("file://") ? { uri: coverUrls[item.id] } : { uri: coverUrls[item.id], headers: authHeaders }} style={s.coverImage} resizeMode="cover" />
        )}

        {/* Label chips — show ALL labels */}
        {cardSettings.showLabels && itemLabels.length > 0 && (
          <View style={s.labelRow}>
            {itemLabels.map((li) => (
              <View key={li.label.id} style={[s.labelChip, { backgroundColor: li.style.bg }]}>
                <Ionicons name={li.style.icon as any} size={10} color={li.style.text} />
                <Text style={[s.labelChipText, { color: li.style.text }]} numberOfLines={1}>{li.label.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Title — bigger like reference */}
        <Text style={s.cardTitle} numberOfLines={2}>{item.name}</Text>

        {/* Badges row — ID + priority + date like reference */}
        <View style={s.cardBadges}>
          {cardSettings.showPriority && (
            <View style={[s.prioBadge, { backgroundColor: (priorityColors[item.priority] || "#9CA3AF") + "15" }]}>
              <Ionicons name="flag" size={10} color={priorityColors[item.priority] || "#9CA3AF"} />
            </View>
          )}
          {cardSettings.showId && (
            <Text style={s.badgeId}>{projectIdentifier}-{item.sequence_id}</Text>
          )}
          <View style={{ flex: 1 }} />
          {cardSettings.showDueDate && item.target_date && (
            <View style={s.dateBadge}>
              <Ionicons name="calendar-outline" size={11} color="#8E8E93" />
              <Text style={s.dateText}>{new Date(item.target_date).toLocaleDateString("en-US", { day: "2-digit", month: "short" })}</Text>
            </View>
          )}
          {/* Attachment badge */}
          {cardSettings.showAttachments && (item.attachment_count ?? 0) > 0 && (
            <View style={s.dateBadge}>
              <Ionicons name="attach" size={12} color="#8E8E93" />
              <Text style={s.dateText}>{item.attachment_count}</Text>
            </View>
          )}
          {/* Assignee avatars (preloaded) */}
          {cardSettings.showAssignees && (item.assignee_ids ?? []).length > 0 && (
            <View style={s.assigneeRow}>
              {(item.assignee_ids ?? []).slice(0, 3).map((aid) => {
                const m = allMembers.find((mm) => mm.id === aid);
                const cached = avatarUris[aid];
                return cached ? (
                  <Image key={aid} source={{ uri: cached }} style={s.miniAvatar} />
                ) : (
                  <View key={aid} style={s.miniAvatarFallback}>
                    <Text style={s.miniAvatarText}>{(m?.first_name || m?.display_name || "?").charAt(0)}</Text>
                  </View>
                );
              })}
            </View>
          )}
          {/* Action button */}
          <TouchableOpacity
            onPress={() => setActionIssue({ issue: item, colId })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.cardActionBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color="#C7C7CC" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={s.wrapper}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={cancelDrag}
      onLayout={(e) => setBoardHeight(e.nativeEvent.layout.height - 44)}
    >
      {/* Pill-tab navigation */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pillNav}
        style={s.pillNavContainer}
      >
        {columns.map((col, idx) => {
          const isActive = activeColIdx === idx;
          return (
            <TouchableOpacity
              key={col.state.id}
              style={[s.pillTab, isActive && { backgroundColor: col.state.color + "20", borderColor: col.state.color }]}
              onPress={() => {
                scrollRef.current?.scrollTo({ x: idx * (COLUMN_WIDTH + COLUMN_GAP), animated: true });
              }}
              activeOpacity={0.7}
            >
              <View style={[s.pillDot, { backgroundColor: col.state.color }]} />
              <Text style={[s.pillTabText, isActive && { color: col.state.color, fontWeight: "700" }]} numberOfLines={1}>
                {col.state.name}
              </Text>
              {col.state.wip_limit != null && col.state.wip_limit > 0 ? (
                <Text style={[
                  s.pillTabCount,
                  isActive && { color: col.state.color },
                  col.issues.length > col.state.wip_limit && { color: "#DC2626" },
                  col.issues.length === col.state.wip_limit && { color: "#D97706" },
                ]}>{col.issues.length}/{col.state.wip_limit}</Text>
              ) : (
                <Text style={[s.pillTabCount, isActive && { color: col.state.color }]}>{col.issues.length}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Horizontal scroll */}
      <ScrollView
        ref={scrollRef}
        horizontal
        snapToInterval={COLUMN_WIDTH + COLUMN_GAP}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.boardScroll}
        scrollEnabled={!dragItem}
        onScroll={(e) => {
          scrollXRef.current = e.nativeEvent.contentOffset.x;
          const idx = Math.round(e.nativeEvent.contentOffset.x / (COLUMN_WIDTH + COLUMN_GAP));
          if (idx !== activeColIdx) setActiveColIdx(idx);
        }}
        scrollEventThrottle={16}
      >
        {columns.map((col, colIdx) => {
          const isDropTarget = dragItem && dragItem.fromColId !== col.state.id && dropColIdx === colIdx;

          return (
            <View key={col.state.id} style={[s.column, { height: boardHeight }, isDropTarget && s.columnDropTarget]}>
              {/* Header */}
              <View style={s.colHeader}>
                <View style={[s.stateIconBox, { backgroundColor: col.state.color + "18" }]}>
                  <Ionicons name={(STATE_ICONS[col.state.group] || "ellipse-outline") as any} size={16} color={col.state.color} />
                </View>
                <Text style={s.colTitle} numberOfLines={1}>{col.state.name}</Text>
                {col.state.wip_limit != null && col.state.wip_limit > 0 ? (
                  <View style={[
                    s.wipBadge,
                    col.issues.length > col.state.wip_limit
                      ? s.wipBadgeOver
                      : col.issues.length === col.state.wip_limit
                        ? s.wipBadgeAtLimit
                        : null,
                  ]}>
                    <Text style={[
                      s.wipBadgeText,
                      col.issues.length > col.state.wip_limit
                        ? s.wipBadgeTextOver
                        : col.issues.length === col.state.wip_limit
                          ? s.wipBadgeTextAtLimit
                          : null,
                    ]}>{col.issues.length}/{col.state.wip_limit}</Text>
                  </View>
                ) : (
                  <View style={s.colCount}>
                    <Text style={s.colCountText}>{col.issues.length}</Text>
                  </View>
                )}
              </View>

              {/* Drop indicator */}
              {isDropTarget && (
                <View style={s.dropIndicator}>
                  <Ionicons name="arrow-down-circle" size={20} color="#4A7BF7" />
                  <Text style={s.dropText}>{t("kanban.dropHere")}</Text>
                </View>
              )}

              {/* Cards */}
              <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={s.colCards}
                style={{ flex: 1 }}
                nestedScrollEnabled
                scrollEnabled={!dragItem}
              >
                {col.issues.map((item) => renderCard(item, col.state.id))}

                {/* Add button */}
                {!dragItem && (
                  inlineCreateCol === col.state.id ? (
                    <View style={s.inlineCreate}>
                      <TextInput
                        style={s.inlineInput}
                        value={inlineTitle}
                        onChangeText={setInlineTitle}
                        placeholder={t("kanban.addCard")}
                        placeholderTextColor="#C7C7CC"
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={() => handleInlineCreate(col.state.id)}
                        editable={!inlineCreating}
                      />
                      <View style={s.inlineActions}>
                        <TouchableOpacity style={s.inlineAddBtn} onPress={() => handleInlineCreate(col.state.id)}>
                          <Text style={s.inlineAddText}>{inlineCreating ? "..." : t("kanban.add")}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setInlineCreateCol(null); setInlineTitle(""); }}>
                          <Ionicons name="close" size={20} color="#8E8E93" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity style={s.addCardBtn} onPress={() => { setInlineCreateCol(col.state.id); setInlineTitle(""); }}>
                      <Ionicons name="add" size={18} color="#8E8E93" />
                      <Text style={s.addCardText}>{t("kanban.add")}</Text>
                    </TouchableOpacity>
                  )
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      {/* Floating drag card */}
      {dragItem && (
        <Animated.View
          style={[
            s.floatingCard,
            {
              transform: [
                { translateX: dragPos.x },
                { translateY: dragPos.y },
                { scale: dragScale },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={s.floatingTitle} numberOfLines={2}>{dragItem.issue.name}</Text>
          <Text style={s.floatingId}>{projectIdentifier}-{dragItem.issue.sequence_id}</Text>
        </Animated.View>
      )}

      {/* Cancel zone at bottom */}
      {dragItem && (
        <View style={s.cancelZone}>
          <Ionicons name="close-circle" size={18} color="#FF3B30" />
          <Text style={s.cancelText}>{t("kanban.cancelDrag")}</Text>
        </View>
      )}

      {/* Action modal */}
      {actionIssue && (
        <View style={s.actionOverlay}>
          <TouchableOpacity style={s.actionBackdrop} onPress={() => setActionIssue(null)} activeOpacity={1} />
          <View style={s.actionSheet}>
            <View style={s.actionHandle} />
            <Text style={s.actionTitle} numberOfLines={1}>{projectIdentifier}-{actionIssue.issue.sequence_id} {actionIssue.issue.name}</Text>
            <View style={s.actionBtns}>
              <TouchableOpacity style={s.actionBtn} onPress={() => { const i = actionIssue.issue; setActionIssue(null); onIssuePress(i); }}>
                <View style={[s.actionIcon, { backgroundColor: "#4A7BF715" }]}><Ionicons name="open-outline" size={20} color="#4A7BF7" /></View>
                <Text style={s.actionBtnText}>{t("kanban.open")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={async () => {
                if (!userId) return;
                const ids = actionIssue.issue.assignee_ids ?? [];
                if (!ids.includes(userId)) {
                  await updateIssue(projectId, actionIssue.issue.id, { assignee_ids: [...ids, userId] } as any).catch(() => {});
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                setActionIssue(null); onRefresh();
              }}>
                <View style={[s.actionIcon, { backgroundColor: "#22C55E15" }]}><Ionicons name="person-add" size={20} color="#22C55E" /></View>
                <Text style={s.actionBtnText}>{t("kanban.assign")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={async () => {
                const next = actionIssue.issue.priority === "urgent" ? "high" : actionIssue.issue.priority === "high" ? "medium" : actionIssue.issue.priority === "medium" ? "low" : "urgent";
                await updateIssue(projectId, actionIssue.issue.id, { priority: next } as any).catch(() => {});
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActionIssue(null); onRefresh();
              }}>
                <View style={[s.actionIcon, { backgroundColor: "#FF950015" }]}><Ionicons name="flag" size={20} color="#FF9500" /></View>
                <Text style={s.actionBtnText}>{t("kanban.priority")}</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.actionSectionTitle}>{t("kanban.moveTo")}</Text>
            {columns.map((col) => {
              const isCurrent = col.state.id === actionIssue.colId;
              return (
                <TouchableOpacity key={col.state.id} style={[s.actionMoveRow, isCurrent && { opacity: 0.4 }]} disabled={isCurrent}
                  onPress={async () => {
                    if (isCurrent) return;
                    const issue = actionIssue.issue; const fromId = actionIssue.colId;
                    setActionIssue(null);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    onColumnsChange(columns.map((c) => {
                      if (c.state.id === fromId) return { ...c, issues: c.issues.filter((i) => i.id !== issue.id) };
                      if (c.state.id === col.state.id) return { ...c, issues: [{ ...issue, state: col.state.id }, ...c.issues] };
                      return c;
                    }));
                    await updateIssue(projectId, issue.id, { state: col.state.id } as any).catch(() => onRefresh());
                  }}>
                  <View style={[s.stateIconBox, { backgroundColor: col.state.color + "18" }]}>
                    <Ionicons name={(STATE_ICONS[col.state.group] || "ellipse-outline") as any} size={14} color={col.state.color} />
                  </View>
                  <Text style={s.actionMoveText}>{col.state.name}</Text>
                  <Text style={s.actionMoveCount}>{col.issues.length}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={s.actionCancel} onPress={() => setActionIssue(null)}>
              <Text style={s.actionCancelText}>{t("kanban.close")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#FAFAFA" },
  pillNavContainer: { flexGrow: 0, maxHeight: 40 },
  pillNav: { paddingHorizontal: BOARD_PADDING, paddingVertical: 6, gap: 6 },
  pillTab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
    backgroundColor: "#F2F2F7", borderWidth: 1, borderColor: "transparent",
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillTabText: { fontSize: 12, fontWeight: "500", color: "#8E8E93", maxWidth: 80 },
  pillTabCount: { fontSize: 11, fontWeight: "600", color: "#C7C7CC" },
  boardScroll: { paddingHorizontal: BOARD_PADDING, paddingTop: 4, paddingBottom: 24 },
  column: { width: COLUMN_WIDTH, marginRight: COLUMN_GAP, backgroundColor: "#F2F2F7", borderRadius: 14 },
  columnDropTarget: { backgroundColor: "#4A7BF710", borderWidth: 2, borderColor: "#4A7BF7", borderStyle: "dashed" },

  colHeader: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, gap: 8 },
  stateIconBox: { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  colTitle: { flex: 1, fontSize: 16, fontWeight: "600", color: "#1A1A1A" },
  colCount: { backgroundColor: "#E5E5EA", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  colCountText: { fontSize: 12, fontWeight: "600", color: "#8E8E93" },
  wipBadge: { backgroundColor: "#E5E5EA", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  wipBadgeAtLimit: { backgroundColor: "#FEF3C7" },
  wipBadgeOver: { backgroundColor: "#FEE2E2" },
  wipBadgeText: { fontSize: 12, fontWeight: "600", color: "#8E8E93" },
  wipBadgeTextAtLimit: { color: "#D97706" },
  wipBadgeTextOver: { color: "#DC2626" },

  dropIndicator: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, backgroundColor: "#4A7BF710" },
  dropText: { fontSize: 13, fontWeight: "600", color: "#4A7BF7" },

  colCards: { gap: 8, paddingHorizontal: 8, paddingBottom: 8 },

  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardGhost: { opacity: 0.3, borderWidth: 2, borderColor: "#4A7BF7", borderStyle: "dashed" },
  coverImage: { width: "100%", height: 120, borderRadius: 10, marginBottom: 4 },
  labelRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  labelChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  labelChipText: { fontSize: 11, fontWeight: "600" },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#1A1A1A", lineHeight: 22 },
  cardBadges: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  prioBadge: { width: 22, height: 22, borderRadius: 6, justifyContent: "center", alignItems: "center" },
  badgeId: { fontSize: 12, color: "#8E8E93", fontWeight: "500" },
  dateBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  dateText: { fontSize: 11, color: "#8E8E93" },
  assigneeRow: { flexDirection: "row", gap: -4 },
  miniAvatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#fff" },
  miniAvatarFallback: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#4A7BF715", justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "#fff" },
  miniAvatarText: { fontSize: 9, fontWeight: "700", color: "#4A7BF7" },
  cardActionBtn: { padding: 2 },

  // Floating card
  floatingCard: {
    position: "absolute", width: COLUMN_WIDTH * 0.9, padding: 16,
    backgroundColor: "#fff", borderRadius: 14, gap: 6,
    shadowColor: "#4A7BF7", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
    borderWidth: 2, borderColor: "#4A7BF7",
    alignSelf: "center", top: 100,
  },
  floatingTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  floatingId: { fontSize: 12, color: "#8E8E93", fontWeight: "600" },

  // Cancel zone
  cancelZone: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 16, paddingBottom: 40, backgroundColor: "#1C1C1E",
  },
  cancelText: { fontSize: 15, fontWeight: "600", color: "#FF3B30" },

  // Action modal
  actionOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", zIndex: 100 },
  actionBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" },
  actionSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12 },
  actionHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#D1D1D6", alignSelf: "center", marginBottom: 14 },
  actionTitle: { fontSize: 14, color: "#8E8E93", marginBottom: 16 },
  actionBtns: { flexDirection: "row", gap: 12, marginBottom: 20 },
  actionBtn: { flex: 1, alignItems: "center", gap: 6 },
  actionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  actionBtnText: { fontSize: 12, fontWeight: "500", color: "#8E8E93" },
  actionSectionTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A1A", marginBottom: 8 },
  actionMoveRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
  actionMoveText: { flex: 1, fontSize: 15, fontWeight: "500", color: "#1A1A1A" },
  actionMoveCount: { fontSize: 13, color: "#8E8E93" },
  actionCancel: { marginTop: 12, paddingVertical: 14, alignItems: "center", backgroundColor: "#F2F2F7", borderRadius: 12 },
  actionCancelText: { fontSize: 16, fontWeight: "600", color: "#FF3B30" },

  // Inline create
  addCardBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, marginHorizontal: 8, marginTop: 4, borderRadius: 10, backgroundColor: "#E5E5EA" },
  addCardText: { fontSize: 14, fontWeight: "500", color: "#8E8E93" },
  inlineCreate: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginHorizontal: 8, marginTop: 4, borderWidth: 2, borderColor: "#4A7BF7", gap: 10 },
  inlineInput: { fontSize: 15, color: "#1A1A1A", minHeight: 36 },
  inlineActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  inlineAddBtn: { backgroundColor: "#4A7BF7", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  inlineAddText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});
