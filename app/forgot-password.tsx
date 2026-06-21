// app/forgot-password.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
    Animated,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";

type Step = "email" | "otp" | "newPassword" | "success";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [step, setStep]             = useState<Step>("email");
  const [email, setEmail]           = useState("");
  const [otp, setOtp]               = useState(["", "", "", "", "", "", "", ""]); // 8 boxes for resetPasswordForEmail token
  const [newPassword, setNewPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showNew, setShowNew]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [passErrors, setPassErrors] = useState({ new: "", confirm: "" });

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // ── STEP 1: Send reset code to email ──────────────────────────────────────
  const handleSendOtp = async () => {
    setError("");
    if (!email.trim()) { setError("Please enter your email address."); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { setError("Please enter a valid email address."); return; }

    setLoading(true);
    try {
      // resetPasswordForEmail sends the {{ .Token }} code from your Supabase email template
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim()
      );

      if (resetError) { setError(resetError.message); return; }

      setStep("otp");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 2: Verify the code ────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    setError("");
    const code = otp.join("");
    if (code.length < 8) { setError("Please enter the full 8-character code."); return; }

    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: "recovery", // must be "recovery" for resetPasswordForEmail tokens
      });

      if (verifyError) { setError("Invalid or expired code. Please try again."); return; }

      setStep("newPassword");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 3: Set new password ───────────────────────────────────────────────
  const handleResetPassword = async () => {
    setPassErrors({ new: "", confirm: "" });
    const errs = { new: "", confirm: "" };
    let hasError = false;

    if (!newPassword) { errs.new = "Password is required."; hasError = true; }
    else if (newPassword.length < 6) { errs.new = "Password must be at least 6 characters."; hasError = true; }
    if (!confirmPass) { errs.confirm = "Please confirm your password."; hasError = true; }
    else if (newPassword !== confirmPass) { errs.confirm = "Passwords do not match."; hasError = true; }

    setPassErrors(errs);
    if (hasError) return;

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) { setPassErrors({ new: updateError.message, confirm: "" }); return; }

      setStep("success");
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }).start();

      setTimeout(() => router.replace("/login" as any), 3000);
    } catch (e: any) {
      setPassErrors({ new: e.message ?? "Something went wrong.", confirm: "" });
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input handlers ─────────────────────────────────────────────────────
  // allows letters + numbers since resetPasswordForEmail token is alphanumeric
  const handleOtpChange = (text: string, index: number) => {
    const cleaned = text.replace(/[^a-zA-Z0-9]/g, "").slice(-1).toUpperCase();
    const newOtp = [...otp];
    newOtp[index] = cleaned;
    setOtp(newOtp);
    setError("");
    if (cleaned && index < 7) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ── STEP 1: Email Screen ───────────────────────────────────────────────────
  if (step === "email") {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.topSection}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.topIconCircle}>
              <Ionicons name="lock-open-outline" size={40} color="#ff4d4d" />
            </View>
            <Text style={styles.topTitle}>Forgot Password?</Text>
            <Text style={styles.topSub}>Enter your email and we'll send{"\n"}you a verification code.</Text>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Reset Password</Text>
            <Text style={styles.cardSub}>Enter the email address linked to your account.</Text>

            <Text style={styles.label}>Email Address</Text>
            <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
              <Ionicons name="mail-outline" size={18} color="#aaa" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#ccc"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(v) => { setEmail(v); setError(""); }}
              />
              {email.length > 0 && (
                <TouchableOpacity onPress={() => { setEmail(""); setError(""); }}>
                  <Ionicons name="close-circle" size={18} color="#aaa" />
                </TouchableOpacity>
              )}
            </View>

            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color="#3b82f6" />
              <Text style={styles.infoText}>
                We'll send an 8-character code to your email. It expires in 1 hour.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.7 }]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <View style={styles.btnRow}>
                  <Ionicons name={loading ? "sync-outline" : "send-outline"} size={18} color="#fff" />
                  <Text style={styles.btnText}>{loading ? "Sending…" : "Send Code"}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── STEP 2: Code Verification Screen ──────────────────────────────────────
  if (step === "otp") {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.topSection}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep("email")}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.topIconCircle}>
              <Ionicons name="keypad-outline" size={40} color="#ff4d4d" />
            </View>
            <Text style={styles.topTitle}>Check Your Email</Text>
            <Text style={styles.topSub}>Enter the 8-character code we{"\n"}sent to your email.</Text>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Enter Verification Code</Text>

            <View style={styles.emailPill}>
              <Ionicons name="mail-outline" size={16} color="#ff4d4d" />
              <Text style={styles.emailPillText}>{email}</Text>
            </View>

            <Text style={styles.otpLabel}>8-Character Code</Text>

            {/* 8 OTP BOXES */}
            <View style={styles.otpRow}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  style={[
                    styles.otpBox,
                    digit ? styles.otpBoxFilled : null,
                    error ? styles.otpBoxError : null,
                  ]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
                  keyboardType="default"
                  autoCapitalize="characters"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.infoBox}>
              <Ionicons name="time-outline" size={18} color="#3b82f6" />
              <Text style={styles.infoText}>
                The code expires in 1 hour. Check your spam folder if you don't see it.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.7 }]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <View style={styles.btnRow}>
                  <Ionicons name={loading ? "sync-outline" : "checkmark-circle-outline"} size={18} color="#fff" />
                  <Text style={styles.btnText}>{loading ? "Verifying…" : "Verify Code"}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendBtn}
              onPress={() => { setOtp(["","","","","","","",""]); setError(""); handleSendOtp(); }}
            >
              <Ionicons name="refresh-outline" size={16} color="#ff4d4d" />
              <Text style={styles.resendBtnText}>Resend Code</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── STEP 3: New Password Screen ────────────────────────────────────────────
  if (step === "newPassword") {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.topSection}>
            <View style={styles.topIconCircle}>
              <Ionicons name="lock-closed-outline" size={40} color="#ff4d4d" />
            </View>
            <Text style={styles.topTitle}>New Password</Text>
            <Text style={styles.topSub}>Choose a strong new password{"\n"}for your account.</Text>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Set New Password</Text>
            <Text style={styles.cardSub}>Must be at least 6 characters long.</Text>

            <Text style={styles.label}>New Password</Text>
            <View style={[styles.inputWrapper, passErrors.new ? styles.inputError : null]}>
              <Ionicons name="lock-closed-outline" size={18} color="#aaa" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Min. 6 characters"
                placeholderTextColor="#ccc"
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={(v) => { setNewPassword(v); setPassErrors(p => ({ ...p, new: "" })); }}
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={18} color="#aaa" />
              </TouchableOpacity>
            </View>
            {passErrors.new ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
                <Text style={styles.errorText}>{passErrors.new}</Text>
              </View>
            ) : null}

            {newPassword.length > 0 && (
              <View style={styles.strengthRow}>
                {[1, 2, 3, 4].map(i => (
                  <View key={i} style={[styles.strengthBar, {
                    backgroundColor: newPassword.length >= i * 3
                      ? newPassword.length < 6 ? "#f59e0b"
                      : newPassword.length < 10 ? "#10b981" : "#059669"
                      : "#f0f0f0",
                  }]} />
                ))}
                <Text style={styles.strengthLabel}>
                  {newPassword.length < 6 ? "Weak" : newPassword.length < 10 ? "Good" : "Strong"}
                </Text>
              </View>
            )}

            <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
            <View style={[styles.inputWrapper, passErrors.confirm ? styles.inputError : null]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#aaa" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Re-enter new password"
                placeholderTextColor="#ccc"
                secureTextEntry={!showConfirm}
                value={confirmPass}
                onChangeText={(v) => { setConfirmPass(v); setPassErrors(p => ({ ...p, confirm: "" })); }}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={18} color="#aaa" />
              </TouchableOpacity>
            </View>
            {passErrors.confirm ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
                <Text style={styles.errorText}>{passErrors.confirm}</Text>
              </View>
            ) : null}

            {confirmPass.length > 0 && (
              <View style={styles.matchRow}>
                <Ionicons
                  name={newPassword === confirmPass ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={newPassword === confirmPass ? "#10b981" : "#ef4444"}
                />
                <Text style={[styles.matchText, { color: newPassword === confirmPass ? "#10b981" : "#ef4444" }]}>
                  {newPassword === confirmPass ? "Passwords match" : "Passwords do not match"}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, { marginTop: 24 }, loading && { opacity: 0.7 }]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <View style={styles.btnRow}>
                  <Ionicons name={loading ? "sync-outline" : "checkmark-circle-outline"} size={18} color="#fff" />
                  <Text style={styles.btnText}>{loading ? "Saving…" : "Reset Password"}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── STEP 4: Success Screen ─────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.topSection}>
        <View style={styles.topIconCircle}>
          <Ionicons name="checkmark-circle-outline" size={40} color="#10b981" />
        </View>
        <Text style={styles.topTitle}>Password Reset!</Text>
        <Text style={styles.topSub}>Your password has been updated.</Text>
      </LinearGradient>

      <View style={styles.card}>
        <Animated.View style={[styles.successIconCircle, { transform: [{ scale: scaleAnim }] }]}>
          <Ionicons name="checkmark-circle" size={56} color="#10b981" />
        </Animated.View>
        <Text style={styles.successTitle}>All Done! 🎉</Text>
        <Text style={styles.successSub}>
          Your password has been reset successfully.{"\n"}Redirecting you to login…
        </Text>

        <TouchableOpacity
          style={[styles.btn, { marginTop: 32 }]}
          onPress={() => router.replace("/login" as any)}
        >
          <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <View style={styles.btnRow}>
              <Ionicons name="log-in-outline" size={18} color="#fff" />
              <Text style={styles.btnText}>Go to Login</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  topSection: {
    paddingTop: 60, paddingBottom: 50,
    alignItems: "center", paddingHorizontal: 20,
  },
  backBtn: {
    position: "absolute", top: 55, left: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12, padding: 8,
  },
  topIconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
    marginBottom: 16, marginTop: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  topTitle: { fontSize: 26, fontWeight: "800", color: "#fff", marginBottom: 8 },
  topSub:   { fontSize: 13, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 20 },

  card: {
    flex: 1, backgroundColor: "#fff",
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    marginTop: -24, padding: 28, paddingTop: 32,
  },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#1a1a1a", marginBottom: 4 },
  cardSub:   { fontSize: 13, color: "#999", marginBottom: 24, lineHeight: 19 },
  label:     { fontSize: 13, fontWeight: "600", color: "#444", marginBottom: 8 },

  inputWrapper: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f8f8f8", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 8, borderWidth: 1.5, borderColor: "#f0f0f0",
  },
  inputError: { borderColor: "#ef4444" },
  inputIcon:  { marginRight: 10 },
  input:      { flex: 1, fontSize: 14, color: "#1a1a1a" },

  errorRow:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  errorText: { color: "#ef4444", fontSize: 12, fontWeight: "500" },

  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#eff6ff", borderRadius: 14,
    padding: 14, marginBottom: 24, borderWidth: 1, borderColor: "#bfdbfe",
  },
  infoText: { flex: 1, fontSize: 13, color: "#3b82f6", lineHeight: 18 },

  btn:         { borderRadius: 14, overflow: "hidden", marginBottom: 16 },
  btnGradient: { paddingVertical: 15, alignItems: "center" },
  btnRow:      { flexDirection: "row", alignItems: "center", gap: 8 },
  btnText:     { color: "#fff", fontWeight: "800", fontSize: 16 },

  backLink: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
  },
  backLinkText: { color: "#ff4d4d", fontWeight: "600", fontSize: 14 },

  emailPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff5f5", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    alignSelf: "center", marginBottom: 24,
    borderWidth: 1, borderColor: "#fecaca",
  },
  emailPillText: { color: "#ff4d4d", fontWeight: "700", fontSize: 14 },

  otpLabel: { fontSize: 13, fontWeight: "600", color: "#444", marginBottom: 12 },
  otpRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  otpBox: {
    width: 36, height: 48, borderRadius: 10,
    backgroundColor: "#f8f8f8", borderWidth: 1.5, borderColor: "#f0f0f0",
    textAlign: "center", fontSize: 16, fontWeight: "800", color: "#1a1a1a",
  },
  otpBoxFilled: { borderColor: "#ff4d4d", backgroundColor: "#fff5f5" },
  otpBoxError:  { borderColor: "#ef4444" },

  resendBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12,
    backgroundColor: "#fff5f5", borderRadius: 14,
    borderWidth: 1, borderColor: "#fecaca",
  },
  resendBtnText: { color: "#ff4d4d", fontWeight: "700", fontSize: 14 },

  strengthRow:   { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  strengthBar:   { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, color: "#aaa", marginLeft: 6, width: 40 },

  matchRow:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  matchText: { fontSize: 12, fontWeight: "500" },

  successIconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "#f0fdf4",
    justifyContent: "center", alignItems: "center",
    alignSelf: "center", marginBottom: 16,
  },
  successTitle: { fontSize: 26, fontWeight: "800", color: "#1a1a1a", textAlign: "center", marginBottom: 8 },
  successSub:   { fontSize: 14, color: "#aaa", textAlign: "center", lineHeight: 20 },
});