import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { router, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePortalAuth } from "../../lib/portal-auth-context";
import {
  fetchPortalRequestTypes, createPortalIssue,
  type PortalRequestType,
} from "../../lib/portal-api";
import { colors } from "../../lib/theme";
import { t } from "../../lib/i18n";

export default function PortalCreateScreen() {
  const { isLoading: authLoading, isAuthenticated } = usePortalAuth();
  const [requestTypes, setRequestTypes] = useState<PortalRequestType[]>([]);
  const [selectedType, setSelectedType] = useState<PortalRequestType | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const types = await fetchPortalRequestTypes();
        if (!cancelled) setRequestTypes(types);
      } catch {
        if (!cancelled) setError(t("portal.loadFailed"));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

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

  const handleSubmit = async () => {
    if (!selectedType || !title.trim()) {
      Alert.alert(t("common.error"), t("portal.fillRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const result = await createPortalIssue({
        title: title.trim(),
        description: description.trim(),
        project_id: selectedType.project_id,
        request_type_id: selectedType.id,
      });
      if (result.success) {
        Alert.alert(t("portal.issueCreated"), t("portal.issueCreatedHint"), [
          { text: t("common.ok"), onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(t("common.error"), t("portal.createFailed"));
      }
    } catch {
      Alert.alert(t("common.error"), t("portal.createFailed"));
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{error}</Text>
      </View>
    );
  }

  // Step 1: Select request type
  if (!selectedType) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
        <Text style={s.sectionTitle}>{t("portal.selectType")}</Text>
        <Text style={s.sectionHint}>{t("portal.selectTypeHint")}</Text>

        {requestTypes.map((rt) => (
          <TouchableOpacity
            key={rt.id}
            style={s.typeCard}
            activeOpacity={0.7}
            onPress={() => setSelectedType(rt)}
          >
            <View style={s.typeIcon}>
              <Ionicons name="document-text-outline" size={24} color={colors.primary} />
            </View>
            <View style={s.typeInfo}>
              <Text style={s.typeName}>{rt.name}</Text>
              {rt.description ? (
                <Text style={s.typeDesc} numberOfLines={2}>{rt.description}</Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}

        {requestTypes.length === 0 && (
          <View style={s.emptyBox}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.textTertiary} />
            <Text style={s.emptyText}>{t("portal.noRequestTypes")}</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // Step 2: Fill form
  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Selected type */}
        <TouchableOpacity style={s.selectedType} onPress={() => setSelectedType(null)}>
          <Ionicons name="arrow-back" size={18} color={colors.primary} />
          <Text style={s.selectedTypeText}>{selectedType.name}</Text>
        </TouchableOpacity>

        {/* Title */}
        <Text style={s.fieldLabel}>{t("portal.issueTitle")} *</Text>
        <View style={s.inputBox}>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t("portal.issueTitlePlaceholder")}
            placeholderTextColor="#C7C7CC"
            autoFocus
          />
        </View>

        {/* Description */}
        <Text style={s.fieldLabel}>{t("portal.issueDescription")}</Text>
        <View style={[s.inputBox, { minHeight: 120 }]}>
          <TextInput
            style={[s.input, { minHeight: 100, textAlignVertical: "top" }]}
            value={description}
            onChangeText={setDescription}
            placeholder={t("portal.issueDescPlaceholder")}
            placeholderTextColor="#C7C7CC"
            multiline
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitButton, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitText}>{t("portal.submit")}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 15, color: colors.textSecondary, textAlign: "center", paddingHorizontal: 32 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 4 },
  sectionHint: { fontSize: 14, color: colors.textSecondary, marginBottom: 20 },
  typeCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 12,
  },
  typeIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: colors.primaryLight, justifyContent: "center", alignItems: "center",
    marginRight: 14,
  },
  typeInfo: { flex: 1 },
  typeName: { fontSize: 16, fontWeight: "600", color: colors.text },
  typeDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  emptyBox: { alignItems: "center", paddingTop: 40 },
  emptyText: { fontSize: 15, color: colors.textSecondary, marginTop: 12 },
  selectedType: {
    flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 8,
  },
  selectedTypeText: { fontSize: 15, fontWeight: "600", color: colors.primary },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8, marginTop: 16 },
  inputBox: {
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  input: {
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: colors.text,
  },
  submitButton: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 18, alignItems: "center", marginTop: 32,
  },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
