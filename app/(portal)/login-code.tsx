import { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { usePortalAuth } from "../../lib/portal-auth-context";
import { colors } from "../../lib/theme";
import { t } from "../../lib/i18n";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

export default function PortalLoginCodeScreen() {
  const { pendingEmail: email, confirmCode, sendCode } = usePortalAuth();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleSubmit = useCallback(async (code: string) => {
    if (!email || code.length !== CODE_LENGTH) return;
    setLoading(true);
    const result = await confirmCode(email, code);
    setLoading(false);
    if (result.ok) {
      router.replace("/(portal)/issues");
    } else {
      Alert.alert(t("common.error"), result.error || t("portal.codeInvalid"));
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    }
  }, [email, confirmCode]);

  const handleChange = (text: string, index: number) => {
    // Handle paste of full code
    if (text.length === CODE_LENGTH && index === 0) {
      const pasted = text.split("").slice(0, CODE_LENGTH).filter((c) => /^\d$/.test(c));
      if (pasted.length !== CODE_LENGTH) return;
      setDigits(pasted);
      inputRefs.current[CODE_LENGTH - 1]?.focus();
      const code = pasted.join("");
      if (code.length === CODE_LENGTH) handleSubmit(code);
      return;
    }

    const char = text.slice(-1);
    if (char && !/^\d$/.test(char)) return;
    const next = [...digits];
    next[index] = char;
    setDigits(next);

    if (char && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when last digit entered
    const code = next.join("");
    if (code.length === CODE_LENGTH) {
      handleSubmit(code);
    }
  };

  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || !email) return;
    const result = await sendCode(email);
    if (result.ok) {
      setResendTimer(RESEND_COOLDOWN);
    } else {
      Alert.alert(t("common.error"), result.error || t("portal.codeSendFailed"));
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={s.content}>
        <Text style={s.title}>{t("portal.enterCode")}</Text>
        <Text style={s.subtitle}>
          {t("portal.codeSentTo")} {email}
        </Text>

        <View style={s.codeRow}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputRefs.current[i] = ref; }}
              style={[s.codeInput, digit ? s.codeInputFilled : null]}
              value={digit}
              onChangeText={(text) => handleChange(text, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={i === 0 ? CODE_LENGTH : 1}
              textContentType="oneTimeCode"
              autoFocus={i === 0}
              selectTextOnFocus
            />
          ))}
        </View>

        {loading && (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
        )}

        <TouchableOpacity
          onPress={handleResend}
          disabled={resendTimer > 0}
          style={s.resendButton}
        >
          <Text style={[s.resendText, resendTimer > 0 && { color: colors.textTertiary }]}>
            {resendTimer > 0
              ? `${t("portal.resendIn")} ${resendTimer}${t("portal.seconds")}`
              : t("portal.resendCode")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={s.backLink}>
          <Text style={s.backText}>{t("portal.changeEmail")}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  title: { fontSize: 24, fontWeight: "800", color: "#1A1A1A", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#8E8E93", textAlign: "center", marginBottom: 32 },
  codeRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
  codeInput: {
    width: 48, height: 56, borderRadius: 12,
    borderWidth: 1.5, borderColor: "#E5E5EA",
    backgroundColor: "#fff", textAlign: "center",
    fontSize: 24, fontWeight: "700", color: "#1A1A1A",
  },
  codeInputFilled: { borderColor: colors.primary },
  resendButton: { alignItems: "center", marginTop: 32 },
  resendText: { fontSize: 15, color: colors.primary },
  backLink: { alignItems: "center", marginTop: 16 },
  backText: { fontSize: 15, color: colors.textSecondary },
});
