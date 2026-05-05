import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
  Dimensions, Image, Modal, Pressable,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
// RenderHtml removed — was causing crashes on some devices
import {
  fetchIssue, fetchStates, fetchLabels, fetchComments, createComment, updateComment, updateIssue, createLabel,
  fetchAttachments, uploadAttachment, deleteAttachment, fetchMembers, setCoverImage, getSessionCookie, BASE_URL,
  type TIssue, type TState, type TLabel, type TComment, type TAttachment, type TMember,
} from "../../lib/api";
import { RichBody, stripHtml } from "../../lib/rich-body";
import { RichEditor } from "../../lib/rich-editor";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors, priorityColors } from "../../lib/theme";
import { t, tPriority, getLang } from "../../lib/i18n";

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

export default function IssueDetailScreen() {
  const params = useLocalSearchParams<{ id: string; projectId: string; identifier: string }>();
  const id = params.id;
  const projectId = params.projectId;
  const identifier = params.identifier;

  console.log("[IssueDetail] MOUNTED id=", id, "projectId=", projectId);
  const [issue, setIssue] = useState<TIssue | null>(null);
  const [state, setState] = useState<TState | null>(null);
  const [allStates, setAllStates] = useState<TState[]>([]);
  const [allLabels, setAllLabels] = useState<Record<string, TLabel>>({});
  const [comments, setComments] = useState<TComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showPrioPicker, setShowPrioPicker] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#8B5CF6");
  const [attachments, setAttachments] = useState<TAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [members, setMembers] = useState<TMember[]>([]);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState("");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [commentAccess, setCommentAccess] = useState<"INTERNAL" | "EXTERNAL">("EXTERNAL");
  const [coverId, setCoverId] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!id || !projectId) return;
    try {
      // Load auth headers first so images render immediately
      const cookie = await getSessionCookie();
      if (cookie) setAuthHeaders({ Cookie: cookie });

      const [issueData, statesData, labelsData, commentsData, attachData, membersData] = await Promise.all([
        fetchIssue(projectId, id),
        fetchStates(projectId),
        fetchLabels(projectId),
        fetchComments(projectId, id).catch(() => []),
        fetchAttachments(projectId, id).catch(() => []),
        fetchMembers(projectId).catch(() => []),
      ]);
      if (!issueData) {
        Alert.alert("Ошибка", "Нет доступа к задаче или задача не найдена");
        return;
      }
      setIssue(issueData);
      setAllStates(statesData || []);
      setState((statesData || []).find((s: any) => s.id === (issueData.state_id || issueData.state)) ?? null);
      const lm: Record<string, TLabel> = {};
      for (const l of labelsData) lm[l.id] = l;
      setAllLabels(lm);
      setComments(commentsData);
      setAttachments(attachData);
      setMembers(membersData);
      // Cover is now authoritative on the server. Clear any legacy AsyncStorage
      // entry so it can't resurrect a cover that was removed elsewhere.
      const serverCover = (issueData as any).cover_image_asset_id as string | null | undefined;
      setCoverId(serverCover ?? null);
      AsyncStorage.removeItem(`cover_${id}`).catch(() => {});
    } catch (e: any) {
      console.error("Failed to load issue", e);
      Alert.alert("Ошибка загрузки", `${e?.message || "Не удалось загрузить задачу"}\n\nprojectId: ${projectId}\nid: ${id}`);
    } finally {
      setLoading(false);
    }
  }, [id, projectId]);

  useEffect(() => { load(); }, [load]);

  const handleChangeState = async (newState: TState) => {
    if (!projectId || !id || !issue) return;
    setShowStatePicker(false);
    const prev = state;
    setState(newState);
    setIssue({ ...issue, state: newState.id });
    try {
      await updateIssue(projectId, id, { state: newState.id } as any);
    } catch {
      setState(prev);
      if (issue) setIssue({ ...issue, state: prev?.id || issue.state });
    }
  };

  const handleChangePriority = async (newPrio: string) => {
    if (!projectId || !id || !issue) return;
    setShowPrioPicker(false);
    const prev = issue.priority;
    setIssue({ ...issue, priority: newPrio as any });
    try {
      await updateIssue(projectId, id, { priority: newPrio } as any);
    } catch {
      setIssue({ ...issue, priority: prev });
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !projectId || !id) return;
    setSending(true);
    try {
      const newComment = await createComment(projectId, id, commentText.trim(), commentAccess);
      setComments((prev) => [...prev, newComment]);
      setCommentText("");
    } catch (e) {
      Alert.alert(t("common.error"), "Failed to send comment");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <><Stack.Screen options={{ title: "" }} />
      <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></>
    );
  }

  if (!issue) {
    return (
      <><Stack.Screen options={{ title: t("common.error") }} />
      <View style={styles.center}><Text style={styles.errorText}>{t("issue.title")}</Text></View></>
    );
  }

  const prioColor = priorityColors[issue.priority] || colors.priorityNone;
  const issueLabels = (issue.label_ids ?? []).map((lid) => allLabels[lid]).filter(Boolean);
  const descHtml = issue.description_html ?? "";
  const hasDesc = !!stripHtml(descHtml);
  const imageAttachments = attachments.filter((a) => {
    const n = (a.attributes?.name || "").toLowerCase();
    return n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".gif") || n.endsWith(".webp");
  });

  return (
    <>
      <Stack.Screen options={{ title: `${identifier}-${issue.sequence_id}`, headerBackTitle: t("issue.back") }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header badges — tappable */}
          <View style={styles.headerBadges}>
            {state && (
              <TouchableOpacity
                style={[styles.stateBadge, { backgroundColor: state.color + "20", borderColor: state.color }]}
                onPress={() => setShowStatePicker(!showStatePicker)}
              >
                <View style={[styles.dot, { backgroundColor: state.color }]} />
                <Text style={[styles.stateText, { color: state.color }]}>{state.name}</Text>
                <Ionicons name="chevron-down" size={12} color={state.color} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.prioBadge, { borderColor: prioColor + "40" }]}
              onPress={() => setShowPrioPicker(!showPrioPicker)}
            >
              <Ionicons name="flag" size={12} color={prioColor} />
              <Text style={[styles.prioText, { color: prioColor }]}>{tPriority(issue.priority)}</Text>
              <Ionicons name="chevron-down" size={12} color={prioColor} />
            </TouchableOpacity>
          </View>

          {/* State picker */}
          {showStatePicker && (
            <View style={styles.pickerCard}>
              {allStates.map((s) => (
                <TouchableOpacity key={s.id} style={styles.pickerItem} onPress={() => handleChangeState(s)}>
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                  <Text style={[styles.pickerText, s.id === state?.id && { color: colors.primary, fontWeight: "600" }]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Priority picker */}
          {showPrioPicker && (
            <View style={styles.pickerCard}>
              {(["urgent", "high", "medium", "low", "none"] as const).map((p) => (
                <TouchableOpacity key={p} style={styles.pickerItem} onPress={() => handleChangePriority(p)}>
                  <Ionicons name="flag" size={14} color={priorityColors[p]} />
                  <Text style={[styles.pickerText, p === issue.priority && { color: colors.primary, fontWeight: "600" }]}>{tPriority(p)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Title */}
          {/* Title — editable */}
          {editingTitle ? (
            <TextInput
              style={[styles.title, { backgroundColor: "#F2F2F7", borderRadius: 8, padding: 8 }]}
              value={titleText}
              onChangeText={setTitleText}
              autoFocus
              multiline
              onBlur={async () => {
                setEditingTitle(false);
                if (titleText.trim() && titleText.trim() !== issue.name) {
                  setIssue({ ...issue, name: titleText.trim() });
                  await updateIssue(projectId!, id!, { name: titleText.trim() } as any).catch(() => {});
                }
              }}
            />
          ) : (
            <TouchableOpacity onLongPress={() => { setTitleText(issue.name); setEditingTitle(true); }}>
              <Text style={styles.title}>{issue.name}</Text>
            </TouchableOpacity>
          )}

          {/* Labels — tappable */}
          <TouchableOpacity
            style={styles.labelsRow}
            onPress={() => setShowLabelPicker(!showLabelPicker)}
          >
            {issueLabels.length > 0 ? (
              issueLabels.map((l) => (
                <View key={l.id} style={[styles.labelChip, { backgroundColor: l.color + "20" }]}>
                  <View style={[styles.labelDot, { backgroundColor: l.color }]} />
                  <Text style={[styles.labelName, { color: l.color }]}>{l.name}</Text>
                </View>
              ))
            ) : (
              <View style={[styles.labelChip, { backgroundColor: "#F2F2F7" }]}>
                <Ionicons name="add" size={12} color="#8E8E93" />
                <Text style={[styles.labelName, { color: "#8E8E93" }]}>{t("issue.addLabel")}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Label picker — like Trello */}
          {showLabelPicker && (
            <View style={styles.pickerCard}>
              {/* Existing labels */}
              {Object.values(allLabels).map((l) => {
                const isSelected = (issue.label_ids ?? []).includes(l.id);
                return (
                  <TouchableOpacity
                    key={l.id}
                    style={styles.pickerItem}
                    onPress={async () => {
                      const currentIds = issue.label_ids ?? [];
                      const newIds = isSelected
                        ? currentIds.filter((lid: string) => lid !== l.id)
                        : [...currentIds, l.id];
                      setIssue({ ...issue, label_ids: newIds });
                      try {
                        await updateIssue(projectId!, id!, { label_ids: newIds } as any);
                      } catch {
                        setIssue({ ...issue });
                      }
                    }}
                  >
                    <View style={[styles.labelColorBar, { backgroundColor: l.color }]} />
                    <Text style={[styles.pickerText, { flex: 1 }]}>{l.name}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#4A7BF7" />}
                  </TouchableOpacity>
                );
              })}

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: "#E5E7EB", marginVertical: 4 }} />

              {/* Create new label */}
              {!showNewLabel ? (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => setShowNewLabel(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#4A7BF7" />
                  <Text style={[styles.pickerText, { color: "#4A7BF7", fontWeight: "600" }]}>{t("issue.createLabel")}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.newLabelForm}>
                  <TextInput
                    style={styles.newLabelInput}
                    value={newLabelName}
                    onChangeText={setNewLabelName}
                    placeholder={t("issue.labelName")}
                    placeholderTextColor="#C7C7CC"
                    autoFocus
                  />
                  {/* Color palette */}
                  <View style={styles.colorPalette}>
                    {["#EF4444","#F97316","#EAB308","#22C55E","#3B82F6","#8B5CF6","#EC4899","#6B7280","#0EA5E9","#14B8A6"].map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.colorDot, { backgroundColor: c }, newLabelColor === c && styles.colorDotSelected]}
                        onPress={() => setNewLabelColor(c)}
                      />
                    ))}
                  </View>
                  <View style={styles.newLabelActions}>
                    <TouchableOpacity
                      style={styles.newLabelCreateBtn}
                      onPress={async () => {
                        if (!newLabelName.trim() || !projectId) return;
                        try {
                          const label = await createLabel(projectId, newLabelName.trim(), newLabelColor);
                          // Add to local state
                          setAllLabels((prev) => ({ ...prev, [label.id]: label }));
                          // Auto-assign to issue
                          const newIds = [...(issue.label_ids ?? []), label.id];
                          setIssue({ ...issue, label_ids: newIds });
                          await updateIssue(projectId, id!, { label_ids: newIds } as any);
                          setNewLabelName("");
                          setShowNewLabel(false);
                        } catch {
                          Alert.alert(t("common.error"), "Failed to create label");
                        }
                      }}
                    >
                      <Text style={styles.newLabelCreateText}>{t("issue.create")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setShowNewLabel(false); setNewLabelName(""); }}>
                      <Ionicons name="close" size={22} color="#8E8E93" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Assignees */}
          <TouchableOpacity style={styles.propsCard} onPress={() => setShowAssigneePicker(!showAssigneePicker)}>
            <View style={styles.propRow}>
              <Text style={styles.propLabel}>{getLang() === "ru" ? "Исполнители" : "Assignees"}</Text>
              <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                {(issue.assignee_ids ?? []).length > 0 ? (
                  (issue.assignee_ids ?? []).map((aid) => {
                    const m = members.find((mm) => mm.id === aid);
                    const avatarUri = m?.avatar && m.avatar.startsWith("/") ? `${BASE_URL}${m.avatar}` : m?.avatar;
                    return avatarUri ? (
                      <Image key={aid} source={{ uri: avatarUri, headers: authHeaders }} style={styles.assigneeAvatar} />
                    ) : (
                      <View key={aid} style={styles.assigneeChip}>
                        <Text style={styles.assigneeText}>{(m?.first_name || m?.display_name || "?").charAt(0)}</Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={{ fontSize: 13, color: "#C7C7CC" }}>+</Text>
                )}
                <Ionicons name="chevron-down" size={12} color="#C7C7CC" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Assignee picker */}
          {showAssigneePicker && (
            <View style={styles.pickerCard}>
              {members.map((m) => {
                const isAssigned = (issue.assignee_ids ?? []).includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.pickerItem}
                    onPress={async () => {
                      const ids = issue.assignee_ids ?? [];
                      const newIds = isAssigned ? ids.filter((i: string) => i !== m.id) : [...ids, m.id];
                      setIssue({ ...issue, assignee_ids: newIds });
                      await updateIssue(projectId!, id!, { assignee_ids: newIds } as any).catch(() => {});
                    }}
                  >
                    {(() => {
                      const avatarUri = m.avatar && m.avatar.startsWith("/") ? `${BASE_URL}${m.avatar}` : m.avatar;
                      return avatarUri ? (
                        <Image source={{ uri: avatarUri, headers: authHeaders }} style={styles.assigneeAvatar} />
                      ) : (
                        <View style={styles.assigneeChip}>
                          <Text style={styles.assigneeText}>{(m.first_name || m.display_name || "?").charAt(0)}</Text>
                        </View>
                      );
                    })()}
                    <Text style={[styles.pickerText, { flex: 1 }]}>{m.first_name || m.display_name}</Text>
                    {isAssigned && <Ionicons name="checkmark-circle" size={20} color="#4A7BF7" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Properties */}
          <View style={styles.propsCard}>
            <PropRow label={t("issue.created")} value={new Date(issue.created_at).toLocaleDateString(getLang() === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "long", year: "numeric" })} />
            <PropRow label={t("issue.updated")} value={timeAgo(issue.updated_at)} />
            <TouchableOpacity style={styles.propRow} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.propLabel}>{t("issue.deadline")}</Text>
              <Text style={[styles.propValue, !issue.target_date && { color: "#C7C7CC" }]}>
                {issue.target_date
                  ? new Date(issue.target_date).toLocaleDateString(getLang() === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "long" })
                  : (getLang() === "ru" ? "Установить" : "Set")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Date picker */}
          {showDatePicker && (
            <DateTimePicker
              value={issue.target_date ? new Date(issue.target_date) : new Date()}
              mode="date"
              display="spinner"
              onChange={async (event: any, date?: Date) => {
                setShowDatePicker(false);
                if (event.type === "set" && date) {
                  const dateStr = date.toISOString().split("T")[0];
                  setIssue({ ...issue, target_date: dateStr });
                  await updateIssue(projectId!, id!, { target_date: dateStr } as any).catch(() => {});
                }
              }}
            />
          )}

          {/* Description */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("issue.description")}</Text>
              {!editingDesc && (
                <TouchableOpacity
                  style={styles.attachBtn}
                  onPress={() => { setDescDraft(descHtml); setEditingDesc(true); }}
                >
                  <Ionicons name={hasDesc ? "create-outline" : "add-circle-outline"} size={18} color="#4A7BF7" />
                  <Text style={styles.attachBtnText}>{hasDesc ? (getLang() === "ru" ? "Правка" : "Edit") : (getLang() === "ru" ? "Добавить" : "Add")}</Text>
                </TouchableOpacity>
              )}
            </View>
            {editingDesc ? (
              <View>
                <RichEditor
                  valueHtml={descDraft}
                  onChangeHtml={setDescDraft}
                  minHeight={160}
                  autoFocus
                  placeholder={t("issue.description")}
                />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                  <TouchableOpacity
                    style={[styles.newLabelCreateBtn, { backgroundColor: "#8E8E93" }]}
                    onPress={() => setEditingDesc(false)}
                    disabled={savingDesc}
                  >
                    <Text style={styles.newLabelCreateText}>{t("common.cancel")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.newLabelCreateBtn, savingDesc && { opacity: 0.4 }]}
                    onPress={async () => {
                      if (!projectId || !id) return;
                      setSavingDesc(true);
                      try {
                        await updateIssue(projectId, id, { description_html: descDraft } as any);
                        setIssue({ ...issue, description_html: descDraft });
                        setEditingDesc(false);
                      } catch (e: any) {
                        Alert.alert(t("common.error"), e?.message || "Save failed");
                      } finally {
                        setSavingDesc(false);
                      }
                    }}
                    disabled={savingDesc}
                  >
                    <Text style={styles.newLabelCreateText}>{savingDesc ? "..." : (getLang() === "ru" ? "Сохранить" : "Save")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : hasDesc ? (
              <View style={styles.descText}>
                <RichBody
                  html={descHtml}
                  textStyle={styles.descBodyText}
                  onHtmlChange={async (newHtml) => {
                    setIssue({ ...issue, description_html: newHtml });
                    try {
                      await updateIssue(projectId!, id!, { description_html: newHtml } as any);
                    } catch {
                      setIssue({ ...issue, description_html: descHtml });
                    }
                  }}
                />
              </View>
            ) : (
              <Text style={styles.noContent}>{t("issue.noDescription")}</Text>
            )}
          </View>

          {/* Attachments */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("issue.attachments")} ({attachments.length})</Text>
              <TouchableOpacity
                style={styles.attachBtn}
                onPress={async () => {
                  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (status !== "granted") {
                    Alert.alert(t("common.error"), "Permission denied");
                    return;
                  }
                  try {
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      quality: 0.5,
                      allowsEditing: false,
                    });
                    if (result.canceled || !result.assets?.[0]) return;
                    const asset = result.assets[0];
                    setUploading(true);
                    const name = asset.fileName || `photo_${Date.now()}.jpg`;
                    const size = asset.fileSize || 10000000; // 10MB default if unknown
                    const uploaded = await uploadAttachment(projectId!, id!, asset.uri, name, Math.round(size));
                    setAttachments((prev) => [uploaded, ...prev]);
                  } catch (e: any) {
                    Alert.alert(t("common.error"), e?.message || "Upload failed");
                  } finally {
                    setUploading(false);
                  }
                }}
              >
                <Ionicons name="camera-outline" size={18} color="#4A7BF7" />
                <Text style={styles.attachBtnText}>{uploading ? "..." : t("issue.addPhoto")}</Text>
              </TouchableOpacity>
            </View>
            {attachments.length > 0 ? (
              <View style={styles.attachGrid}>
                {attachments.map((a, idx) => {
                  const fname = (a.attributes?.name || "file").toLowerCase();
                  const isImg = fname.endsWith(".jpg") || fname.endsWith(".jpeg") || fname.endsWith(".png") || fname.endsWith(".gif") || fname.endsWith(".webp");
                  const imgSource = isImg && a.id ? { uri: `${BASE_URL}/api/assets/v2/workspaces/implica/projects/${projectId}/issues/${id}/proxy/${a.id}/?w=200`, headers: authHeaders } : null;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      style={styles.attachItem}
                      onPress={() => {
                        if (imgSource) {
                          setPreviewIndex(imageAttachments.findIndex((ia) => ia.id === a.id));
                          setPreviewUri(imgSource.uri);
                        }
                      }}
                      onLongPress={() => {
                        Alert.alert(
                          getLang() === "ru" ? "Удалить вложение?" : "Delete attachment?",
                          a.attributes?.name || "",
                          [
                            { text: t("common.cancel"), style: "cancel" },
                            {
                              text: getLang() === "ru" ? "Удалить" : "Delete",
                              style: "destructive",
                              onPress: async () => {
                                setAttachments((prev) => prev.filter((att) => att.id !== a.id));
                                await deleteAttachment(projectId!, id!, a.id).catch(() => {});
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <View>
                        {imgSource ? (
                          <View style={styles.attachThumbWrap}>
                            <View style={styles.attachImageBox}>
                              <Ionicons name="image" size={20} color="#4A7BF7" />
                            </View>
                            <Image source={imgSource} style={styles.attachThumbAbsolute} resizeMode="cover" />
                          </View>
                        ) : (
                          <View style={isImg ? styles.attachImageBox : styles.attachFileBox}>
                            <Ionicons name={isImg ? "image" : "document"} size={24} color={isImg ? "#4A7BF7" : "#8E8E93"} />
                          </View>
                        )}
                        {isImg && (
                          <TouchableOpacity
                            style={styles.coverStar}
                            onPress={async () => {
                              if (!projectId || !id) return;
                              const newId = coverId === a.id ? null : a.id;
                              const prev = coverId;
                              setCoverId(newId);
                              setIssue({ ...issue, cover_image_asset_id: newId } as any);
                              try {
                                await setCoverImage(projectId, id, newId);
                                if (newId) AsyncStorage.setItem(`cover_${id}`, newId).catch(() => {});
                                else AsyncStorage.removeItem(`cover_${id}`).catch(() => {});
                              } catch (e) {
                                setCoverId(prev);
                                setIssue({ ...issue, cover_image_asset_id: prev } as any);
                                Alert.alert(t("common.error"), "Cover update failed");
                              }
                            }}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name={coverId === a.id ? "star" : "star-outline"} size={14} color={coverId === a.id ? "#F59E0B" : "#C7C7CC"} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.attachName} numberOfLines={1}>{a.attributes?.name || "file"}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.noContent}>{t("issue.noAttachments")}</Text>
            )}
          </View>

          {/* Comments */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("issue.comments")} ({comments.length})</Text>
              {!showCommentInput && (
                <TouchableOpacity style={styles.attachBtn} onPress={() => { setShowCommentInput(true); setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300); }}>
                  <Ionicons name="add-circle-outline" size={18} color="#4A7BF7" />
                  <Text style={styles.attachBtnText}>{t("issue.addComment")}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Inline comment input */}
            {showCommentInput && (
              <View style={styles.inlineCommentBox}>
                {/* Internal/External toggle */}
                <View style={styles.commentAccessRow}>
                  <TouchableOpacity
                    style={[styles.accessPill, commentAccess === "EXTERNAL" && styles.accessPillActive]}
                    onPress={() => setCommentAccess("EXTERNAL")}
                  >
                    <Ionicons name="globe-outline" size={12} color={commentAccess === "EXTERNAL" ? "#fff" : "#8E8E93"} />
                    <Text style={[styles.accessPillText, commentAccess === "EXTERNAL" && styles.accessPillTextActive]}>
                      {getLang() === "ru" ? "Внешний" : "External"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.accessPill, commentAccess === "INTERNAL" && styles.accessPillActiveInternal]}
                    onPress={() => setCommentAccess("INTERNAL")}
                  >
                    <Ionicons name="lock-closed-outline" size={12} color={commentAccess === "INTERNAL" ? "#fff" : "#8E8E93"} />
                    <Text style={[styles.accessPillText, commentAccess === "INTERNAL" && styles.accessPillTextActive]}>
                      {getLang() === "ru" ? "Внутренний" : "Internal"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.inlineCommentInput}
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder={t("issue.commentPlaceholder")}
                  placeholderTextColor="#9CA3AF"
                  multiline
                  autoFocus
                />
                <View style={styles.inlineCommentActions}>
                  <TouchableOpacity
                    style={[styles.sendButton, (!commentText.trim() || sending) && { opacity: 0.4 }]}
                    onPress={async () => {
                      await handleSendComment();
                      setShowCommentInput(false);
                    }}
                    disabled={!commentText.trim() || sending}
                  >
                    <Ionicons name="send" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowCommentInput(false); setCommentText(""); }} style={{ padding: 8 }}>
                    <Ionicons name="close" size={20} color="#8E8E93" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {comments.length === 0 && !showCommentInput && (
              <Text style={styles.noContent}>{t("issue.noComments")}</Text>
            )}
            {comments.map((c) => {
              const isInternal = c.access === "INTERNAL";
              return (
                <View key={c.id} style={styles.comment}>
                  <View style={styles.commentHeader}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>
                        {(c.actor_detail?.display_name || c.actor_detail?.first_name || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.commentAuthor}>{c.actor_detail?.display_name || "User"}</Text>
                    {!isInternal && (
                      <Ionicons name="globe-outline" size={10} color="#4A7BF7" />
                    )}
                    <View style={{ flex: 1 }} />
                    <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                  </View>
                  <RichBody
                    html={c.comment_html ?? ""}
                    textStyle={styles.commentText}
                    onHtmlChange={async (newHtml) => {
                      setComments((prev) => prev.map((cc) => cc.id === c.id ? { ...cc, comment_html: newHtml } : cc));
                      try {
                        await updateComment(projectId!, id!, c.id, { comment_html: newHtml });
                      } catch {
                        setComments((prev) => prev.map((cc) => cc.id === c.id ? { ...cc, comment_html: c.comment_html } : cc));
                      }
                    }}
                  />
                </View>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fullscreen image carousel */}
      {previewUri && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
          <View style={styles.previewOverlay}>
            {/* Close button */}
            <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewUri(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {/* Counter */}
            {imageAttachments.length > 1 && (
              <Text style={styles.previewCounter}>
                {Math.min(previewIndex + 1, imageAttachments.length)} / {imageAttachments.length}
              </Text>
            )}
            {/* Scrollable images */}
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: previewIndex * Dimensions.get("window").width, y: 0 }}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get("window").width);
                setPreviewIndex(idx);
              }}
              style={{ flex: 1 }}
            >
              {imageAttachments.map((a) => (
                <Pressable key={a.id} style={{ width: Dimensions.get("window").width, justifyContent: "center", alignItems: "center" }} onPress={() => setPreviewUri(null)}>
                  <Image
                    source={{ uri: `${BASE_URL}/api/assets/v2/workspaces/implica/projects/${projectId}/issues/${id}/proxy/${a.id}/`, headers: authHeaders }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                </Pressable>
              ))}
            </ScrollView>
            {/* Filename */}
            {imageAttachments[previewIndex] && (
              <Text style={styles.previewName}>{imageAttachments[previewIndex].attributes?.name || ""}</Text>
            )}
          </View>
        </Modal>
      )}
    </>
  );
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.propRow}>
      <Text style={styles.propLabel}>{label}</Text>
      <Text style={styles.propValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F5F7" },
  errorText: { fontSize: 16, color: colors.textSecondary },
  scroll: { flex: 1, backgroundColor: "#F5F5F7" },
  content: { padding: 20, paddingBottom: 20 },

  headerBadges: { flexDirection: "row", gap: 8, marginBottom: 12 },
  stateBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stateText: { fontSize: 13, fontWeight: "600" },
  prioBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  pickerCard: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", marginBottom: 8 },
  pickerItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  pickerText: { fontSize: 15, color: "#374151" },
  labelColorBar: { width: 4, height: 28, borderRadius: 2 },
  newLabelForm: { padding: 14, gap: 12 },
  newLabelInput: { backgroundColor: "#F2F2F7", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#1A1A1A" },
  colorPalette: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotSelected: { borderWidth: 3, borderColor: "#1A1A1A" },
  newLabelActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  newLabelCreateBtn: { backgroundColor: "#4A7BF7", borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  newLabelCreateText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  attachBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  attachBtnText: { fontSize: 14, fontWeight: "600", color: "#4A7BF7" },
  attachGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  attachItem: { width: 80, alignItems: "center", gap: 4 },
  attachThumbWrap: { width: 72, height: 72, borderRadius: 12, overflow: "hidden" },
  attachThumbAbsolute: { position: "absolute", top: 0, left: 0, width: 72, height: 72, borderRadius: 12 },
  attachThumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: "#F2F2F7" },
  attachImageBox: { width: 72, height: 72, borderRadius: 12, backgroundColor: "#EBF4FF", justifyContent: "center", alignItems: "center" },
  attachFileBox: { width: 72, height: 72, borderRadius: 12, backgroundColor: "#F2F2F7", justifyContent: "center", alignItems: "center" },
  previewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)" },
  previewClose: { position: "absolute", top: 56, right: 20, zIndex: 10, padding: 8 },
  previewCounter: { position: "absolute", top: 60, alignSelf: "center", zIndex: 10, color: "#fff", fontSize: 14, fontWeight: "600" },
  previewImage: { width: Dimensions.get("window").width, height: Dimensions.get("window").height * 0.7 },
  previewName: { textAlign: "center", color: "#8E8E93", fontSize: 12, paddingBottom: 40, paddingHorizontal: 20 },
  coverStar: { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 10, padding: 3 },
  attachName: { fontSize: 10, color: "#8E8E93", textAlign: "center" },
  commentInternal: {},
  internalBadge: { backgroundColor: "#FEF3C7", borderRadius: 4, padding: 2, marginRight: 4 },
  commentAccessRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  accessPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: "#F2F2F7",
  },
  accessPillActive: { backgroundColor: "#4A7BF7" },
  accessPillActiveInternal: { backgroundColor: "#F59E0B" },
  accessPillText: { fontSize: 12, fontWeight: "600", color: "#8E8E93" },
  accessPillTextActive: { color: "#fff" },
  inlineCommentBox: {
    backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12,
  },
  inlineCommentInput: {
    minHeight: 60, maxHeight: 120, fontSize: 15, color: "#1A1A1A",
    textAlignVertical: "top",
  },
  inlineCommentActions: {
    flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 8,
  },
  prioText: { fontSize: 13, fontWeight: "500" },
  assigneeChip: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: "#4A7BF715",
    justifyContent: "center", alignItems: "center",
  },
  assigneeAvatar: { width: 28, height: 28, borderRadius: 14 },
  assigneeText: { fontSize: 12, fontWeight: "700", color: "#4A7BF7" },

  title: { fontSize: 22, fontWeight: "700", color: "#1A1A1A", lineHeight: 30, marginBottom: 12 },

  labelsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  labelChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  labelDot: { width: 6, height: 6, borderRadius: 3 },
  labelName: { fontSize: 12, fontWeight: "600" },

  propsCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 12, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  propRow: { flexDirection: "row", justifyContent: "space-between" },
  propLabel: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  propValue: { fontSize: 14, color: "#1A1A1A" },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  descText: { backgroundColor: "#fff", borderRadius: 12, padding: 16 },
  descBodyText: { fontSize: 15, color: "#1A1A1A", lineHeight: 22 },
  noContent: { fontSize: 14, color: "#9CA3AF", fontStyle: "italic" },

  comment: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary + "15", justifyContent: "center", alignItems: "center" },
  commentAvatarText: { fontSize: 12, fontWeight: "600", color: colors.primary },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  commentAuthor: { fontSize: 13, fontWeight: "600", color: "#1A1A1A" },
  commentTime: { fontSize: 11, color: "#9CA3AF" },
  commentText: { fontSize: 14, color: "#374151", lineHeight: 20 },

  sendButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary, justifyContent: "center", alignItems: "center",
  },
});
