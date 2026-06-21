// app/(tabs)/profile.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface UserProfile {
  fullName: string;
  email: string;
  schoolId: string;
  createdAt: string;
}

interface UserStats {
  totalOrders: number;
  totalSpent: number;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading]             = useState(true);
  const [profile, setProfile]             = useState<UserProfile | null>(null);
  const [stats, setStats]                 = useState<UserStats>({ totalOrders: 0, totalSpent: 0 });
  const [notifications, setNotifications] = useState(true);

  // logout modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // change password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword]     = useState("");
  const [newPassword, setNewPassword]             = useState("");
  const [confirmPassword, setConfirmPassword]     = useState("");
  const [showCurrent, setShowCurrent]             = useState(false);
  const [showNew, setShowNew]                     = useState(false);
  const [showConfirm, setShowConfirm]             = useState(false);
  const [passwordLoading, setPasswordLoading]     = useState(false);
  const [passwordErrors, setPasswordErrors]       = useState<Record<string, string>>({});
  const [showSuccessModal, setShowSuccessModal]   = useState(false);

  // edit profile modal
  const [showEditModal, setShowEditModal]     = useState(false);
  const [editName, setEditName]               = useState("");
  const [editSchoolId, setEditSchoolId]       = useState("");
  const [editLoading, setEditLoading]         = useState(false);
  const [editErrors, setEditErrors]           = useState<Record<string, string>>({});
  const [showEditSuccess, setShowEditSuccess] = useState(false);

  // ── fetch profile ──────────────────────────────────────────────────────────
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("users")
        .select("full_name, school_id, email, created_at")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile({
          fullName:  profileData.full_name  ?? "Student",
          email:     profileData.email      ?? user.email ?? "N/A",
          schoolId:  profileData.school_id  ?? "N/A",
          createdAt: profileData.created_at ?? "",
        });
      }

      const { data: orders } = await supabase
        .from("orders")
        .select("total_amount, status")
        .eq("user_id", user.id)
        .neq("status", "cancelled");

      setStats({
        totalOrders: orders?.length ?? 0,
        totalSpent:  orders?.reduce((sum, o) => sum + Number(o.total_amount), 0) ?? 0,
      });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchProfile(); }, []));

  // ── logout ─────────────────────────────────────────────────────────────────
  const openLogoutModal = () => {
    setShowLogoutModal(true);
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const closeLogoutModal = () => {
    Animated.parallel([
      Animated.timing(scaleAnim,   { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => setShowLogoutModal(false));
  };

  const confirmLogout = async () => {
    closeLogoutModal();
    await supabase.auth.signOut();
    router.replace("/login" as any);
  };

  // ── change password ────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    const errors: Record<string, string> = {};

    if (!currentPassword)
      errors.currentPassword = "Current password is required";
    if (!newPassword)
      errors.newPassword = "New password is required";
    if (newPassword.length < 6)
      errors.newPassword = "Password must be at least 6 characters";
    if (!confirmPassword)
      errors.confirmPassword = "Please confirm your password";
    if (newPassword !== confirmPassword)
      errors.confirmPassword = "Passwords do not match";

    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPasswordLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email:    profile?.email ?? "",
        password: currentPassword,
      });

      if (signInError) {
        setPasswordErrors({ currentPassword: "Current password is incorrect" });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setPasswordErrors({ newPassword: error.message });
        return;
      }

      setShowPasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordErrors({});
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2500);

    } catch (e) {
      console.error(e);
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── edit profile ───────────────────────────────────────────────────────────
  const handleEditProfile = async () => {
    const errors: Record<string, string> = {};

    if (!editName.trim())
      errors.editName = "Full name is required";
    if (editName.trim().length < 2)
      errors.editName = "Name must be at least 2 characters";
    if (!editSchoolId.trim())
      errors.editSchoolId = "School ID is required";

    setEditErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setEditLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("users")
        .update({
          full_name: editName.trim(),
          school_id: editSchoolId.trim(),
        })
        .eq("id", user.id);

      if (error) {
        setEditErrors({ editName: error.message });
        return;
      }

      await supabase.auth.updateUser({
        data: {
          full_name: editName.trim(),
          school_id: editSchoolId.trim(),
        },
      });

      setProfile(prev => prev ? {
        ...prev,
        fullName: editName.trim(),
        schoolId: editSchoolId.trim(),
      } : null);

      setShowEditModal(false);
      setEditErrors({});
      setShowEditSuccess(true);
      setTimeout(() => setShowEditSuccess(false), 2500);

    } catch (e) {
      console.error(e);
    } finally {
      setEditLoading(false);
    }
  };

  // ── helpers ────────────────────────────────────────────────────────────────
  const getInitial = () =>
    profile?.fullName?.charAt(0).toUpperCase() ?? "S";

  const formatDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString("en-PH", {
      month: "long", day: "numeric", year: "numeric",
    }) : "N/A";

  // ── loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4d4d" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8f8f8" }}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

        {/* ── GRADIENT HEADER ────────────────────────────────────────────── */}
        <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.header}>

          {/* edit button */}
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => {
              setEditName(profile?.fullName ?? "");
              setEditSchoolId(profile?.schoolId ?? "");
              setEditErrors({});
              setShowEditModal(true);
            }}
          >
            <Ionicons name="pencil-outline" size={16} color="#fff" />
            <Text style={styles.editProfileBtnText}>Edit</Text>
          </TouchableOpacity>

          {/* avatar */}
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{getInitial()}</Text>
          </View>
          <Text style={styles.headerName}>{profile?.fullName}</Text>
          <View style={styles.schoolIdBadge}>
            <Ionicons name="card-outline" size={12} color="rgba(255,255,255,0.8)" />
            <Text style={styles.schoolIdText}>{profile?.schoolId}</Text>
          </View>
        </LinearGradient>

        {/* ── STATS ROW ──────────────────────────────────────────────────── */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              ₱{stats.totalSpent.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
        </View>

        {/* ── ACCOUNT INFO ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <InfoRow
            icon="person-outline"
            label="Full Name"
            value={profile?.fullName ?? "N/A"}
          />
          <InfoRow
            icon="mail-outline"
            label="Email Address"
            value={profile?.email ?? "N/A"}
          />
          <InfoRow
            icon="card-outline"
            label="School ID"
            value={profile?.schoolId ?? "N/A"}
          />
          <InfoRow
            icon="calendar-outline"
            label="Member Since"
            value={formatDate(profile?.createdAt ?? "")}
            last
          />
        </View>

        {/* ── QUICK LINKS ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Links</Text>
          <LinkRow
            icon="receipt-outline"
            label="My Orders"
            color="#ff4d4d"
            bg="#fff5f5"
            onPress={() => router.push("/(tabs)/orders" as any)}
          />
          <LinkRow
            icon="fast-food-outline"
            label="Browse Menu"
            color="#10b981"
            bg="#f0fdf4"
            onPress={() => router.push("/(tabs)/menu" as any)}
          />
          <LinkRow
            icon="lock-closed-outline"
            label="Change Password"
            color="#8b5cf6"
            bg="#f5f3ff"
            onPress={() => {
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
              setPasswordErrors({});
              setShowPasswordModal(true);
            }}
            last
          />
        </View>

        {/* ── PREFERENCES ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={[styles.prefIconBox, { backgroundColor: "#fff5f5" }]}>
                <Ionicons name="notifications-outline" size={18} color="#ff4d4d" />
              </View>
              <View>
                <Text style={styles.prefLabel}>Order Notifications</Text>
                <Text style={styles.prefSub}>Get notified when order is ready</Text>
              </View>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: "#f0f0f0", true: "#ff4d4d" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ── LOGOUT ─────────────────────────────────────────────────────── */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={openLogoutModal}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── LOGOUT MODAL ─────────────────────────────────────────────────── */}
      {showLogoutModal && (
        <Animated.View style={[styles.modalOverlay, { opacity: opacityAnim }]}>
          <Animated.View style={[styles.modalBox, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="log-out" size={36} color="#ef4444" />
            </View>
            <Text style={styles.modalTitle}>Log Out</Text>
            <Text style={styles.modalText}>
              Are you sure you want to log out of your account?
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeLogoutModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmLogout}>
                <Text style={styles.confirmBtnText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── EDIT PROFILE MODAL ───────────────────────────────────────────── */}
      {showEditModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>

            <View style={styles.dragHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetIconCircle}>
                <Ionicons name="person-outline" size={22} color="#ff4d4d" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Edit Profile</Text>
                <Text style={styles.sheetSub}>Update your personal information</Text>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => { setShowEditModal(false); setEditErrors({}); }}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* full name */}
            <Text style={styles.fieldLabel}>
              Full Name <Text style={styles.fieldRequired}>*</Text>
            </Text>
            <View style={[
              styles.fieldInputWrapper,
              editErrors.editName && styles.fieldInputError,
            ]}>
              <Ionicons name="person-outline" size={16} color="#aaa" />
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter your full name"
                placeholderTextColor="#ccc"
                value={editName}
                onChangeText={v => {
                  setEditName(v);
                  setEditErrors(p => ({ ...p, editName: "" }));
                }}
                autoCapitalize="words"
              />
            </View>
            {editErrors.editName ? (
              <Text style={styles.fieldError}>{editErrors.editName}</Text>
            ) : null}

            {/* school id */}
            <Text style={styles.fieldLabel}>
              School ID <Text style={styles.fieldRequired}>*</Text>
            </Text>
            <View style={[
              styles.fieldInputWrapper,
              editErrors.editSchoolId && styles.fieldInputError,
            ]}>
              <Ionicons name="card-outline" size={16} color="#aaa" />
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter your school ID"
                placeholderTextColor="#ccc"
                value={editSchoolId}
                onChangeText={v => {
                  setEditSchoolId(v);
                  setEditErrors(p => ({ ...p, editSchoolId: "" }));
                }}
                autoCapitalize="none"
              />
            </View>
            {editErrors.editSchoolId ? (
              <Text style={styles.fieldError}>{editErrors.editSchoolId}</Text>
            ) : null}

            {/* email note */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color="#3b82f6" />
              <Text style={styles.infoBoxText}>
                Email address cannot be changed. Contact your administrator if needed.
              </Text>
            </View>

            {/* buttons */}
            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={styles.sheetCancelBtn}
                onPress={() => { setShowEditModal(false); setEditErrors({}); }}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetSaveBtn, editLoading && { opacity: 0.7 }]}
                onPress={handleEditProfile}
                disabled={editLoading}
              >
                {editLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-outline" size={18} color="#fff" />
                    <Text style={styles.sheetSaveText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </View>
      )}

      {/* ── CHANGE PASSWORD MODAL ────────────────────────────────────────── */}
      {showPasswordModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>

            <View style={styles.dragHandle} />

            <View style={styles.sheetHeader}>
              <View style={[styles.sheetIconCircle, { backgroundColor: "#f5f3ff" }]}>
                <Ionicons name="lock-closed-outline" size={22} color="#8b5cf6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Change Password</Text>
                <Text style={styles.sheetSub}>Enter your current and new password</Text>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword(""); setNewPassword("");
                  setConfirmPassword(""); setPasswordErrors({});
                }}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* current password */}
            <Text style={styles.fieldLabel}>Current Password</Text>
            <View style={[
              styles.fieldInputWrapper,
              passwordErrors.currentPassword && styles.fieldInputError,
            ]}>
              <Ionicons name="lock-closed-outline" size={16} color="#aaa" />
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter current password"
                placeholderTextColor="#ccc"
                secureTextEntry={!showCurrent}
                value={currentPassword}
                onChangeText={v => {
                  setCurrentPassword(v);
                  setPasswordErrors(p => ({ ...p, currentPassword: "" }));
                }}
              />
              <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                <Ionicons
                  name={showCurrent ? "eye-off-outline" : "eye-outline"}
                  size={16} color="#aaa"
                />
              </TouchableOpacity>
            </View>
            {passwordErrors.currentPassword ? (
              <Text style={styles.fieldError}>{passwordErrors.currentPassword}</Text>
            ) : null}

            {/* new password */}
            <Text style={styles.fieldLabel}>New Password</Text>
            <View style={[
              styles.fieldInputWrapper,
              passwordErrors.newPassword && styles.fieldInputError,
            ]}>
              <Ionicons name="key-outline" size={16} color="#aaa" />
              <TextInput
                style={styles.fieldInput}
                placeholder="Min. 6 characters"
                placeholderTextColor="#ccc"
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={v => {
                  setNewPassword(v);
                  setPasswordErrors(p => ({ ...p, newPassword: "" }));
                }}
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                <Ionicons
                  name={showNew ? "eye-off-outline" : "eye-outline"}
                  size={16} color="#aaa"
                />
              </TouchableOpacity>
            </View>
            {passwordErrors.newPassword ? (
              <Text style={styles.fieldError}>{passwordErrors.newPassword}</Text>
            ) : null}

            {/* confirm password */}
            <Text style={styles.fieldLabel}>Confirm New Password</Text>
            <View style={[
              styles.fieldInputWrapper,
              passwordErrors.confirmPassword && styles.fieldInputError,
            ]}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#aaa" />
              <TextInput
                style={styles.fieldInput}
                placeholder="Re-enter new password"
                placeholderTextColor="#ccc"
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={v => {
                  setConfirmPassword(v);
                  setPasswordErrors(p => ({ ...p, confirmPassword: "" }));
                }}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={16} color="#aaa"
                />
              </TouchableOpacity>
            </View>
            {passwordErrors.confirmPassword ? (
              <Text style={styles.fieldError}>{passwordErrors.confirmPassword}</Text>
            ) : null}

            {/* password match indicator */}
            {confirmPassword.length > 0 && (
              <View style={styles.matchRow}>
                <Ionicons
                  name={newPassword === confirmPassword
                    ? "checkmark-circle" : "close-circle"}
                  size={14}
                  color={newPassword === confirmPassword ? "#10b981" : "#ef4444"}
                />
                <Text style={[
                  styles.matchText,
                  { color: newPassword === confirmPassword ? "#10b981" : "#ef4444" },
                ]}>
                  {newPassword === confirmPassword
                    ? "Passwords match" : "Passwords do not match"}
                </Text>
              </View>
            )}

            {/* buttons */}
            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={styles.sheetCancelBtn}
                onPress={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword(""); setNewPassword("");
                  setConfirmPassword(""); setPasswordErrors({});
                }}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetSaveBtn,
                  { backgroundColor: "#8b5cf6" },
                  passwordLoading && { opacity: 0.7 },
                ]}
                onPress={handleChangePassword}
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={styles.sheetSaveText}>Update Password</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </View>
      )}

      {/* ── PASSWORD SUCCESS MODAL ───────────────────────────────────────── */}
      {showSuccessModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.successBox}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={48} color="#10b981" />
            </View>
            <Text style={styles.successTitle}>Password Updated!</Text>
            <Text style={styles.successSub}>
              Your password has been changed successfully.
            </Text>
          </View>
        </View>
      )}

      {/* ── EDIT PROFILE SUCCESS MODAL ───────────────────────────────────── */}
      {showEditSuccess && (
        <View style={styles.modalOverlay}>
          <View style={styles.successBox}>
            <View style={[styles.successIconCircle, { backgroundColor: "#fff5f5" }]}>
              <Ionicons name="checkmark-circle" size={48} color="#ff4d4d" />
            </View>
            <Text style={styles.successTitle}>Profile Updated!</Text>
            <Text style={styles.successSub}>
              Your profile information has been saved successfully.
            </Text>
          </View>
        </View>
      )}

    </View>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function InfoRow({
  icon, label, value, last,
}: {
  icon: string; label: string; value: string; last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={styles.infoIconBox}>
        <Ionicons name={icon as any} size={18} color="#ff4d4d" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function LinkRow({
  icon, label, color, bg, onPress, last,
}: {
  icon: string; label: string; color: string;
  bg: string; onPress: () => void; last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.linkRow, !last && styles.infoRowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.linkIconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#ddd" />
    </TouchableOpacity>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:      { color: "#999", fontSize: 14 },

  // HEADER
  header: {
    paddingTop: 70, paddingBottom: 36,
    alignItems: "center", gap: 8,
  },
  editProfileBtn: {
    position: "absolute", top: 55, right: 20,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
  },
  editProfileBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
    marginBottom: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  avatarInitial: { fontSize: 36, fontWeight: "800", color: "#ff4d4d" },
  headerName:    { fontSize: 22, fontWeight: "800", color: "#fff" },
  schoolIdBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  schoolIdText: { fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: "600" },

  // STATS
  statsCard: {
    flexDirection: "row", backgroundColor: "#fff",
    marginHorizontal: 20, marginTop: -20,
    borderRadius: 20, padding: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 5,
    marginBottom: 20,
  },
  statItem:    { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: 1, backgroundColor: "#f0f0f0", marginHorizontal: 16 },
  statValue:   { fontSize: 22, fontWeight: "800", color: "#ff4d4d" },
  statLabel:   { fontSize: 12, color: "#aaa", fontWeight: "500" },

  // SECTION
  section: {
    backgroundColor: "#fff", borderRadius: 20,
    marginHorizontal: 20, marginBottom: 16, padding: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: "700", color: "#aaa",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16,
  },

  // INFO ROWS
  infoRow:       { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  infoIconBox: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "#fff5f5",
    justifyContent: "center", alignItems: "center",
  },
  infoLabel: { fontSize: 11, color: "#aaa", fontWeight: "600", marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },

  // LINK ROWS
  linkRow:    { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  linkIconBox:{ width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  linkLabel:  { flex: 1, fontSize: 14, fontWeight: "700", color: "#1a1a1a" },

  // PREFERENCES
  prefRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  prefLeft:   { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  prefIconBox:{ width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  prefLabel:  { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  prefSub:    { fontSize: 11, color: "#aaa", marginTop: 2 },

  // LOGOUT
  logoutSection: { marginHorizontal: 20, marginBottom: 10 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#fef2f2",
    paddingVertical: 16, borderRadius: 16,
    borderWidth: 1, borderColor: "#fecaca",
  },
  logoutBtnText: { color: "#ef4444", fontWeight: "800", fontSize: 15 },

  // LOGOUT MODAL
  modalOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center", zIndex: 9999,
  },
  modalBox: {
    width: 300, backgroundColor: "#fff", borderRadius: 24,
    padding: 28, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.15,
    shadowRadius: 12, elevation: 10,
  },
  modalIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#fef2f2",
    justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 22, fontWeight: "800", color: "#1a1a1a", marginBottom: 8 },
  modalText:  { fontSize: 14, color: "#999", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  modalBtns:  { flexDirection: "row", gap: 10, width: "100%" },
  cancelBtn: {
    flex: 1, paddingVertical: 13, backgroundColor: "#f5f5f5",
    borderRadius: 14, alignItems: "center",
  },
  cancelBtnText: { color: "#666", fontWeight: "700", fontSize: 14 },
  confirmBtn: {
    flex: 1, paddingVertical: 13, backgroundColor: "#ef4444",
    borderRadius: 14, alignItems: "center",
  },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // BOTTOM SHEET (shared by edit & password modals)
  bottomSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
    shadowColor: "#000", shadowOpacity: 0.15,
    shadowRadius: 20, elevation: 10,
  },
  dragHandle: {
    width: 40, height: 5, backgroundColor: "#e5e7eb",
    borderRadius: 3, alignSelf: "center", marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center",
    gap: 12, marginBottom: 20,
  },
  sheetIconCircle: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: "#fff5f5",
    justifyContent: "center", alignItems: "center",
  },
  sheetTitle:    { fontSize: 17, fontWeight: "800", color: "#1a1a1a" },
  sheetSub:      { fontSize: 12, color: "#aaa", marginTop: 2 },
  sheetCloseBtn: { backgroundColor: "#f5f5f5", borderRadius: 10, padding: 8 },

  // SHARED FIELD STYLES
  fieldLabel: {
    fontSize: 12, fontWeight: "700", color: "#444",
    marginBottom: 8, marginTop: 4,
  },
  fieldRequired: { color: "#ff4d4d" },
  fieldInputWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#f8f8f8", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: "#f0f0f0",
    marginBottom: 4,
  },
  fieldInputError: { borderColor: "#ef4444" },
  fieldInput:      { flex: 1, fontSize: 14, color: "#1a1a1a" },
  fieldError:      { fontSize: 12, color: "#ef4444", marginBottom: 8, marginLeft: 4 },

  // INFO BOX
  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#eff6ff", borderRadius: 12,
    padding: 12, marginTop: 8, marginBottom: 20,
    borderWidth: 1, borderColor: "#bfdbfe",
  },
  infoBoxText: { flex: 1, fontSize: 12, color: "#3b82f6", lineHeight: 17 },

  // SHEET BUTTONS
  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  sheetCancelBtn: {
    flex: 1, paddingVertical: 14,
    backgroundColor: "#f5f5f5", borderRadius: 14, alignItems: "center",
  },
  sheetCancelText: { color: "#666", fontWeight: "700", fontSize: 14 },
  sheetSaveBtn: {
    flex: 2, paddingVertical: 14,
    backgroundColor: "#ff4d4d", borderRadius: 14,
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    shadowColor: "#ff4d4d", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  sheetSaveText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  // MATCH ROW
  matchRow:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  matchText: { fontSize: 12, fontWeight: "500" },

  // SUCCESS
  successBox: {
    backgroundColor: "#fff", borderRadius: 24,
    padding: 32, alignItems: "center", width: 280,
    shadowColor: "#000", shadowOpacity: 0.15,
    shadowRadius: 20, elevation: 10,
  },
  successIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#f0fdf4",
    justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  successTitle: { fontSize: 20, fontWeight: "800", color: "#1a1a1a", marginBottom: 8 },
  successSub:   { fontSize: 14, color: "#aaa", textAlign: "center", lineHeight: 20 },
});