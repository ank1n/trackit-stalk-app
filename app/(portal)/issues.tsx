import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { router, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePortalAuth } from "../../lib/portal-auth-context";
import { fetchPortalIssues, type PortalIssue } from "../../lib/portal-api";
import { colors, stateGroupColors } from "../../lib/theme";
import { t } from "../../lib/i18n";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

function stateGroupLabel(group: string): string {
  const key = `portal.state.${group}`;
  const val = t(key);
  return val === key ? group : val;
}

export default function PortalIssuesScreen() {
  const { isLoading: authLoading, isAuthenticated, email, logout } = usePortalAuth();
  const [issues, setIssues] = useState<PortalIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchPortalIssues();
      setIssues(data);
    } catch {
      setError(t("portal.loadFailed"));
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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

  const renderItem = ({ item }: { item: PortalIssue }) => {
    const stateColor = stateGroupColors[item.state_group] || colors.textTertiary;
    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: "/(portal)/ticket/[id]", params: { id: item.id } })}
      >
        <View style={s.cardHeader}>
          <View style={[s.stateDot, { backgroundColor: stateColor }]} />
          <Text style={s.cardId}>#{item.sequence_id}</Text>
          <Text style={s.cardDate}>{formatDate(item.created_at)}</Text>
        </View>
        <Text style={s.cardTitle} numberOfLines={2}>{item.name}</Text>
        <Text style={s.cardState}>{stateGroupLabel(item.state_group)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>{t("portal.myRequests")}</Text>
          <Text style={s.headerEmail}>{email}</Text>
        </View>
        <TouchableOpacity onPress={logout} hitSlop={12} accessibilityLabel={t("common.logout")}>
          <Ionicons name="log-out-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {error && !loading ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={issues}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={issues.length === 0 ? s.emptyContainer : s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Ionicons name="document-text-outline" size={56} color={colors.textTertiary} />
              <Text style={s.emptyTitle}>{t("portal.noIssues")}</Text>
              <Text style={s.emptyHint}>{t("portal.noIssuesHint")}</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        activeOpacity={0.85}
        onPress={() => router.push("/(portal)/create")}
        accessibilityLabel={t("portal.createIssue")}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 15, color: colors.textSecondary, textAlign: "center", paddingHorizontal: 32 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  headerEmail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  stateDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  cardId: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  cardDate: { fontSize: 12, color: colors.textTertiary, marginLeft: "auto" },
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 6 },
  cardState: { fontSize: 13, color: colors.textSecondary },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyBox: { alignItems: "center", paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 16 },
  emptyHint: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginTop: 8 },
  fab: {
    position: "absolute", bottom: 32, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
    elevation: 6,
  },
});
