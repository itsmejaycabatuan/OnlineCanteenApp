// app/admin/reports.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

const { width } = Dimensions.get("window");

// ─── TYPES ────────────────────────────────────────────────────────────────────
type DailySummary = {
  date: string;
  total_revenue: number;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
};

type TopItem = {
  name: string;
  total_quantity: number;
  total_revenue: number;
};

type CategoryStat = {
  category: string;
  count: number;
  revenue: number;
};

type OrderStatusStat = {
  status: string;
  count: number;
};

type OverallStats = {
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  avgOrderValue: number;
  totalStudents: number;
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
type RangeKey = "today" | "yesterday" | "month" | "all";

const RANGES: { label: string; value: RangeKey }[] = [
  { label: "Today",      value: "today"     },
  { label: "Yesterday",  value: "yesterday" },
  { label: "This Month", value: "month"     },
  { label: "All Time",   value: "all"       },
];

const STATUS_COLORS: Record<string, string> = {
  pending:   "#f59e0b",
  preparing: "#3b82f6",
  ready:     "#10b981",
  completed: "#6b7280",
  cancelled: "#ef4444",
};

const CATEGORY_COLORS: Record<string, string> = {
  meals:    "#ff4d4d",
  drinks:   "#3b82f6",
  snacks:   "#f59e0b",
  desserts: "#8b5cf6",
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const router = useRouter();

  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [activeRange, setActiveRange] = useState<RangeKey>("today");

  const [overall, setOverall]               = useState<OverallStats | null>(null);
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [topItems, setTopItems]             = useState<TopItem[]>([]);
  const [categoryStats, setCategoryStats]   = useState<CategoryStat[]>([]);
  const [statusStats, setStatusStats]       = useState<OrderStatusStat[]>([]);

  // ── date helpers ─────────────────────────────────────────────────────────
  const todayStr     = () => new Date().toISOString().split("T")[0];
  const yesterdayStr = () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  };
  const monthStartStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  };

  const getDateRange = (): { from: string; to: string } => {
    const today = todayStr();
    if (activeRange === "today")     return { from: today,           to: today           };
    if (activeRange === "yesterday") return { from: yesterdayStr(),  to: yesterdayStr()  };
    if (activeRange === "month")     return { from: monthStartStr(), to: today           };
    return { from: "2000-01-01", to: today };
  };

  // ── main fetch ────────────────────────────────────────────────────────────
  const fetchReports = async () => {
    try {
      const { from, to } = getDateRange();

      // 1. Fetch all orders in range
      const { data: allOrders } = await supabase
        .from("orders")
        .select("id, status, total_amount, created_at")
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`);

      const completed = allOrders?.filter(o => o.status === "completed") ?? [];
      const cancelled = allOrders?.filter(o => o.status === "cancelled") ?? [];

      // ✅ FIXED: only sum revenue from COMPLETED orders, never cancelled
      const totalRev = completed.reduce((s, o) => s + Number(o.total_amount), 0);
      const avgVal   = completed.length > 0 ? totalRev / completed.length : 0;

      // 2. Student count
      const { count: studentCount } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("role", "student");

      setOverall({
        totalRevenue:    totalRev,          // ✅ completed only
        totalOrders:     allOrders?.length ?? 0,
        completedOrders: completed.length,
        cancelledOrders: cancelled.length,
        avgOrderValue:   avgVal,            // ✅ completed only
        totalStudents:   studentCount ?? 0,
      });

      // 3. Status breakdown
      const statusMap: Record<string, number> = {};
      allOrders?.forEach(o => {
        statusMap[o.status] = (statusMap[o.status] ?? 0) + 1;
      });
      setStatusStats(
        Object.entries(statusMap).map(([status, count]) => ({ status, count }))
      );

      // 4. Daily summaries from revenue_summary table
      const { data: revData } = await supabase
        .from("revenue_summary")
        .select("*")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true });
      setDailySummaries(revData ?? []);

      // 5. Top selling items — completed orders only
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("quantity, foods(name, price, category), orders(created_at, status)") as unknown as { data: any[] };

      // ✅ filter: completed + within date range only
      const filteredItems = (itemsData ?? []).filter(row => {
        if (!row.orders) return false;
        if (row.orders.status !== "completed") return false; // ✅ completed only
        if (row.orders.created_at < `${from}T00:00:00`) return false;
        if (row.orders.created_at > `${to}T23:59:59`)   return false;
        return true;
      });

      const itemMap: Record<string, { qty: number; rev: number }> = {};
      filteredItems.forEach(row => {
        const name = row.foods?.name;
        if (!name) return;
        const price = Number(row.foods?.price ?? 0);
        itemMap[name] = {
          qty: (itemMap[name]?.qty ?? 0) + row.quantity,
          rev: (itemMap[name]?.rev ?? 0) + (price * row.quantity),
        };
      });
      setTopItems(
        Object.entries(itemMap)
          .map(([name, v]) => ({ name, total_quantity: v.qty, total_revenue: v.rev }))
          .sort((a, b) => b.total_quantity - a.total_quantity)
          .slice(0, 5)
      );

      // 6. Category breakdown — completed orders only
      const catMap: Record<string, { count: number; revenue: number }> = {};
      filteredItems.forEach(row => {
        const cat = row.foods?.category?.toLowerCase();
        if (!cat) return;
        const price = Number(row.foods?.price ?? 0);
        catMap[cat] = {
          count:   (catMap[cat]?.count   ?? 0) + row.quantity,
          revenue: (catMap[cat]?.revenue ?? 0) + (price * row.quantity),
        };
      });
      setCategoryStats(
        Object.entries(catMap)
          .map(([category, v]) => ({ category, count: v.count, revenue: v.revenue }))
          .sort((a, b) => b.count - a.count)
      );

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { setLoading(true); fetchReports(); }, [activeRange]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const formatCurrency = (v: number) =>
    `₱${Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

  const maxRevenue = Math.max(...dailySummaries.map(d => Number(d.total_revenue)), 1);
  const maxQty     = Math.max(...topItems.map(i => i.total_quantity), 1);
  const maxCat     = Math.max(...categoryStats.map(c => c.count), 1);
  const totalStatusCount = statusStats.reduce((s, i) => s + i.count, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4d4d" />
        <Text style={styles.loadingText}>Generating reports…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchReports(); }}
            tintColor="#ff4d4d"
          />
        }
      >
        {/* ── HEADER ── */}
        <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ alignItems: "center" }}>
              <Text style={styles.headerTitle}>Reports & Analytics</Text>
              <Text style={styles.headerSub}>Track your canteen performance</Text>
            </View>
            <TouchableOpacity
              onPress={() => { setRefreshing(true); fetchReports(); }}
              style={styles.refreshBtn}
            >
              <Ionicons name="refresh-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* ── TABS — same style as revenue.tsx ── */}
          <View style={styles.tabRow}>
            {RANGES.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[styles.tab, activeRange === r.value && styles.tabActive]}
                onPress={() => setActiveRange(r.value)}
              >
                <Text style={[styles.tabText, activeRange === r.value && styles.tabTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.body}>

          {/* ── REVENUE NOTE ── */}
          <View style={styles.revenueNote}>
            <Ionicons name="information-circle-outline" size={15} color="#10b981" />
            <Text style={styles.revenueNoteText}>
              Revenue only counts <Text style={{ fontWeight: "800" }}>completed</Text> orders. Cancelled orders are excluded.
            </Text>
          </View>

          {/* ── KPI CARDS ── */}
          <Text style={styles.sectionTitle}>📊 Key Metrics</Text>
          <View style={styles.kpiGrid}>
            <KPICard icon="cash-outline"            label="Total Revenue"  value={formatCurrency(overall?.totalRevenue ?? 0)}  color="#10b981" bg="#f0fdf4" />
            <KPICard icon="receipt-outline"         label="Total Orders"   value={String(overall?.totalOrders ?? 0)}            color="#3b82f6" bg="#eff6ff" />
            <KPICard icon="checkmark-circle-outline" label="Completed"     value={String(overall?.completedOrders ?? 0)}        color="#6b7280" bg="#f9fafb" />
            <KPICard icon="trending-up-outline"     label="Avg. Order"     value={formatCurrency(overall?.avgOrderValue ?? 0)}  color="#f59e0b" bg="#fffbeb" />
            <KPICard icon="close-circle-outline"    label="Cancelled"      value={String(overall?.cancelledOrders ?? 0)}        color="#ef4444" bg="#fef2f2" />
            <KPICard icon="people-outline"          label="Students"       value={String(overall?.totalStudents ?? 0)}          color="#8b5cf6" bg="#f5f3ff" />
          </View>

          {/* ── REVENUE BAR CHART ── */}
          <Text style={styles.sectionTitle}>💰 Daily Revenue</Text>
          <View style={styles.card}>
            {dailySummaries.length === 0 ? (
              <EmptyChart text="No revenue data for this period" />
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.barChartContent}
                >
                  {dailySummaries.map((day, i) => {
                    const barH  = Math.max((Number(day.total_revenue) / maxRevenue) * 120, 4);
                    const isToday = day.date === todayStr();
                    return (
                      <View key={i} style={styles.barGroup}>
                        <Text style={styles.barValue}>
                          {day.total_revenue > 0 ? `₱${Math.round(day.total_revenue)}` : ""}
                        </Text>
                        <View style={styles.barTrack}>
                          <LinearGradient
                            colors={isToday ? ["#ff7043", "#ff4d4d"] : ["#fca5a5", "#ff4d4d"]}
                            style={[styles.barFill, { height: barH }]}
                          />
                        </View>
                        <Text style={[styles.barLabel, isToday && { color: "#ff4d4d", fontWeight: "700" }]}>
                          {formatDate(day.date)}
                        </Text>
                        {isToday && <View style={styles.todayDot} />}
                      </View>
                    );
                  })}
                </ScrollView>
                <View style={styles.chartLegendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#ff4d4d" }]} />
                    <Text style={styles.legendText}>Completed orders only</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* ── ORDER STATUS BREAKDOWN ── */}
          <Text style={styles.sectionTitle}>📋 Order Status Breakdown</Text>
          <View style={styles.card}>
            {statusStats.length === 0 ? (
              <EmptyChart text="No orders in this period" />
            ) : (
              statusStats.map((s, i) => {
                const pct   = totalStatusCount > 0 ? (s.count / totalStatusCount) * 100 : 0;
                const color = STATUS_COLORS[s.status] ?? "#aaa";
                return (
                  <View key={i} style={styles.statusRow}>
                    <View style={styles.statusLeft}>
                      <View style={[styles.statusDot, { backgroundColor: color }]} />
                      <Text style={styles.statusLabel}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </Text>
                    </View>
                    <View style={styles.statusBarWrapper}>
                      <View style={[styles.statusBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.statusCount, { color }]}>{s.count}</Text>
                    <Text style={styles.statusPct}>{pct.toFixed(0)}%</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* ── TOP SELLING ITEMS ── */}
          <Text style={styles.sectionTitle}>🏆 Top Selling Items</Text>
          <View style={styles.card}>
            {topItems.length === 0 ? (
              <EmptyChart text="No completed orders in this period" />
            ) : (
              topItems.map((item, i) => {
                const barW   = (item.total_quantity / maxQty) * 100;
                const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
                return (
                  <View key={i} style={styles.topItemRow}>
                    <Text style={styles.topItemMedal}>{medals[i]}</Text>
                    <View style={styles.topItemInfo}>
                      <View style={styles.topItemNameRow}>
                        <Text style={styles.topItemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.topItemRevenue}>{formatCurrency(item.total_revenue)}</Text>
                      </View>
                      <View style={styles.topItemBarWrapper}>
                        <View style={[styles.topItemBarFill, { width: `${barW}%` }]} />
                      </View>
                      <Text style={styles.topItemQty}>{item.total_quantity} sold</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* ── CATEGORY PERFORMANCE ── */}
          <Text style={styles.sectionTitle}>🍽️ Category Performance</Text>
          <View style={styles.card}>
            {categoryStats.length === 0 ? (
              <EmptyChart text="No category data available" />
            ) : (
              <>
                {categoryStats.map((cat, i) => {
                  const color = CATEGORY_COLORS[cat.category] ?? "#aaa";
                  const pct   = maxCat > 0 ? (cat.count / maxCat) * 100 : 0;
                  return (
                    <View key={i} style={styles.catRow}>
                      <View style={[styles.catColorBar, { backgroundColor: color }]} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.catNameRow}>
                          <Text style={styles.catName}>
                            {cat.category.charAt(0).toUpperCase() + cat.category.slice(1)}
                          </Text>
                          <Text style={styles.catRevenue}>{formatCurrency(cat.revenue)}</Text>
                        </View>
                        <View style={styles.catBarWrapper}>
                          <View style={[styles.catBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                        </View>
                        <Text style={styles.catCount}>{cat.count} items sold</Text>
                      </View>
                    </View>
                  );
                })}
                <View style={styles.catTotalRow}>
                  <Text style={styles.catTotalLabel}>Total Items Sold</Text>
                  <Text style={styles.catTotalValue}>
                    {categoryStats.reduce((s, c) => s + c.count, 0)}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* ── DAILY ORDERS TABLE ── */}
          <Text style={styles.sectionTitle}>📅 Daily Orders Summary</Text>
          <View style={styles.card}>
            {dailySummaries.length === 0 ? (
              <EmptyChart text="No daily data available" />
            ) : (
              <>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, { flex: 1.5 }]}>Date</Text>
                  <Text style={[styles.tableCell, styles.tableCellRight]}>Orders</Text>
                  <Text style={[styles.tableCell, styles.tableCellRight]}>Done</Text>
                  <Text style={[styles.tableCell, styles.tableCellRight]}>Cancel</Text>
                  <Text style={[styles.tableCell, styles.tableCellRight]}>Revenue</Text>
                </View>

                {[...dailySummaries].reverse().map((day, i) => {
                  const isToday = day.date === todayStr();
                  return (
                    <View
                      key={i}
                      style={[
                        styles.tableRow,
                        isToday && styles.tableRowToday,
                        i % 2 === 0 && styles.tableRowAlt,
                      ]}
                    >
                      <View style={[{ flex: 1.5 }, styles.tableDateCell]}>
                        <Text style={styles.tableDateText}>{formatDate(day.date)}</Text>
                        {isToday && (
                          <View style={styles.todayPill}>
                            <Text style={styles.todayPillText}>Today</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.tableValueCell, styles.tableCellRight]}>
                        {day.total_orders}
                      </Text>
                      <Text style={[styles.tableValueCell, styles.tableCellRight, { color: "#10b981" }]}>
                        {day.completed_orders}
                      </Text>
                      <Text style={[styles.tableValueCell, styles.tableCellRight, { color: "#ef4444" }]}>
                        {day.cancelled_orders}
                      </Text>
                      <Text style={[styles.tableValueCell, styles.tableCellRight, { color: "#ff4d4d", fontWeight: "700" }]}>
                        ₱{Math.round(day.total_revenue).toLocaleString()}
                      </Text>
                    </View>
                  );
                })}

                <View style={styles.tableFooter}>
                  <Text style={[styles.tableCell, { flex: 1.5, color: "#1a1a1a", fontWeight: "800" }]}>TOTAL</Text>
                  <Text style={[styles.tableCell, styles.tableCellRight, { fontWeight: "800" }]}>
                    {dailySummaries.reduce((s, d) => s + d.total_orders, 0)}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellRight, { color: "#10b981", fontWeight: "800" }]}>
                    {dailySummaries.reduce((s, d) => s + d.completed_orders, 0)}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellRight, { color: "#ef4444", fontWeight: "800" }]}>
                    {dailySummaries.reduce((s, d) => s + d.cancelled_orders, 0)}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellRight, { color: "#ff4d4d", fontWeight: "800" }]}>
                    ₱{dailySummaries.reduce((s, d) => s + Math.round(d.total_revenue), 0).toLocaleString()}
                  </Text>
                </View>
              </>
            )}
          </View>

        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── SUB COMPONENTS ───────────────────────────────────────────────────────────
function KPICard({ icon, label, value, color, bg }: {
  icon: string; label: string; value: string; color: string; bg: string;
}) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: bg }]}>
      <View style={[styles.kpiIconCircle, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <View style={styles.emptyChart}>
      <Ionicons name="bar-chart-outline" size={32} color="#ddd" />
      <Text style={styles.emptyChartText}>{text}</Text>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#f8f8f8" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:      { color: "#999", fontSize: 14 },

  header: {
    paddingTop: 55, paddingHorizontal: 20, paddingBottom: 24,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 20,
  },
  backBtn:     { padding: 4 },
  refreshBtn:  { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.8)", textAlign: "center", marginTop: 2 },

  // TABS
  tabRow: { flexDirection: "row", gap: 6 },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center",
  },
  tabActive:     { backgroundColor: "#fff" },
  tabText:       { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  tabTextActive: { color: "#ff4d4d" },

  body:         { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#1a1a1a", marginBottom: 12, marginTop: 8 },

  // REVENUE NOTE
  revenueNote: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#f0fdf4", borderRadius: 12,
    padding: 10, marginBottom: 16,
    borderWidth: 1, borderColor: "#bbf7d0",
  },
  revenueNoteText: { fontSize: 12, color: "#16a34a", flex: 1 },

  // KPI GRID
  kpiGrid: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-between", marginBottom: 8,
  },
  kpiCard: {
    width: (width - 48) / 2, borderRadius: 16,
    padding: 14, marginBottom: 12, gap: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  kpiIconCircle: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  kpiValue:      { fontSize: 16, fontWeight: "800" },
  kpiLabel:      { fontSize: 10, color: "#888", fontWeight: "500" },

  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },

  barChartContent: { paddingBottom: 8, paddingHorizontal: 4, alignItems: "flex-end", gap: 8 },
  barGroup:        { alignItems: "center", width: 52 },
  barValue:        { fontSize: 9, color: "#aaa", marginBottom: 4, textAlign: "center" },
  barTrack: {
    width: 28, height: 120, backgroundColor: "#f5f5f5",
    borderRadius: 8, justifyContent: "flex-end", overflow: "hidden",
  },
  barFill:    { width: "100%", borderRadius: 8 },
  barLabel:   { fontSize: 10, color: "#aaa", marginTop: 6, textAlign: "center" },
  todayDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ff4d4d", marginTop: 2 },
  chartLegendRow: { flexDirection: "row", gap: 16, marginTop: 12, justifyContent: "center" },
  legendItem:     { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:      { width: 10, height: 10, borderRadius: 5 },
  legendText:     { fontSize: 11, color: "#aaa" },

  statusRow:        { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  statusLeft:       { flexDirection: "row", alignItems: "center", gap: 6, width: 90 },
  statusDot:        { width: 10, height: 10, borderRadius: 5 },
  statusLabel:      { fontSize: 13, fontWeight: "600", color: "#444" },
  statusBarWrapper: { flex: 1, height: 8, backgroundColor: "#f5f5f5", borderRadius: 4, overflow: "hidden" },
  statusBarFill:    { height: "100%", borderRadius: 4 },
  statusCount:      { fontSize: 13, fontWeight: "800", width: 28, textAlign: "right" },
  statusPct:        { fontSize: 11, color: "#aaa", width: 34, textAlign: "right" },

  topItemRow:        { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  topItemMedal:      { fontSize: 22, width: 30 },
  topItemInfo:       { flex: 1 },
  topItemNameRow:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  topItemName:       { fontSize: 14, fontWeight: "700", color: "#1a1a1a", flex: 1 },
  topItemRevenue:    { fontSize: 13, fontWeight: "700", color: "#10b981" },
  topItemBarWrapper: { height: 6, backgroundColor: "#f5f5f5", borderRadius: 3, overflow: "hidden", marginBottom: 4 },
  topItemBarFill:    { height: "100%", backgroundColor: "#ff4d4d", borderRadius: 3 },
  topItemQty:        { fontSize: 11, color: "#aaa" },

  catRow:       { flexDirection: "row", gap: 12, marginBottom: 16, alignItems: "flex-start" },
  catColorBar:  { width: 4, borderRadius: 2, height: "100%", minHeight: 50 },
  catNameRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  catName:      { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  catRevenue:   { fontSize: 13, fontWeight: "700", color: "#8b5cf6" },
  catBarWrapper:{ height: 6, backgroundColor: "#f5f5f5", borderRadius: 3, overflow: "hidden", marginBottom: 4 },
  catBarFill:   { height: "100%", borderRadius: 3 },
  catCount:     { fontSize: 11, color: "#aaa" },
  catTotalRow:  { flexDirection: "row", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f0f0f0", marginTop: 4 },
  catTotalLabel:{ fontSize: 13, fontWeight: "700", color: "#666" },
  catTotalValue:{ fontSize: 13, fontWeight: "800", color: "#1a1a1a" },

  tableHeader: {
    flexDirection: "row", paddingVertical: 10, paddingHorizontal: 8,
    backgroundColor: "#f8f8f8", borderRadius: 10, marginBottom: 4,
  },
  tableCell:      { fontSize: 11, fontWeight: "700", color: "#aaa", flex: 1 },
  tableCellRight: { textAlign: "right" },
  tableRow:       { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#f8f8f8" },
  tableRowAlt:    { backgroundColor: "#fafafa" },
  tableRowToday:  { backgroundColor: "#fff5f5" },
  tableDateCell:  { flex: 1.5, flexDirection: "row", alignItems: "center", gap: 6 },
  tableDateText:  { fontSize: 12, color: "#444", fontWeight: "600" },
  tableValueCell: { flex: 1, fontSize: 12, color: "#444", textAlign: "right" },
  todayPill:      { backgroundColor: "#ff4d4d", borderRadius: 20, paddingHorizontal: 6, paddingVertical: 1 },
  todayPillText:  { fontSize: 9, color: "#fff", fontWeight: "700" },
  tableFooter: {
    flexDirection: "row", paddingVertical: 12, paddingHorizontal: 8,
    backgroundColor: "#f0f0f0", borderRadius: 10, marginTop: 8,
  },

  emptyChart:     { alignItems: "center", paddingVertical: 30, gap: 10 },
  emptyChartText: { color: "#ccc", fontSize: 13 },
});