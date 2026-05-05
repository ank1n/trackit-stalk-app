import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchProjects, fetchStates, createIssue, type TProject, type TState } from "../../lib/api";
import { colors, priorityColors } from "../../lib/theme";
import { t, tPriority } from "../../lib/i18n";

const PRIORITIES = [
  { key: "urgent", icon: "alert-circle" },
  { key: "high", icon: "arrow-up" },
  { key: "medium", icon: "remove" },
  { key: "low", icon: "arrow-down" },
  { key: "none", icon: "ellipse-outline" },
];

export default function CreateIssueScreen() {
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const [projects, setProjects] = useState<TProject[]>([]);
  const [states, setStates] = useState<TState[]>([]);
  const [selectedProject, setSelectedProject] = useState<TProject | null>(null);
  const [selectedState, setSelectedState] = useState<TState | null>(null);
  const [title, setTitle] = useState(prefill || "");
  const [priority, setPriority] = useState("medium");
  const [showProjects, setShowProjects] = useState(false);
  const [showStates, setShowStates] = useState(false);
  const [showPriority, setShowPriority] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const allProjs = await fetchProjects();
      // Filter by cached accessible projects
      const cachedRaw = await AsyncStorage.getItem("trackit_accessible_projects").catch(() => null);
      const accessibleIds = cachedRaw ? new Set<string>(JSON.parse(cachedRaw)) : null;
      const projs = accessibleIds ? allProjs.filter((p) => accessibleIds.has(p.id)) : allProjs;
      // Sort by visit history
      const visitedRaw = await AsyncStorage.getItem("trackit_visited_projects").catch(() => null);
      const visited: string[] = visitedRaw ? JSON.parse(visitedRaw) : [];
      projs.sort((a, b) => {
        const ai = visited.indexOf(a.id), bi = visited.indexOf(b.id);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return a.name.localeCompare(b.name);
      });
      setProjects(projs);
      if (projs.length > 0) {
        setSelectedProject(projs[0]);
        const sts = await fetchStates(projs[0].id);
        setStates(sts);
        const todo = sts.find((s) => s.group === "unstarted") || sts[0];
        if (todo) setSelectedState(todo);
      }
    })();
  }, []);

  const onProjectChange = async (proj: TProject) => {
    setSelectedProject(proj);
    setShowProjects(false);
    const sts = await fetchStates(proj.id);
    setStates(sts);
    const todo = sts.find((s) => s.group === "unstarted") || sts[0];
    setSelectedState(todo || null);
  };

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert(t("common.error"), t("create.form.taskName")); return; }
    if (!selectedProject) { Alert.alert(t("common.error"), t("create.form.project")); return; }
    setCreating(true);
    try {
      await createIssue(selectedProject.id, {
        name: title.trim(),
        priority,
        ...(selectedState ? { state: selectedState.id } : {}),
      });
      router.back();
    } catch (e) {
      Alert.alert(t("common.error"), "Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("create.form.title"), presentation: "modal", headerLeft: () => (
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>{t("create.form.cancel")}</Text>
        </TouchableOpacity>
      )}} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Project selector */}
        <Text style={styles.label}>{t("create.form.project")}</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowProjects(!showProjects)}>
          <Text style={styles.selectorText}>{selectedProject?.name || t("create.form.project")}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
        {showProjects && (
          <View style={styles.dropdown}>
            {projects.map((p) => (
              <TouchableOpacity key={p.id} style={styles.dropdownItem} onPress={() => onProjectChange(p)}>
                <Text style={[styles.dropdownText, p.id === selectedProject?.id && styles.dropdownSelected]}>
                  {p.identifier} — {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Title */}
        <Text style={styles.label}>{t("create.form.taskName")}</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder={t("create.form.taskName")}
          placeholderTextColor="#9CA3AF"
          multiline
          autoFocus
        />

        {/* Priority */}
        <Text style={styles.label}>{t("create.form.priority")}</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowPriority(!showPriority)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons
              name={(PRIORITIES.find((p) => p.key === priority)?.icon || "remove") as any}
              size={16}
              color={priorityColors[priority]}
            />
            <Text style={styles.selectorText}>{tPriority(priority)}</Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
        {showPriority && (
          <View style={styles.dropdown}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity key={p.key} style={styles.dropdownItem} onPress={() => { setPriority(p.key); setShowPriority(false); }}>
                <Ionicons name={p.icon as any} size={16} color={priorityColors[p.key]} />
                <Text style={[styles.dropdownText, p.key === priority && styles.dropdownSelected]}>{tPriority(p.key)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* State */}
        <Text style={styles.label}>{t("create.form.status")}</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowStates(!showStates)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {selectedState && <View style={[styles.dot, { backgroundColor: selectedState.color }]} />}
            <Text style={styles.selectorText}>{selectedState?.name || t("create.form.selectStatus")}</Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
        {showStates && (
          <View style={styles.dropdown}>
            {states.map((s) => (
              <TouchableOpacity key={s.id} style={styles.dropdownItem} onPress={() => { setSelectedState(s); setShowStates(false); }}>
                <View style={[styles.dot, { backgroundColor: s.color }]} />
                <Text style={[styles.dropdownText, s.id === selectedState?.id && styles.dropdownSelected]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Create button */}
        <TouchableOpacity
          style={[styles.createButton, (!title.trim() || creating) && { opacity: 0.5 }]}
          onPress={handleCreate}
          disabled={!title.trim() || creating}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createText}>{t("create.form.create")}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#F5F5F7" },
  content: { padding: 20, gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14 },
  titleInput: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    fontSize: 17, color: "#1A1A1A", minHeight: 60, textAlignVertical: "top",
  },
  selector: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
  },
  selectorText: { fontSize: 15, color: "#1A1A1A" },
  dropdown: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", marginTop: -2 },
  dropdownItem: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderTopWidth: 0.5, borderTopColor: "#E5E7EB" },
  dropdownText: { fontSize: 15, color: "#374151" },
  dropdownSelected: { color: colors.primary, fontWeight: "600" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  createButton: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: "center", marginTop: 24,
  },
  createText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});
