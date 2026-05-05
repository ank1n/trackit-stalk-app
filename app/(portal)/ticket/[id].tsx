import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams, Stack, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePortalAuth } from "../../../lib/portal-auth-context";
import {
  fetchPortalIssue, createPortalComment, PortalAuthError,
  type PortalIssueDetail, type PortalComment,
} from "../../../lib/portal-api";
import { colors, stateGroupColors } from "../../../lib/theme";
import { t } from "../../../lib/i18n";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "  - ").replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, "\n\n").trim();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("common.justNow");
  if (min < 60) return `${min}m ${t("common.ago")}`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ${t("common.ago")}`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${t("common.ago")}`;
}

type ChatItem = { type: "description" } | { type: "comment"; data: PortalComment };

export default function PortalIssueDetailScreen() {
  const { isLoading: authLoading, isAuthenticated } = usePortalAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [issue, setIssue] = useState<PortalIssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await fetchPortalIssue(id);
      setIssue(data);
    } catch (e) {
      if (e instanceof PortalAuthError) return;
      // keep existing data on error
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [load]);

  const handleSend = async () => {
    const text = commentText.trim();
    if (!text || !id) return;
    setSending(true);
    try {
      await createPortalComment(id, text);
      setCommentText("");
      await load();
      // Scroll to bottom after new comment
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
    } catch {
      // silently handle
    } finally {
      setSending(false);
    }
  };

  if (authLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(portal)/login-email" />;
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!issue) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{t("portal.issueNotFound")}</Text>
      </View>
    );
  }

  const stateColor = stateGroupColors[issue.state_group] || colors.textTertiary;

  // Build chat items: description first, then comments chronologically
  const chatItems: ChatItem[] = [
    { type: "description" },
    ...(issue.comments || []).map((c) => ({ type: "comment" as const, data: c })),
  ];

  const renderItem = ({ item }: { item: ChatItem }) => {
    if (item.type === "description") {
      const desc = issue.description_html ? stripHtml(issue.description_html) : "";
      if (!desc) return null;
      return (
        <View style={s.descBox}>
          <Text style={s.descLabel}>{t("issue.description")}</Text>
          <Text style={s.descText}>{desc}</Text>
        </View>
      );
    }

    const comment = item.data;
    const isMe = comment.is_requester;
    const text = stripHtml(comment.comment_html);

    return (
      <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
        {!isMe && <Text style={s.bubbleSender}>{t("portal.support")}</Text>}
        <Text style={[s.bubbleText, isMe ? s.bubbleTextMe : null]}>{text}</Text>
        <Text style={[s.bubbleTime, isMe ? s.bubbleTimeMe : null]}>
          {timeAgo(comment.created_at)}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <Stack.Screen options={{ headerTitle: issue.name.length > 30 ? issue.name.slice(0, 30) + "..." : issue.name }} />

      {/* Status bar */}
      <View style={s.statusBar}>
        <View style={[s.stateDot, { backgroundColor: stateColor }]} />
        <Text style={s.statusText}>{t(`portal.state.${issue.state_group}`)}</Text>
      </View>

      {/* Title */}
      <View style={s.titleBox}>
        <Text style={s.issueTitle}>{issue.name}</Text>
      </View>

      {/* Chat-style comments */}
      <FlatList
        ref={listRef}
        data={chatItems}
        keyExtractor={(item, i) => item.type === "comment" ? item.data.created_at : "desc"}
        renderItem={renderItem}
        contentContainerStyle={s.chatList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input bar */}
      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          value={commentText}
          onChangeText={setCommentText}
          placeholder={t("portal.writeMessage")}
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={2000}
          editable={!sending}
        />
        <TouchableOpacity
          style={[s.sendButton, (!commentText.trim() || sending) && { opacity: 0.4 }]}
          onPress={handleSend}
          disabled={!commentText.trim() || sending}
          accessibilityLabel={t("portal.sendMessage")}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 16, color: colors.textSecondary },
  statusBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  stateDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  titleBox: { paddingHorizontal: 20, paddingVertical: 12 },
  issueTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  chatList: { paddingHorizontal: 16, paddingBottom: 8 },
  descBox: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 16,
  },
  descLabel: { fontSize: 11, fontWeight: "700", color: colors.textTertiary, marginBottom: 6, letterSpacing: 0.5 },
  descText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 12, marginBottom: 8 },
  bubbleMe: {
    alignSelf: "flex-end", backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: "flex-start", backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  bubbleSender: { fontSize: 11, fontWeight: "600", color: colors.textTertiary, marginBottom: 4 },
  bubbleText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  bubbleTextMe: { color: "#fff" },
  bubbleTime: { fontSize: 11, color: colors.textTertiary, marginTop: 4, textAlign: "right" },
  bubbleTimeMe: { color: "rgba(255,255,255,0.7)" },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 12, paddingVertical: 8, paddingBottom: Platform.OS === "ios" ? 28 : 8,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background,
  },
  input: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: colors.text, maxHeight: 100,
  },
  sendButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary, justifyContent: "center", alignItems: "center",
    marginLeft: 8,
  },
});
