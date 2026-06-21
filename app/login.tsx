// app/login.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image, KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { supabase } from "../lib/supabase";

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ FIELD ERRORS (NEW)
  const [errors, setErrors] = useState({
    email: "",
    password: "",
  });

  const handleLogin = async () => {
  setErrors({ email: "", password: "" });

  let hasError = false;
  const newErrors = { email: "", password: "" };

  if (!email.trim()) {
    newErrors.email = "Email is required";
    hasError = true;
  }
  if (!password) {
    newErrors.password = "Password is required";
    hasError = true;
  }

  setErrors(newErrors);
  if (hasError) return;

  try {
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrors({ email: "", password: error.message });
      return;
    }

    if (data?.session) {
      // ── role check ──────────────────────────────
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", data.session.user.id)
        .single();

     if (profile?.role === "admin") {
  router.push("/admin");  // ← push instead of replace
} else {
  router.push("/(tabs)/home");
}
      // ────────────────────────────────────────────
    }
  } catch (err: any) {
    setErrors({ email: "", password: err.message || "Something went wrong" });
  } finally {
    setLoading(false);
  }
};

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* TOP GRADIENT */}
        <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.topSection}>
          <View style={styles.iconCircle}>
            <Image
              source={require("../assets/images/logo2.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.topTitle}>Online Canteen</Text>
          <Text style={styles.topSub}>Sign in to place your order</Text>
        </LinearGradient>

        {/* FORM CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back 👋</Text>
          <Text style={styles.cardSub}>Login to your student account</Text>

          {/* EMAIL */}
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={18} color="#aaa" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor="#ccc"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrors((prev) => ({ ...prev, email: "" }));
              }}
            />
          </View>

          {/* EMAIL ERROR */}
          {errors.email ? (
            <Text style={styles.errorText}>{errors.email}</Text>
          ) : null}

          {/* PASSWORD */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color="#aaa" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#ccc"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrors((prev) => ({ ...prev, password: "" }));
              }}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color="#aaa"
              />
            </TouchableOpacity>
          </View>

          {/* PASSWORD ERROR */}
          {errors.password ? (
            <Text style={styles.errorText}>{errors.password}</Text>
          ) : null}

          {/* FORGOT PASSWORD LINK */}
<TouchableOpacity
  style={styles.forgotBtn}
  onPress={() => router.push("/forgot-password" as any)}
>
  <Text style={styles.forgotText}>Forgot Password?</Text>
</TouchableOpacity>

          {/* LOGIN BUTTON */}
          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <LinearGradient
              colors={["#ff4d4d", "#ff7043"]}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.btnText}>
                {loading ? "Signing in..." : "Sign In"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* REGISTER LINK */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text style={styles.footerLink}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* UI UNCHANGED */
const styles = StyleSheet.create({
  topSection: {
    paddingTop: 80,
    paddingBottom: 50,
    alignItems: "center",
  },
  logo: {
    width: 500,
    height: 180,
    marginBottom: 9,
  },
  iconCircle: {},
  topTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
  },
  topSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -24,
    padding: 28,
    paddingTop: 32,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: "#999",
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1a1a1a",
  },
  btn: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 24,
  },
  btnGradient: {
    paddingVertical: 15,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  footerText: {
    color: "#999",
    fontSize: 14,
  },
  footerLink: {
    color: "#ff4d4d",
    fontWeight: "700",
    fontSize: 14,
  },

  // error style
  errorText: {
    color: "red",
    fontSize: 13,
    marginBottom: 10,
    marginTop: -5,
  },
  forgotBtn: { alignSelf: "flex-end", marginTop: -10, marginBottom: 20 },
forgotText: { color: "#ff4d4d", fontSize: 13, fontWeight: "600" },
});