import { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  type NativeSyntheticEvent, type TextInputSelectionChangeEventData,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Tool = {
  icon: string;
  action: (text: string, selStart: number, selEnd: number) => { text: string; cursor: number };
  title: string;
};

function wrap(before: string, after: string = before): Tool["action"] {
  return (text, s, e) => {
    const sel = text.slice(s, e);
    const next = text.slice(0, s) + before + sel + after + text.slice(e);
    return { text: next, cursor: e + before.length + after.length };
  };
}

function prefixLine(prefix: string): Tool["action"] {
  return (text, s, _e) => {
    // find start of line
    let lineStart = s;
    while (lineStart > 0 && text[lineStart - 1] !== "\n") lineStart -= 1;
    const next = text.slice(0, lineStart) + prefix + text.slice(lineStart);
    return { text: next, cursor: s + prefix.length };
  };
}

const TOOLS: Tool[] = [
  { icon: "text", title: "B", action: wrap("**") },
  { icon: "text-outline", title: "I", action: wrap("*") },
  { icon: "code-slash", title: "<>", action: wrap("`") },
  { icon: "list", title: "•", action: prefixLine("- ") },
  { icon: "checkbox-outline", title: "☑", action: prefixLine("- [ ] ") },
  { icon: "chevron-forward", title: "H", action: prefixLine("## ") },
  { icon: "link-outline", title: "@", action: wrap("[", "](url)") },
];

// ---------- Markdown ↔ HTML ----------

function inlineToHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, '<a href="$2">$1</a>');
}

export function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inTaskList = false;
  let inList = false;
  const closeLists = () => {
    if (inTaskList) { out.push("</ul>"); inTaskList = false; }
    if (inList) { out.push("</ul>"); inList = false; }
  };
  for (const raw of lines) {
    const line = raw;
    const task = line.match(/^- \[( |x|X)\] (.*)$/);
    const bullet = line.match(/^- (.*)$/);
    const h1 = line.match(/^# (.*)$/);
    const h2 = line.match(/^## (.*)$/);
    const h3 = line.match(/^### (.*)$/);
    if (task) {
      if (inList) { out.push("</ul>"); inList = false; }
      if (!inTaskList) { out.push('<ul data-type="taskList">'); inTaskList = true; }
      const checked = task[1].toLowerCase() === "x";
      out.push(`<li data-checked="${checked}" data-type="taskItem"><p>${inlineToHtml(task[2])}</p></li>`);
    } else if (bullet) {
      if (inTaskList) { out.push("</ul>"); inTaskList = false; }
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inlineToHtml(bullet[1])}</li>`);
    } else if (h1) {
      closeLists();
      out.push(`<h1>${inlineToHtml(h1[1])}</h1>`);
    } else if (h2) {
      closeLists();
      out.push(`<h2>${inlineToHtml(h2[1])}</h2>`);
    } else if (h3) {
      closeLists();
      out.push(`<h3>${inlineToHtml(h3[1])}</h3>`);
    } else if (line.trim() === "") {
      closeLists();
    } else {
      closeLists();
      out.push(`<p>${inlineToHtml(line)}</p>`);
    }
  }
  closeLists();
  return out.join("");
}

export function htmlToMd(html: string): string {
  if (!html) return "";
  let md = html;
  md = md.replace(/\r/g, "");
  md = md.replace(/<ul\s+[^>]*data-type="taskList"[^>]*>/gi, "\n");
  md = md.replace(/<li[^>]*data-checked="true"[^>]*>\s*(?:<p[^>]*>)?([\s\S]*?)(?:<\/p>)?\s*<\/li>/gi, "- [x] $1\n");
  md = md.replace(/<li[^>]*data-checked="false"[^>]*>\s*(?:<p[^>]*>)?([\s\S]*?)(?:<\/p>)?\s*<\/li>/gi, "- [ ] $1\n");
  md = md.replace(/<\/ul>/gi, "\n");
  md = md.replace(/<ul[^>]*>/gi, "\n");
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n");
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<[^>]*>/g, "");
  md = md.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  md = md.replace(/\n{3,}/g, "\n\n").trim();
  return md;
}

// ---------- Component ----------

type Props = {
  valueHtml: string;
  onChangeHtml: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  autoFocus?: boolean;
};

export function RichEditor({
  valueHtml,
  onChangeHtml,
  placeholder,
  minHeight = 120,
  autoFocus,
}: Props) {
  const [md, setMd] = useState(() => htmlToMd(valueHtml));
  const [sel, setSel] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const inputRef = useRef<TextInput>(null);

  const emit = (next: string) => {
    setMd(next);
    onChangeHtml(mdToHtml(next));
  };

  const runTool = (tool: Tool) => {
    const { text, cursor } = tool.action(md, sel.start, sel.end);
    emit(text);
    setSel({ start: cursor, end: cursor });
    setTimeout(() => {
      inputRef.current?.setNativeProps({ selection: { start: cursor, end: cursor } });
    }, 10);
  };

  return (
    <View style={s.wrap}>
      <View style={s.toolbar}>
        {TOOLS.map((tool, i) => (
          <TouchableOpacity
            key={i}
            style={s.toolBtn}
            onPress={() => runTool(tool)}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={s.toolText}>{tool.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        style={[s.input, { minHeight }]}
        multiline
        value={md}
        onChangeText={emit}
        onSelectionChange={(
          e: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
        ) => setSel(e.nativeEvent.selection)}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        autoFocus={autoFocus}
        textAlignVertical="top"
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  toolbar: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    padding: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 2,
  },
  toolText: { fontSize: 14, fontWeight: "700", color: "#4A7BF7" },
  input: {
    padding: 12,
    fontSize: 15,
    color: "#1A1A1A",
    lineHeight: 22,
  },
});
