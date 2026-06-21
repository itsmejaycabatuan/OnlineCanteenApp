// app/admin/students.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../../lib/supabase";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Student = {
  id: string;
  full_name: string;
  school_id: string;
  email: string;
  created_at: string;
  order_count?: number;
  total_spent?: number;
};

type OrderHistory = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  order_items: {
    quantity: number;
    foods: { name: string } | null;
  }[];
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  pending:   { color: "#f59e0b", bg: "#fffbeb", label: "Pending"   },
  preparing: { color: "#3b82f6", bg: "#eff6ff", label: "Preparing" },
  ready:     { color: "#10b981", bg: "#f0fdf4", label: "Ready"     },
  completed: { color: "#6b7280", bg: "#f9fafb", label: "Completed" },
  cancelled: { color: "#ef4444", bg: "#fef2f2", label: "Cancelled" },
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AdminStudents() {
  const router = useRouter();
  const [students, setStudents]         = useState<Student[]>([]);
  const [filtered, setFiltered]         = useState<Student[]>([]);
  const [search, setSearch]             = useState("");
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── fetch students ─────────────────────────────────────────────────────────
  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, school_id, email, created_at")
        .eq("role", "student")
        .order("created_at", { ascending: false });

      if (error) { console.error(error); return; }

      // get order count and total spent per student
      const studentsWithStats = await Promise.all(
        (data ?? []).map(async (student) => {
          const { data: orders } = await supabase
            .from("orders")
            .select("total_amount, status")
            .eq("user_id", student.id)
            .neq("status", "cancelled");

          const order_count = orders?.length ?? 0;
          const total_spent = orders?.reduce(
            (sum, o) => sum + Number(o.total_amount), 0
          ) ?? 0;

          return { ...student, order_count, total_spent } as Student;
        })
      );

      setStudents(studentsWithStats);
      applySearch(search, studentsWithStats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStudents(); }, []);

  // ── search ─────────────────────────────────────────────────────────────────
  const applySearch = (query: string, source?: Student[]) => {
    const list = source ?? students;
    if (!query.trim()) {
      setFiltered(list);
      return;
    }
    const q = query.toLowerCase();
    setFiltered(list.filter(s =>
      s.full_name?.toLowerCase().includes(q) ||
      s.school_id?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    ));
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    applySearch(text);
  };

  // ── fetch order history ────────────────────────────────────────────────────
  const fetchOrderHistory = async (studentId: string) => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, status, total_amount, created_at,
          order_items(quantity, foods(name))
        `)
        .eq("user_id", studentId)
        .order("created_at", { ascending: false }) as unknown as {
          data: OrderHistory[] | null; error: any;
        };

      if (error) { console.error(error); return; }
      setOrderHistory(data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openStudent = (student: Student) => {
    setSelectedStudent(student);
    setOrderHistory([]);
    fetchOrderHistory(student.id);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", {
      month: "short", day: "numeric", year: "numeric",
    });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("en-PH", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  // ── loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4d4d" />
        <Text style={styles.loadingText}>Loading students…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Students</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{students.length}</Text>
        </View>
      </View>

      {/* ── SEARCH ───────────────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#aaa" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, school ID, or email..."
            placeholderTextColor="#ccc"
            value={search}
            onChangeText={handleSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={18} color="#aaa" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── STUDENT LIST ─────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchStudents(); }}
            tintColor="#ff4d4d"
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#ddd" />
            <Text style={styles.emptyText}>No students found</Text>
          </View>
        ) : (
          filtered.map((student, index) => (
            <TouchableOpacity
              key={student.id}
              style={styles.studentCard}
              onPress={() => openStudent(student)}
            >
              {/* avatar */}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {student.full_name?.charAt(0).toUpperCase() ?? "S"}
                </Text>
              </View>

              {/* info */}
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.full_name}</Text>
                <View style={styles.studentMeta}>
                  <Ionicons name="card-outline" size={12} color="#aaa" />
                  <Text style={styles.studentMetaText}>{student.school_id}</Text>
                </View>
                <View style={styles.studentMeta}>
                  <Ionicons name="mail-outline" size={12} color="#aaa" />
                  <Text style={styles.studentMetaText} numberOfLines={1}>
                    {student.email}
                  </Text>
                </View>
              </View>

              {/* stats */}
              <View style={styles.studentStats}>
                <View style={styles.statPill}>
                  <Ionicons name="receipt-outline" size={12} color="#ff4d4d" />
                  <Text style={styles.statPillText}>{student.order_count}</Text>
                </View>
                <Text style={styles.statSpent}>
                  ₱{(student.total_spent ?? 0).toLocaleString()}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#ddd" />
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── STUDENT DETAIL MODAL ─────────────────────────────────────────── */}
      <Modal
        visible={!!selectedStudent}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedStudent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedStudent && (
              <>
                {/* modal header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>
                      {selectedStudent.full_name?.charAt(0).toUpperCase() ?? "S"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSelectedStudent(null)}
                  >
                    <Ionicons name="close" size={20} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* student info */}
                <Text style={styles.modalName}>{selectedStudent.full_name}</Text>
                <View style={styles.modalInfoRow}>
                  <Ionicons name="card-outline" size={14} color="#aaa" />
                  <Text style={styles.modalInfoText}>{selectedStudent.school_id}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Ionicons name="mail-outline" size={14} color="#aaa" />
                  <Text style={styles.modalInfoText}>{selectedStudent.email}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Ionicons name="calendar-outline" size={14} color="#aaa" />
                  <Text style={styles.modalInfoText}>
                    Joined {formatDate(selectedStudent.created_at)}
                  </Text>
                </View>

                {/* stats row */}
                <View style={styles.modalStatsRow}>
                  <View style={styles.modalStatBox}>
                    <Text style={styles.modalStatValue}>
                      {selectedStudent.order_count}
                    </Text>
                    <Text style={styles.modalStatLabel}>Total Orders</Text>
                  </View>
                  <View style={styles.modalStatDivider} />
                  <View style={styles.modalStatBox}>
                    <Text style={styles.modalStatValue}>
                      ₱{(selectedStudent.total_spent ?? 0).toLocaleString()}
                    </Text>
                    <Text style={styles.modalStatLabel}>Total Spent</Text>
                  </View>
                </View>

                {/* order history */}
                <Text style={styles.modalSectionTitle}>Order History</Text>

                {historyLoading ? (
                  <View style={styles.historyLoading}>
                    <ActivityIndicator size="small" color="#ff4d4d" />
                    <Text style={styles.historyLoadingText}>Loading orders…</Text>
                  </View>
                ) : orderHistory.length === 0 ? (
                  <View style={styles.historyEmpty}>
                    <Ionicons name="receipt-outline" size={32} color="#ddd" />
                    <Text style={styles.historyEmptyText}>No orders yet</Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.historyList}
                    showsVerticalScrollIndicator={false}
                  >
                    {orderHistory.map(order => {
                      const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
                      const firstItem = order.order_items?.[0]?.foods?.name ?? "Item";
                      const extraCount = (order.order_items?.length ?? 1) - 1;
                      return (
                        <View key={order.id} style={styles.historyItem}>
                          {/* left */}
                          <View style={styles.historyLeft}>
                            <Text style={styles.historyOrderId}>
                              #{order.id.slice(0, 8).toUpperCase()}
                            </Text>
                            <Text style={styles.historyItems} numberOfLines={1}>
                              {firstItem}
                              {extraCount > 0 ? ` +${extraCount} more` : ""}
                            </Text>
                            <Text style={styles.historyTime}>
                              {formatTime(order.created_at)}
                            </Text>
                          </View>
                          {/* right */}
                          <View style={styles.historyRight}>
                            <View style={[
                              styles.historyStatus,
                              { backgroundColor: cfg.bg },
                            ]}>
                              <Text style={[
                                styles.historyStatusText,
                                { color: cfg.color },
                              ]}>
                                {cfg.label}
                              </Text>
                            </View>
                            <Text style={styles.historyAmount}>
                              ₱{Number(order.total_amount).toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                    <View style={{ height: 20 }} />
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#f8f8f8" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:      { color: "#999", fontSize: 14 },

  // HEADER
  header: {
    flexDirection: "row", alignItems: "center",
    paddingTop: 55, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
    gap: 12,
  },
  backBtn:         { padding: 4 },
  headerTitle:     { fontSize: 18, fontWeight: "800", color: "#1a1a1a", flex: 1 },
  headerBadge:     { backgroundColor: "#fff5f5", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  headerBadgeText: { fontSize: 13, fontWeight: "700", color: "#ff4d4d" },

  // SEARCH
  searchContainer: { backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#f5f5f5", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1a1a1a" },

  // STUDENT CARD
  list: { flex: 1, padding: 16 },
  studentCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 18, padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: "#fff5f5",
    justifyContent: "center", alignItems: "center",
  },
  avatarText:   { fontSize: 20, fontWeight: "800", color: "#ff4d4d" },
  studentInfo:  { flex: 1, gap: 3 },
  studentName:  { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  studentMeta:  { flexDirection: "row", alignItems: "center", gap: 4 },
  studentMetaText: { fontSize: 12, color: "#aaa", flex: 1 },
  studentStats: { alignItems: "flex-end", gap: 6 },
  statPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#fff5f5", borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  statPillText: { fontSize: 12, fontWeight: "700", color: "#ff4d4d" },
  statSpent:    { fontSize: 12, fontWeight: "700", color: "#10b981" },

  // EMPTY
  emptyContainer: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText:      { color: "#ccc", fontSize: 16, fontWeight: "500" },

  // MODAL
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, maxHeight: "88%",
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 16,
  },
  modalAvatar: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: "#fff5f5",
    justifyContent: "center", alignItems: "center",
  },
  modalAvatarText: { fontSize: 28, fontWeight: "800", color: "#ff4d4d" },
  modalCloseBtn:   { backgroundColor: "#f5f5f5", borderRadius: 10, padding: 8 },
  modalName:       { fontSize: 22, fontWeight: "800", color: "#1a1a1a", marginBottom: 10 },
  modalInfoRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  modalInfoText:   { fontSize: 14, color: "#666" },

  // MODAL STATS
  modalStatsRow: {
    flexDirection: "row", backgroundColor: "#f8f8f8",
    borderRadius: 16, padding: 16, marginTop: 16, marginBottom: 20,
  },
  modalStatBox:     { flex: 1, alignItems: "center", gap: 4 },
  modalStatDivider: { width: 1, backgroundColor: "#e5e5e5", marginHorizontal: 16 },
  modalStatValue:   { fontSize: 20, fontWeight: "800", color: "#ff4d4d" },
  modalStatLabel:   { fontSize: 12, color: "#999" },

  // ORDER HISTORY
  modalSectionTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", marginBottom: 12 },
  historyLoading:    { alignItems: "center", paddingVertical: 30, gap: 8 },
  historyLoadingText:{ color: "#aaa", fontSize: 13 },
  historyEmpty:      { alignItems: "center", paddingVertical: 30, gap: 8 },
  historyEmptyText:  { color: "#ccc", fontSize: 14 },
  historyList:       { maxHeight: 300 },
  historyItem: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#f5f5f5",
  },
  historyLeft:       { flex: 1, gap: 3 },
  historyOrderId:    { fontSize: 12, fontWeight: "700", color: "#ff4d4d" },
  historyItems:      { fontSize: 13, fontWeight: "500", color: "#1a1a1a" },
  historyTime:       { fontSize: 11, color: "#bbb" },
  historyRight:      { alignItems: "flex-end", gap: 6 },
  historyStatus:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  historyStatusText: { fontSize: 11, fontWeight: "700" },
  historyAmount:     { fontSize: 14, fontWeight: "800", color: "#1a1a1a" },
});