import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  Alert, Keyboard,
} from "react-native";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { t, getLang } from "../lib/i18n";

const NOTES_KEY = "trackit_quick_notes";

type Note = { id: string; text: string; createdAt: string };

async function loadNotes(): Promise<Note[]> {
  const raw = await AsyncStorage.getItem(NOTES_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveNotes(notes: Note[]) {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    loadNotes().then(setNotes);
  }, []);

  const addNote = async () => {
    if (!input.trim()) return;
    const note: Note = { id: Date.now().toString(), text: input.trim(), createdAt: new Date().toISOString() };
    const updated = [note, ...notes];
    setNotes(updated);
    await saveNotes(updated);
    setInput("");
    Keyboard.dismiss();
  };

  const deleteNote = async (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    await saveNotes(updated);
  };

  const createTaskFromNote = (note: Note) => {
    router.push(`/issue/create?prefill=${encodeURIComponent(note.text)}`);
  };

  const locale = getLang() === "ru" ? "ru-RU" : "en-US";

  return (
    <>
      <Stack.Screen options={{ title: t("notes.title"), headerBackTitle: t("issue.back") }} />
      <View style={s.container}>
        {/* Input */}
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder={t("notes.placeholder")}
            placeholderTextColor="#C7C7CC"
            multiline
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={addNote}
          />
          <TouchableOpacity
            style={[s.addBtn, !input.trim() && { opacity: 0.4 }]}
            onPress={addNote}
            disabled={!input.trim()}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Notes list */}
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardContent}>
                <Text style={s.noteText}>{item.text}</Text>
                <Text style={s.noteMeta}>
                  {new Date(item.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => createTaskFromNote(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#4A7BF7" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => {
                    Alert.alert(t("notes.delete"), item.text.slice(0, 50), [
                      { text: t("common.cancel"), style: "cancel" },
                      { text: t("notes.delete"), style: "destructive", onPress: () => deleteNote(item.id) },
                    ]);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="document-text-outline" size={48} color="#C7C7CC" />
              <Text style={s.emptyText}>{t("notes.empty")}</Text>
            </View>
          }
        />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    padding: 16, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB",
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 100, fontSize: 15, color: "#1A1A1A",
    backgroundColor: "#F2F2F7", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  addBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#4A7BF7",
    justifyContent: "center", alignItems: "center",
  },
  list: { padding: 16, gap: 8 },
  card: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, padding: 14, gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardContent: { flex: 1, gap: 4 },
  noteText: { fontSize: 15, color: "#1A1A1A", lineHeight: 21 },
  noteMeta: { fontSize: 11, color: "#8E8E93" },
  cardActions: { gap: 12, justifyContent: "center" },
  actionBtn: { padding: 2 },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 15, color: "#C7C7CC", marginTop: 12 },
});
