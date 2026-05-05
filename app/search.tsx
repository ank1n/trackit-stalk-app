import { useState, useCallback, useRef } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Keyboard,
} from "react-native";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { searchIssues, type TIssue } from "../lib/api";
import { t, tPriority } from "../lib/i18n";
import { priorityColors } from "../lib/theme";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchIssues(q.trim());
      const items = data?.results?.work_items ?? [];
      setResults(items);
    } catch (e) {
      console.error("Search failed:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onChangeText = (text: string) => {
    setQuery(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(text), 400);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.container}>
        {/* Search bar */}
        <View style={s.searchBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#4A7BF7" />
          </TouchableOpacity>
          <View style={s.inputBox}>
            <Ionicons name="search" size={18} color="#8E8E93" />
            <TextInput
              style={s.input}
              value={query}
              onChangeText={onChangeText}
              placeholder={t("search.placeholder")}
              placeholderTextColor="#C7C7CC"
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => doSearch(query)}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(""); setResults([]); setSearched(false); }}>
                <Ionicons name="close-circle" size={18} color="#C7C7CC" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Results */}
        {loading ? (
          <View style={s.center}><ActivityIndicator size="large" color="#4A7BF7" /></View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.list}
            renderItem={({ item }) => {
              const pc = priorityColors[item.priority ?? "none"] || "#9CA3AF";
              return (
                <TouchableOpacity
                  style={s.card}
                  onPress={() => {
                    Keyboard.dismiss();
                    router.push(`/issue/${item.id}?projectId=${item.project ?? item.project_id ?? ""}&identifier=`);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="flag" size={12} color={pc} />
                  <View style={s.cardContent}>
                    <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
                    <Text style={s.cardMeta}>
                      {item.sequence_id ? `#${item.sequence_id}` : ""}
                      {item.priority ? ` · ${tPriority(item.priority)}` : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              searched && !loading ? (
                <View style={s.center}>
                  <Ionicons name="search-outline" size={48} color="#C7C7CC" />
                  <Text style={s.emptyText}>{t("search.empty")}</Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA", paddingTop: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingBottom: 10,
  },
  backBtn: { padding: 4 },
  inputBox: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F2F2F7", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  input: { flex: 1, fontSize: 16, color: "#1A1A1A" },
  list: { padding: 16, gap: 6 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, backgroundColor: "#fff", borderRadius: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardContent: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "500", color: "#1A1A1A", lineHeight: 21 },
  cardMeta: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  emptyText: { fontSize: 15, color: "#C7C7CC", marginTop: 12 },
});
