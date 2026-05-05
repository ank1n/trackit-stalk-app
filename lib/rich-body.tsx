import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "  - ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type TaskItem = { checked: boolean; text: string };
export type Segment =
  | { kind: "text"; text: string }
  | { kind: "taskList"; listIdx: number; items: TaskItem[] };

const TASK_LIST_RE = /<ul\s+[^>]*data-type="taskList"[^>]*>([\s\S]*?)<\/ul>/gi;
const TASK_ITEM_RE = /<li[^>]*data-checked="(true|false)"[^>]*>([\s\S]*?)<\/li>/gi;

export function parseSegments(html: string): Segment[] {
  if (!html) return [];
  const segments: Segment[] = [];
  let lastEnd = 0;
  let listIdx = 0;
  TASK_LIST_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TASK_LIST_RE.exec(html)) !== null) {
    if (m.index > lastEnd) {
      const text = html.slice(lastEnd, m.index);
      if (stripHtml(text)) segments.push({ kind: "text", text });
    }
    const body = m[1];
    const items: TaskItem[] = [];
    TASK_ITEM_RE.lastIndex = 0;
    let im: RegExpExecArray | null;
    while ((im = TASK_ITEM_RE.exec(body)) !== null) {
      items.push({ checked: im[1] === "true", text: stripHtml(im[2]) });
    }
    segments.push({ kind: "taskList", listIdx, items });
    listIdx += 1;
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd < html.length) {
    const text = html.slice(lastEnd);
    if (stripHtml(text)) segments.push({ kind: "text", text });
  }
  return segments;
}

export function toggleTaskItem(html: string, listIdx: number, itemIdx: number): string {
  let currentListIdx = 0;
  TASK_LIST_RE.lastIndex = 0;
  return html.replace(TASK_LIST_RE, (whole) => {
    if (currentListIdx !== listIdx) {
      currentListIdx += 1;
      return whole;
    }
    currentListIdx += 1;
    let itemCount = 0;
    const replaced = whole.replace(
      /data-checked="(true|false)"/gi,
      (match, value) => {
        if (itemCount === itemIdx) {
          itemCount += 1;
          return `data-checked="${value === "true" ? "false" : "true"}"`;
        }
        itemCount += 1;
        return match;
      },
    );
    return replaced;
  });
}

export function RichBody({
  html,
  onHtmlChange,
  textStyle,
}: {
  html: string;
  onHtmlChange?: (newHtml: string) => Promise<void> | void;
  textStyle?: any;
}) {
  const segments = useMemo(() => parseSegments(html), [html]);
  const [pending, setPending] = useState<string | null>(null);

  const handleToggle = async (listIdx: number, itemIdx: number) => {
    if (!onHtmlChange) return;
    const key = `${listIdx}-${itemIdx}`;
    if (pending === key) return;
    setPending(key);
    const newHtml = toggleTaskItem(html, listIdx, itemIdx);
    try {
      await onHtmlChange(newHtml);
    } finally {
      setPending(null);
    }
  };

  if (segments.length === 0) {
    return <Text style={textStyle}>{stripHtml(html)}</Text>;
  }

  return (
    <View>
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          const text = stripHtml(seg.text);
          if (!text) return null;
          return (
            <Text key={`t-${i}`} style={textStyle}>
              {text}
            </Text>
          );
        }
        const done = seg.items.filter((it) => it.checked).length;
        return (
          <View key={`l-${i}`} style={styles.list}>
            {seg.items.map((item, j) => {
              const key = `${seg.listIdx}-${j}`;
              const isPending = pending === key;
              return (
                <TouchableOpacity
                  key={j}
                  style={[styles.item, isPending && { opacity: 0.5 }]}
                  onPress={() => handleToggle(seg.listIdx, j)}
                  disabled={!onHtmlChange || isPending}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Ionicons
                    name={item.checked ? "checkbox" : "square-outline"}
                    size={20}
                    color={item.checked ? "#22C55E" : "#9CA3AF"}
                  />
                  <Text
                    style={[
                      styles.itemText,
                      item.checked && styles.itemTextDone,
                    ]}
                  >
                    {item.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {seg.items.length > 0 && (
              <Text style={styles.progress}>
                {done} / {seg.items.length}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginVertical: 6 },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 6,
    gap: 8,
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    color: "#1A1A1A",
    lineHeight: 22,
  },
  itemTextDone: {
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  progress: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
    fontStyle: "italic",
  },
});
