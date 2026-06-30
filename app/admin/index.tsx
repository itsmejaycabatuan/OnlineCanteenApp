// app/admin/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

// ─── TYPES ───────────────────────────────────────────────────────────────────
type OrderItemJoin = {
  quantity: number;
  food_id: string;
  foods: { name: string } | null;  // ← was menu_items
};

type RecentOrder = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  user_id: string;
  users: { full_name: string } | null;
  order_items: OrderItemJoin[];
};

type OrderItemWithOrders = {
  quantity: number;
  foods: { name: string } | null;   // ← was menu_items
  orders: { created_at: string } | null;
};

type Stats = {
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  topItem: string;
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  pending:   { color: "#f59e0b", bg: "#fffbeb", icon: "time-outline",           label: "Pending"   },
  preparing: { color: "#3b82f6", bg: "#eff6ff", icon: "flame-outline",          label: "Preparing" },
  ready:     { color: "#10b981", bg: "#f0fdf4", icon: "checkmark-circle-outline",label: "Ready"     },
  completed: { color: "#6b7280", bg: "#f9fafb", icon: "bag-check-outline",      label: "Completed" },
  cancelled: { color: "#ef4444", bg: "#fef2f2", icon: "close-circle-outline",   label: "Cancelled" },
};

const todayISO = () => new Date().toISOString().split("T")[0];

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats]           = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminName, setAdminName]   = useState("Admin");
  // 1. Add state for modal at the top of your component
