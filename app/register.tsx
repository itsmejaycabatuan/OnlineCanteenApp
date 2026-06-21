// app/register.tsx
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

type Step = "form" | "otp" | "success";

// ── Field component (outside to prevent re-render freeze) ─────────────────────
const Field = ({ label, icon, value, onChangeText, placeholder, keyboardType, secureTextEntry, right, autoCapitalize, error }: any) => (
  <View style={{ marginBottom: 4 }}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
      <Ionicons name={icon} size={18} color="#aaa" style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#ccc"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || "default"}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize || "none"}
      />
      {right}
    </View>
    {error ? (
      <View style={styles.errorRow}>
        <Ionicons name="alert-circle-outline" size={13} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    ) : <View style={{ marginBottom: 12 }} />}
  </View>
);

export default function RegisterScreen() {
  const router = useRouter();

  const [step, setStep]                   = useState<Step>("form");
  const [fullName, setFullName]           = useState("");
  const [schoolId, setSchoolId]           = useState("");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [loading, setLoading]             = useState(false);
 const [otp, setOtp] = useState([
  "", "", "", "", "", "", "", ""
]);
  const [otpError, setOtpError]           = useState("");
  const [errors, setErrors]               = useState<Record<string, string>>({});

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // ── Validate form ──────────────────────────────────────────────────────────
  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim())       errs.fullName = "Full name is required.";
    if (!schoolId.trim())       errs.schoolId = "School ID is required.";
    if (!email.trim())          errs.email    = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                                errs.email    = "Enter a valid email address.";
    if (!password)              errs.password = "Password is required.";
    else if (password.length < 6) errs.password = "Password must be at least 6 characters.";
    if (!confirmPassword)       errs.confirmPassword = "Please confirm your password.";
    else if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── STEP 1: Register + send OTP ───────────────────────────────────────────
  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName, school_id: schoolId },
          // Supabase will send a 6-digit OTP to the email automatically
        },
      });

      if (error) {
        setErrors({ email: error.message });
        return;
      }

      setStep("otp");
    } catch (e: any) {
      setErrors({ email: e.message ?? "Something went wrong." });
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 2: Verify OTP ─────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    setOtpError("");
    const code = otp.join("");
   if (code.length < 8) { setOtpError("Please enter the full 8-digit code."); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: "signup", // "signup" type for registration verification
      });

      if (error) { setOtpError("Invalid or expired code. Please try again."); return; }

      setStep("success");
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }).start();

      setTimeout(() => router.replace("/login" as any), 3000);
    } catch (e: any) {
      setOtpError(e.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setOtpError("");
    setOtp(["", "", "", "", "", ""]);
    setLoading(true);
    try {
      await supabase.auth.resend({ type: "signup", email: email.trim() });
    } catch (e) {
      setOtpError("Failed to resend. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input handlers ─────────────────────────────────────────────────────
  const handleOtpChange = (text: string, index: number) => {
    const cleaned = text.replace(/[^0-9]/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = cleaned;
    setOtp(newOtp);
    setOtpError("");
   if (cleaned && index < 7) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ── STEP 1: Registration Form ──────────────────────────────────────────────
  if (step === "form") {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

          <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.topSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="person-add" size={36} color="#ff4d4d" />
            </View>
            <Text style={styles.topTitle}>Create Account</Text>
            <Text style={styles.topSub}>Join the Online Canteen</Text>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Register</Text>
            <Text style={styles.cardSub}>Fill in the details below to create your account.</Text>

            <Field
              label="Full Name"
              icon="person-outline"
              placeholder="John Doe"
              value={fullName}
              onChangeText={(v: string) => { setFullName(v); setErrors(p => ({ ...p, fullName: "" })); }}
              autoCapitalize="words"
              error={errors.fullName}
            />

            <Field
              label="School ID"
              icon="card-outline"
              placeholder="2024-XXXXX"
              value={schoolId}
              onChangeText={(v: string) => { setSchoolId(v); setErrors(p => ({ ...p, schoolId: "" })); }}
              error={errors.schoolId}
            />

            <Field
              label="Email Address"
              icon="mail-outline"
              placeholder="youremail@school.edu"
              value={email}
              onChangeText={(v: string) => { setEmail(v); setErrors(p => ({ ...p, email: "" })); }}
              keyboardType="email-address"
              error={errors.email}
            />

            <Field
              label="Password"
              icon="lock-closed-outline"
              placeholder="Min. 6 characters"
              value={password}
              onChangeText={(v: string) => { setPassword(v); setErrors(p => ({ ...p, password: "" })); }}
              secureTextEntry={!showPassword}
              error={errors.password}
              right={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#aaa" />
                </TouchableOpacity>
              }
            />

            {/* Password strength */}
            {password.length > 0 && (
              <View style={[styles.strengthRow, { marginTop: -8, marginBottom: 12 }]}>
                {[1, 2, 3, 4].map(i => (
                  <View key={i} style={[styles.strengthBar, {
                    backgroundColor: password.length >= i * 3
                      ? password.length < 6 ? "#f59e0b" : password.length < 10 ? "#10b981" : "#059669"
                      : "#f0f0f0",
                  }]} />
                ))}
                <Text style={styles.strengthLabel}>
                  {password.length < 6 ? "Weak" : password.length < 10 ? "Good" : "Strong"}
                </Text>
              </View>
            )}

            <Field
              label="Confirm Password"
              icon="shield-checkmark-outline"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChangeText={(v: string) => { setConfirmPassword(v); setErrors(p => ({ ...p, confirmPassword: "" })); }}
              secureTextEntry={!showConfirm}
              error={errors.confirmPassword}
              right={
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                  <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={18} color="#aaa" />
                </TouchableOpacity>
              }
            />

            {/* Password match indicator */}
            {confirmPassword.length > 0 && (
              <View style={[styles.matchRow, { marginTop: -8, marginBottom: 12 }]}>
                <Ionicons
                  name={password === confirmPassword ? "checkmark-circle" : "close-circle"}
                  size={15}
                  color={password === confirmPassword ? "#10b981" : "#ef4444"}
                />
                <Text style={[styles.matchText, { color: password === confirmPassword ? "#10b981" : "#ef4444" }]}>
                  {password === confirmPassword ? "Passwords match" : "Passwords do not match"}
                </Text>
              </View>
            )}

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color="#3b82f6" />
              <Text style={styles.infoText}>
                A 8-digit verification code will be sent to your email after registering.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
            >
              <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <View style={styles.btnRow}>
                  <Ionicons name={loading ? "sync-outline" : "person-add-outline"} size={18} color="#fff" />
                  <Text style={styles.btnText}>{loading ? "Creating Account…" : "Register"}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/login" as any)}>
                <Text style={styles.footerLink}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── STEP 2: OTP Verification ───────────────────────────────────────────────
  if (step === "otp") {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

          <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.topSection}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep("form")}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.iconCircle}>
              <Ionicons name="mail-unread-outline" size={36} color="#ff4d4d" />
            </View>
            <Text style={styles.topTitle}>Verify Email</Text>
            <Text style={styles.topSub}>Enter the code we sent to your email.</Text>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Email Verification</Text>
            <Text style={styles.cardSub}>Check your inbox and enter the 6-digit code below.</Text>

            {/* Email pill */}
            <View style={styles.emailPill}>
              <Ionicons name="mail-outline" size={16} color="#ff4d4d" />
              <Text style={styles.emailPillText}>{email}</Text>
            </View>

            <Text style={styles.label}>8-Digit Code</Text>

            {/* OTP Boxes */}
            <View style={styles.otpRow}>
             {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  style={[
                    styles.otpBox,
                    digit ? styles.otpBoxFilled : null,
                    otpError ? styles.otpBoxError : null,
                  ]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            {otpError ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
                <Text style={styles.errorText}>{otpError}</Text>
              </View>
            ) : null}

            <View style={styles.infoBox}>
              <Ionicons name="time-outline" size={18} color="#3b82f6" />
              <Text style={styles.infoText}>
                The code expires in 10 minutes. Check your spam folder if you don't see it.
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
              onPress={handleResend}
              disabled={loading}
            >
              <Ionicons name="refresh-outline" size={16} color="#ff4d4d" />
              <Text style={styles.resendBtnText}>Resend Code</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── STEP 3: Success ────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.topSection}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark-circle-outline" size={36} color="#10b981" />
        </View>
        <Text style={styles.topTitle}>Account Created!</Text>
        <Text style={styles.topSub}>Welcome to Online Canteen 🎉</Text>
      </LinearGradient>

      <View style={styles.card}>
        <Animated.View style={[styles.successIconCircle, { transform: [{ scale: scaleAnim }] }]}>
          <Ionicons name="checkmark-circle" size={64} color="#10b981" />
        </Animated.View>

        <Text style={styles.successTitle}>You're all set! 🎉</Text>
        <Text style={styles.successSub}>
          Your account has been verified successfully.{"\n"}Redirecting you to login…
        </Text>

        {/* What's next card */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>What's next:</Text>
          {[
            { icon: "log-in-outline",       text: "Sign in with your new account"  },
            { icon: "restaurant-outline",   text: "Browse the canteen menu"        },
            { icon: "cart-outline",         text: "Place your first order"         },
          ].map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNumCircle}>
                <Text style={styles.stepNum}>{i + 1}</Text>
              </View>
              <Ionicons name={s.icon as any} size={18} color="#ff4d4d" style={{ marginRight: 10 }} />
              <Text style={styles.stepText}>{s.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.btn}
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
    paddingTop: 70, paddingBottom: 50,
    alignItems: "center", paddingHorizontal: 20,
  },
  backBtn: {
    position: "absolute", top: 55, left: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12, padding: 8,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
    marginBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  topTitle: { fontSize: 26, fontWeight: "800", color: "#fff" },
  topSub:   { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4, textAlign: "center" },

  card: {
    flex: 1, backgroundColor: "#fff",
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    marginTop: -24, padding: 28, paddingTop: 32,
  },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#1a1a1a", marginBottom: 4 },
  cardSub:   { fontSize: 13, color: "#999", marginBottom: 20, lineHeight: 19 },
  label:     { fontSize: 13, fontWeight: "600", color: "#444", marginBottom: 8 },

  inputWrapper: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f8f8f8", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: "#f0f0f0",
  },
  inputError: { borderColor: "#ef4444" },
  inputIcon:  { marginRight: 10 },
  input:      { flex: 1, fontSize: 14, color: "#1a1a1a" },

  errorRow:  { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4, marginBottom: 8 },
  errorText: { color: "#ef4444", fontSize: 12, fontWeight: "500" },

  strengthRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  strengthBar:  { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel:{ fontSize: 11, color: "#aaa", marginLeft: 6, width: 40 },

  matchRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  matchText: { fontSize: 12, fontWeight: "500" },

  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#eff6ff", borderRadius: 14,
    padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#bfdbfe",
  },
  infoText: { flex: 1, fontSize: 13, color: "#3b82f6", lineHeight: 18 },

  btn:         { borderRadius: 14, overflow: "hidden", marginBottom: 16 },
  btnGradient: { paddingVertical: 15, alignItems: "center" },
  btnRow:      { flexDirection: "row", alignItems: "center", gap: 8 },
  btnText:     { color: "#fff", fontWeight: "800", fontSize: 16 },

  footer: { flexDirection: "row", justifyContent: "center", paddingBottom: 20 },
  footerText: { color: "#999", fontSize: 14 },
  footerLink: { color: "#ff4d4d", fontWeight: "700", fontSize: 14 },

  // EMAIL PILL
  emailPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff5f5", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    alignSelf: "center", marginBottom: 20,
    borderWidth: 1, borderColor: "#fecaca",
  },
  emailPillText: { color: "#ff4d4d", fontWeight: "700", fontSize: 14 },

  // OTP
  otpRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginBottom: 16,
  paddingHorizontal: 5,
},
 otpBox: {
  width: 36,
  height: 48,
  borderRadius: 10,
  backgroundColor: "#f8f8f8",
  borderWidth: 1.5,
  borderColor: "#f0f0f0",
  textAlign: "center",
  fontSize: 18,
  fontWeight: "800",
  color: "#1a1a1a",
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

  // SUCCESS
  successIconCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: "#f0fdf4",
    justifyContent: "center", alignItems: "center",
    alignSelf: "center", marginBottom: 16,
  },
  successTitle: { fontSize: 26, fontWeight: "800", color: "#1a1a1a", textAlign: "center", marginBottom: 8 },
  successSub:   { fontSize: 14, color: "#aaa", textAlign: "center", lineHeight: 20, marginBottom: 24 },

  stepsCard: {
    backgroundColor: "#f8f8f8", borderRadius: 16,
    padding: 16, marginBottom: 24,
  },
  stepsTitle: { fontSize: 13, fontWeight: "700", color: "#444", marginBottom: 12 },
  stepRow:    { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  stepNumCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#ff4d4d",
    justifyContent: "center", alignItems: "center", marginRight: 10,
  },
  stepNum:  { fontSize: 11, fontWeight: "800", color: "#fff" },
  stepText: { fontSize: 13, color: "#555", flex: 1 },
});