const [logoutModal, setLogoutModal] = useState(false);
// 2. Replace handleLogout with this
const handleLogout = () => setLogoutModal(true);
const { signOut } = useAuth(); 

  // ── fetch everything ──────────────────────────────────────────────────────
  const fetchDashboard = async () => {
    try {
      const today = todayISO();

      // 1. admin name
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (profile) setAdminName(profile.full_name.split(" ")[0]);
      }

      // 2. today's orders
      const { data: todayOrders } = await supabase
        .from("orders")
        .select("id, status, total_amount")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      const totalOrders  = todayOrders?.length ?? 0;
// ── also make pending more accurate ──
const pendingOrders = todayOrders?.filter(o => o.status === "pending").length ?? 0;
// this is already correct in your code ✅
// ── AFTER (correct — only counts completed orders) ──
const totalRevenue = todayOrders
  ?.filter(o => o.status === "completed")
  .reduce((sum, o) => sum + Number(o.total_amount), 0) ?? 0;

      // 3. most ordered item today
     const { data: itemData } = await supabase
  .from("order_items")
  .select("quantity, foods(name), orders(created_at)")
  .gte("orders.created_at", `${today}T00:00:00`) as unknown as {
    data: OrderItemWithOrders[] | null;
  };

const itemTotals: Record<string, number> = {};
itemData?.forEach(row => {
  const name = row.foods?.name;     // ← was menu_items
  if (name) itemTotals[name] = (itemTotals[name] ?? 0) + row.quantity;
});
const topItem = Object.entries(itemTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

setStats({ totalOrders, pendingOrders, totalRevenue, topItem });

      // 4. recent orders (last 5)
    // ── Fix: remove date filter, just get last 5 orders ──
const { data: recent, error: recentError } = await supabase
      .from("orders")
      .select(`
        id, status, total_amount, created_at,
        user_id,
        order_items(
          quantity,
          foods(name)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(5) as unknown as { data: any[] | null; error: any };

    console.log("recent error:", recentError);

 const ordersWithNames = await Promise.all(
      (recent ?? []).map(async (order) => {
        const { data: userProfile } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", order.user_id)
          .single();

        console.log("user_id:", order.user_id, "profile:", userProfile);

        return {
          ...order,
          users: { full_name: userProfile?.full_name ?? "Unknown" },
        } as RecentOrder;
      })
    );

    setRecentOrders(ordersWithNames);

  } catch (e) {
    console.error(e);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  useEffect(() => { fetchDashboard(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchDashboard(); };

  // ── greeting ──────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4d4d" />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff4d4d" />}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
     <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.header}>
  <View style={styles.headerTop}>
    <View>
      <Text style={styles.headerGreeting}>{greeting} ☀️</Text>
      <Text style={styles.headerName}>{adminName}</Text>
      <Text style={styles.headerDate}>{dateLabel}</Text>
    </View>

    <View style={styles.headerRight}>
      {/* notification bell */}
      <TouchableOpacity style={styles.notifBtn}>
        <Ionicons name="notifications-outline" size={22} color="#ff4d4d" />
      </TouchableOpacity>

      {/* logout button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color="#fff" />
      </TouchableOpacity>
    </View>

  </View>
</LinearGradient>

      <View style={styles.body}>

        {/* ── STAT CARDS ─────────────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="receipt-outline"
            label="Orders Today"
            value={String(stats?.totalOrders ?? 0)}
            accent="#ff4d4d"
            bg="#fff5f5"
          />
          <StatCard
            icon="time-outline"
            label="Pending"
            value={String(stats?.pendingOrders ?? 0)}
            accent="#f59e0b"
            bg="#fffbeb"
          />
        <StatCard
  icon="cash-outline"
  label="Revenue (Completed)"  // ← update label
  value={`₱${(stats?.totalRevenue ?? 0).toLocaleString()}`}
  accent="#10b981"
  bg="#f0fdf4"
/>
          <StatCard
            icon="star-outline"
            label="Top Item"
            value={stats?.topItem ?? "—"}
            accent="#8b5cf6"
            bg="#f5f3ff"
            small
          />
        </View>

        {/* ── QUICK ACTIONS ──────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actionsRow}>
                <QuickAction
          icon="bar-chart-outline"
          label="Reports"
          color="#8b5cf6"
          onPress={() => router.push("/admin/reports" as any)}
        />
                
          <QuickAction
            icon="list-outline"
            label="Orders"
            color="#3b82f6"
            onPress={() => router.push("/admin/orders")}
          />
          <QuickAction
            icon="fast-food-outline"
            label="Menu"
            color="#10b981"
            onPress={() => router.push("/admin/menu")}
          />
          <QuickAction
            icon="people-outline"
            label="Students"
            color="#f59e0b"
            onPress={() => router.push("/admin/students")}
          />
                <QuickAction
        icon="cash-outline"
        label="Revenue"
        color="#10b981"
        onPress={() => router.push("/admin/revenue" as any)}
      />
      
        </View>

        {/* ── RECENT ORDERS ──────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity onPress={() => router.push("/admin/orders")}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        {recentOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={32} color="#ddd" />
            <Text style={styles.emptyText}>No orders yet today</Text>
          </View>
        ) : (
          recentOrders.map(order => (
            <OrderRow key={order.id} order={order} router={router} />
          ))
        )}
   <Modal
  visible={logoutModal}
  animationType="fade"
  transparent
  onRequestClose={() => setLogoutModal(false)}
>
  <View style={styles.logoutOverlay}>
    <View style={styles.logoutCard}>

      {/* icon */}
      <View style={styles.logoutIconCircle}>
        <Ionicons name="log-out-outline" size={32} color="#ef4444" />
      </View>

      {/* text */}
      <Text style={styles.logoutTitle}>Log Out</Text>
      <Text style={styles.logoutSub}>
        Are you sure you want to log out of your admin account?
      </Text>

      {/* buttons */}
      <TouchableOpacity
        style={styles.logoutConfirmBtn}
        onPress={async () => {
          setLogoutModal(false);
          await signOut();
          router.replace("/login" as any);
        }}
      >
        <Ionicons name="log-out-outline" size={18} color="#fff" />
        <Text style={styles.logoutConfirmText}>Yes, Log Out</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.logoutCancelBtn}
        onPress={() => setLogoutModal(false)}
      >
        <Text style={styles.logoutCancelText}>Cancel</Text>
      </TouchableOpacity>

    </View>
  </View>
</Modal>
      </View>
    </ScrollView>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, accent, bg, small,
}: {
  icon: string; label: string; value: string;
  accent: string; bg: string; small?: boolean;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <View style={[styles.statIconCircle, { backgroundColor: accent + "22" }]}>
        <Ionicons name={icon as any} size={20} color={accent} />
      </View>
      <Text
        style={[styles.statValue, { color: accent }, small && { fontSize: 14 }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({
  icon, label, color, onPress,
}: {
  icon: string; label: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <View style={[styles.actionIconCircle, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function OrderRow({ order, router }: { order: RecentOrder; router: any }) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const firstName = order.users?.full_name?.split(" ")[0] ?? "Student";
  // was: order.order_items?.[0]?.menu_items?.name
const firstItem = order.order_items?.[0]?.foods?.name ?? "Item";
  const extraCount = (order.order_items?.length ?? 1) - 1;
  const time = new Date(order.created_at).toLocaleTimeString("en-PH", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <TouchableOpacity
      style={styles.orderRow}
      onPress={() => router.push("/admin/orders")}
    >
      {/* avatar */}
      <View style={[styles.orderAvatar, { backgroundColor: cfg.bg }]}>
        <Text style={{ fontSize: 18 }}>👤</Text>
      </View>

      {/* info */}
      <View style={{ flex: 1 }}>
        <Text style={styles.orderName}>{firstName}</Text>
        <Text style={styles.orderItems} numberOfLines={1}>
          {firstItem}{extraCount > 0 ? ` +${extraCount} more` : ""}
        </Text>
      </View>

      {/* right side */}
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={styles.orderMeta}>₱{Number(order.total_amount).toFixed(2)}  ·  {time}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f8f8" },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:      { color: "#999", fontSize: 14 },

  // HEADER
  header: {
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerGreeting: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 2 },
  headerName:     { fontSize: 26, fontWeight: "800", color: "#fff" },
  headerDate:     { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  notifBtn: { backgroundColor: "#fff", borderRadius: 12, padding: 10 },

  // BODY
  body: { padding: 20 },

  // STATS
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
    marginTop: -28,        // pulls cards up to overlap header
  },
  statCard: {
    width: "47.5%",
    borderRadius: 18,
    padding: 16,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statIconCircle: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  statValue:      { fontSize: 22, fontWeight: "800" },
  statLabel:      { fontSize: 11, color: "#888", fontWeight: "500" },

  // SECTION
  sectionTitle:  { fontSize: 17, fontWeight: "700", color: "#1a1a1a", marginBottom: 14 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  seeAll:        { fontSize: 13, color: "#ff4d4d", fontWeight: "600" },

  // QUICK ACTIONS
  actionsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  actionBtn:  { alignItems: "center", gap: 8 },
  actionIconCircle: { width: 58, height: 58, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  actionLabel: { fontSize: 11, fontWeight: "600", color: "#444" },

  // ORDER ROW
  orderRow: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  orderAvatar: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  orderName:   { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  orderItems:  { fontSize: 12, color: "#999", marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusText:  { fontSize: 11, fontWeight: "600" },
  orderMeta:   { fontSize: 11, color: "#bbb" },

  // EMPTY
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  emptyText: { color: "#ccc", fontSize: 14 },
  headerRight: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
},
logoutBtn: {
  backgroundColor: "rgba(255,255,255,0.2)",
  borderRadius: 12,
  padding: 10,
},
// LOGOUT MODAL
logoutOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.5)",
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 30,
},
logoutCard: {
  backgroundColor: "#fff",
  borderRadius: 24,
  padding: 28,
  width: "100%",
  alignItems: "center",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.15,
  shadowRadius: 20,
  elevation: 10,
},
logoutIconCircle: {
  width: 70,
  height: 70,
  borderRadius: 35,
  backgroundColor: "#fef2f2",
  justifyContent: "center",
  alignItems: "center",
  marginBottom: 16,
},
logoutTitle: {
  fontSize: 22,
  fontWeight: "800",
  color: "#1a1a1a",
  marginBottom: 8,
},
logoutSub: {
  fontSize: 14,
  color: "#999",
  textAlign: "center",
  lineHeight: 20,
  marginBottom: 24,
},
logoutConfirmBtn: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  backgroundColor: "#ef4444",
  borderRadius: 14,
  paddingVertical: 14,
  width: "100%",
  marginBottom: 10,
},
logoutConfirmText: {
  color: "#fff",
  fontWeight: "800",
  fontSize: 15,
},
logoutCancelBtn: {
  backgroundColor: "#f5f5f5",
  borderRadius: 14,
  paddingVertical: 14,
  width: "100%",
  alignItems: "center",
},
logoutCancelText: {
  color: "#666",
  fontWeight: "700",
  fontSize: 15,
},
});