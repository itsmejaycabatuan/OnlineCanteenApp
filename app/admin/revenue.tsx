// app/admin/revenue.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

type RevenueSummary = {
  id: string;
  date: string;
  total_orders: number;
  total_revenue: number;
  completed_orders: number;
  cancelled_orders: number;
};

type RangeKey = "today" | "yesterday" | "month" | "all";

type RangeStat = {
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  bestDay: string;
  bestDayRevenue: number;
  bestSellingItem: string | null;
  bestSellingQty: number;
  // for comparison
  prevRevenue?: number;
  prevOrders?: number;
};

export default function RevenueScreen() {
  const router = useRouter();

  const [summaries, setSummaries]     = useState<RevenueSummary[]>([]);
  const [stats, setStats]             = useState<RangeStat | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [activeRange, setActiveRange] = useState<RangeKey>("today");

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

  // ── fetch best-selling item for a date range ──────────────────────────────
  const fetchBestSelling = async (from: string, to?: string): Promise<{ name: string; qty: number } | null> => {
    try {
      let query = supabase
        .from("order_items")
        .select("food_name, quantity, orders!inner(created_at, status)")
        .eq("orders.status", "completed");

      // filter by date using orders.created_at
      query = query.gte("orders.created_at", `${from}T00:00:00`);
      if (to) query = query.lte("orders.created_at", `${to}T23:59:59`);
      else     query = query.lte("orders.created_at", `${from}T23:59:59`);

      const { data } = await query;
      if (!data || data.length === 0) return null;

      // tally quantities per food_name
      const tally: Record<string, number> = {};
      data.forEach((row: any) => {
        tally[row.food_name] = (tally[row.food_name] || 0) + row.quantity;
      });

      const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
      return best ? { name: best[0], qty: best[1] } : null;
    } catch {
      return null;
    }
  };

  // ── main fetch ────────────────────────────────────────────────────────────
  const fetchRevenue = async () => {
    try {
      const today     = todayStr();
      const yesterday = yesterdayStr();
      const monthStart = monthStartStr();

      let from = today;
      let to   = today;

      if (activeRange === "yesterday") { from = yesterday; to = yesterday; }
      if (activeRange === "month")     { from = monthStart; to = today;    }
      if (activeRange === "all")       { from = "2000-01-01"; to = today;  }

      // fetch revenue_summary rows for this range
      const { data, error } = await supabase
        .from("revenue_summary")
        .select("*")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false });

      if (error) { console.error(error); return; }
      setSummaries(data ?? []);

      // build range stats
      const rows = data ?? [];
      const totalRevenue     = rows.reduce((s, r) => s + Number(r.total_revenue), 0);
      const totalOrders      = rows.reduce((s, r) => s + r.total_orders, 0);
      const completedOrders  = rows.reduce((s, r) => s + r.completed_orders, 0);
      const cancelledOrders  = rows.reduce((s, r) => s + r.cancelled_orders, 0);
      const best = rows.length
        ? rows.reduce((a, b) => Number(a.total_revenue) > Number(b.total_revenue) ? a : b)
        : null;

      // best-selling item
      const bs = await fetchBestSelling(from, activeRange === "today" || activeRange === "yesterday" ? undefined : to);

      // comparison: for today compare with yesterday; for month compare with previous month
      let prevRevenue = 0;
      let prevOrders  = 0;

      if (activeRange === "today") {
        const { data: prev } = await supabase
          .from("revenue_summary").select("*").eq("date", yesterday).single();
        if (prev) { prevRevenue = Number(prev.total_revenue); prevOrders = prev.total_orders; }
      }

      if (activeRange === "month") {
        const prevMonthEnd   = new Date(); prevMonthEnd.setDate(0);
        const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);
        const { data: prev } = await supabase
          .from("revenue_summary").select("*")
          .gte("date", prevMonthStart.toISOString().split("T")[0])
          .lte("date", prevMonthEnd.toISOString().split("T")[0]);
        if (prev) {
          prevRevenue = prev.reduce((s, r) => s + Number(r.total_revenue), 0);
          prevOrders  = prev.reduce((s, r) => s + r.total_orders, 0);
        }
      }

      setStats({
        totalRevenue, totalOrders, completedOrders, cancelledOrders,
        bestDay: best?.date ?? "—",
        bestDayRevenue: best ? Number(best.total_revenue) : 0,
        bestSellingItem: bs?.name ?? null,
        bestSellingQty: bs?.qty ?? 0,
        prevRevenue,
        prevOrders,
      });

    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchRevenue(); }, [activeRange]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const formatCurrency = (n: number) =>
    `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });

  const diffPct = (curr: number, prev: number) => {
    if (!prev) return null;
    const p = ((curr - prev) / prev) * 100;
    return p;
  };

  const DiffBadge = ({ curr, prev }: { curr: number; prev: number }) => {
    const p = diffPct(curr, prev);
    if (p === null) return null;
    const up   = p >= 0;
    const icon = up ? "arrow-up" : "arrow-down";
    const color = up ? "#10b981" : "#ef4444";
    const bg    = up ? "#ecfdf5" : "#fef2f2";
    return (
      <View style={[styles.diffBadge, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={11} color={color} />
        <Text style={[styles.diffText, { color }]}>{Math.abs(p).toFixed(1)}%</Text>
      </View>
    );
  };

  const RANGES: { key: RangeKey; label: string }[] = [
    { key: "today",     label: "Today"      },
    { key: "yesterday", label: "Yesterday"  },
    { key: "month",     label: "This Month" },
    { key: "all",       label: "All Time"   },
  ];

  const rangeTitle: Record<RangeKey, string> = {
    today:     "Today's Performance",
    yesterday: "Yesterday's Performance",
    month:     "This Month's Performance",
    all:       "All-Time Performance",
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4d4d" />
        <Text style={styles.loadingText}>Loading revenue…</Text>
      </View>
    );
  }

  const showComparison = activeRange === "today" || activeRange === "month";

  return (
    <View style={styles.container}>

      {/* ── HEADER ── */}
      <LinearGradient colors={["#ff4d4d", "#ff7043"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Revenue History</Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => { setRefreshing(true); fetchRevenue(); }}
          >
            <Ionicons name="refresh-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* BIG STATS */}
        <View style={styles.overallRow}>
          <View style={styles.overallItem}>
            <View style={styles.overallValueRow}>
              <Text style={styles.overallValue}>
                {formatCurrency(stats?.totalRevenue ?? 0)}
              </Text>
              {showComparison && stats && (
                <DiffBadge curr={stats.totalRevenue} prev={stats.prevRevenue ?? 0} />
              )}
            </View>
            <Text style={styles.overallLabel}>Total Revenue</Text>
          </View>
          <View style={styles.overallDivider} />
          <View style={styles.overallItem}>
            <View style={styles.overallValueRow}>
              <Text style={styles.overallValue}>{stats?.totalOrders ?? 0}</Text>
              {showComparison && stats && (
                <DiffBadge curr={stats.totalOrders} prev={stats.prevOrders ?? 0} />
              )}
            </View>
            <Text style={styles.overallLabel}>Total Orders</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── RANGE TABS ── */}
      <View style={styles.tabRow}>
        {RANGES.map(r => (
          <TouchableOpacity
            key={r.key}
            style={[styles.tab, activeRange === r.key && styles.tabActive]}
            onPress={() => { setActiveRange(r.key); setLoading(true); }}
          >
            <Text style={[styles.tabText, activeRange === r.key && styles.tabTextActive]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchRevenue(); }}
            tintColor="#ff4d4d"
          />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
        <Text style={styles.sectionTitle}>{rangeTitle[activeRange]}</Text>

        {/* ── STAT CARDS ROW ── */}
        <View style={styles.statCardsRow}>

          {/* Completed */}
          <View style={[styles.statCard, { borderLeftColor: "#10b981" }]}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
            <Text style={styles.statCardValue}>{stats?.completedOrders ?? 0}</Text>
            <Text style={styles.statCardLabel}>Completed</Text>
          </View>

          {/* Cancelled */}
          <View style={[styles.statCard, { borderLeftColor: "#ef4444" }]}>
            <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
            <Text style={styles.statCardValue}>{stats?.cancelledOrders ?? 0}</Text>
            <Text style={styles.statCardLabel}>Cancelled</Text>
          </View>

        </View>

        {/* ── BEST SELLING ITEM ── */}
        {stats?.bestSellingItem && (
          <View style={styles.highlightCard}>
            <View style={styles.highlightLeft}>
              <View style={[styles.highlightIcon, { backgroundColor: "#fff7ed" }]}>
                <Ionicons name="flame-outline" size={20} color="#f97316" />
              </View>
              <View>
                <Text style={styles.highlightLabel}>Best Selling Item</Text>
                <Text style={styles.highlightValue}>{stats.bestSellingItem}</Text>
              </View>
            </View>
            <View style={styles.highlightQtyBadge}>
              <Text style={styles.highlightQtyText}>{stats.bestSellingQty}x sold</Text>
            </View>
          </View>
        )}

        {/* ── BEST DAY (month / all time only) ── */}
        {(activeRange === "month" || activeRange === "all") && stats && stats.bestDay !== "—" && (
          <View style={styles.highlightCard}>
            <View style={styles.highlightLeft}>
              <View style={[styles.highlightIcon, { backgroundColor: "#fffbeb" }]}>
                <Ionicons name="trophy-outline" size={20} color="#f59e0b" />
              </View>
              <View>
                <Text style={styles.highlightLabel}>Best Day</Text>
                <Text style={styles.highlightValue}>{formatDate(stats.bestDay)}</Text>
              </View>
            </View>
            <Text style={styles.bestDayRevenue}>{formatCurrency(stats.bestDayRevenue)}</Text>
          </View>
        )}

        {/* ── COMPARISON NOTE ── */}
        {showComparison && stats && (
          <View style={styles.comparisonNote}>
            <Ionicons name="information-circle-outline" size={15} color="#3b82f6" />
            <Text style={styles.comparisonNoteText}>
              {activeRange === "today"
                ? "Compared with yesterday's performance"
                : "Compared with last month's performance"}
            </Text>
          </View>
        )}

        {/* ── DAILY BREAKDOWN LIST ── */}
        {summaries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cash-outline" size={48} color="#ddd" />
            <Text style={styles.emptyText}>No revenue data yet</Text>
            <Text style={styles.emptySubText}>Revenue records when orders are completed</Text>
          </View>
        ) : (
          <>
            <Text style={styles.breakdownTitle}>
              {activeRange === "today" || activeRange === "yesterday"
                ? "Order Breakdown"
                : "Daily Breakdown"}
            </Text>
            {summaries.map(item => (
              <View
                key={item.id}
                style={[
                  styles.revenueCard,
                  item.date === todayStr() && styles.revenueCardToday,
                ]}
              >
                <View style={styles.revenueCardTop}>
                  <View>
                    <View style={styles.dateBadgeRow}>
                      <Text style={styles.revenueDate}>{formatDate(item.date)}</Text>
                      {item.date === todayStr() && (
                        <View style={styles.todayBadge}>
                          <Text style={styles.todayBadgeText}>Today</Text>
                        </View>
                      )}
                      {item.date === yesterdayStr() && activeRange !== "yesterday" && (
                        <View style={[styles.todayBadge, { backgroundColor: "#f0f9ff" }]}>
                          <Text style={[styles.todayBadgeText, { color: "#3b82f6" }]}>Yesterday</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.revenueAmount}>
                    {formatCurrency(item.total_revenue)}
                  </Text>
                </View>

                <View style={styles.revenueStats}>
                  <View style={styles.revenueStat}>
                    <Ionicons name="receipt-outline" size={13} color="#aaa" />
                    <Text style={styles.revenueStatText}>{item.total_orders} orders</Text>
                  </View>
                  <View style={styles.revenueStat}>
                    <Ionicons name="checkmark-circle-outline" size={13} color="#10b981" />
                    <Text style={[styles.revenueStatText, { color: "#10b981" }]}>
                      {item.completed_orders} completed
                    </Text>
                  </View>
                  {item.cancelled_orders > 0 && (
                    <View style={styles.revenueStat}>
                      <Ionicons name="close-circle-outline" size={13} color="#ef4444" />
                      <Text style={[styles.revenueStatText, { color: "#ef4444" }]}>
                        {item.cancelled_orders} cancelled
                      </Text>
                    </View>
                  )}
                </View>

                {/* progress bar relative to best day */}
                {stats && stats.bestDayRevenue > 0 && (
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.min(
                            (Number(item.total_revenue) / stats.bestDayRevenue) * 100,
                            100
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#f8f8f8" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:      { color: "#999", fontSize: 14 },

  // HEADER
  header: {
    paddingTop: 55, paddingHorizontal: 20, paddingBottom: 28,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 24,
  },
  backBtn:    { padding: 4 },
  refreshBtn: { padding: 4 },
  headerTitle:{ fontSize: 18, fontWeight: "800", color: "#fff" },

  overallRow:     { flexDirection: "row", justifyContent: "space-around" },
  overallItem:    { alignItems: "center", gap: 4 },
  overallDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: 20 },
  overallValueRow:{ flexDirection: "row", alignItems: "center", gap: 6 },
  overallValue:   { fontSize: 22, fontWeight: "800", color: "#fff" },
  overallLabel:   { fontSize: 12, color: "rgba(255,255,255,0.8)" },

  // DIFF BADGE
  diffBadge: {
    flexDirection: "row", alignItems: "center", gap: 2,
    borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2,
  },
  diffText: { fontSize: 10, fontWeight: "700" },

  // TABS
  tabRow: {
    flexDirection: "row", gap: 6,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#fff", alignItems: "center",
    borderWidth: 1.5, borderColor: "#e5e5e5",
  },
  tabActive:     { backgroundColor: "#ff4d4d", borderColor: "#ff4d4d" },
  tabText:       { fontSize: 11, fontWeight: "600", color: "#666" },
  tabTextActive: { color: "#fff" },

  sectionTitle: {
    fontSize: 16, fontWeight: "800", color: "#1a1a1a",
    marginBottom: 14,
  },

  // STAT CARDS
  statCardsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 16,
    padding: 14, alignItems: "center", gap: 4,
    borderLeftWidth: 3,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  statCardValue: { fontSize: 22, fontWeight: "800", color: "#1a1a1a" },
  statCardLabel: { fontSize: 11, color: "#aaa", fontWeight: "600" },

  // HIGHLIGHT CARDS
  highlightCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  highlightLeft:  { flexDirection: "row", alignItems: "center", gap: 12 },
  highlightIcon:  { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  highlightLabel: { fontSize: 11, color: "#aaa", fontWeight: "600" },
  highlightValue: { fontSize: 15, fontWeight: "700", color: "#1a1a1a", marginTop: 2 },
  highlightQtyBadge: {
    backgroundColor: "#fff7ed", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  highlightQtyText: { fontSize: 12, fontWeight: "700", color: "#f97316" },
  bestDayRevenue:   { fontSize: 15, fontWeight: "800", color: "#f59e0b" },

  // COMPARISON NOTE
  comparisonNote: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#eff6ff", borderRadius: 12,
    padding: 10, marginBottom: 16,
    borderWidth: 1, borderColor: "#bfdbfe",
  },
  comparisonNoteText: { fontSize: 12, color: "#3b82f6", fontWeight: "500" },

  breakdownTitle: {
    fontSize: 13, fontWeight: "700", color: "#aaa",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 10, marginTop: 4,
  },

  // REVENUE CARD
  revenueCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  revenueCardToday: { borderWidth: 1.5, borderColor: "#ff4d4d" },
  revenueCardTop: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 10,
  },
  dateBadgeRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  revenueDate:   { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  todayBadge:    { backgroundColor: "#fff5f5", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  todayBadgeText:{ fontSize: 10, fontWeight: "700", color: "#ff4d4d" },
  revenueAmount: { fontSize: 18, fontWeight: "800", color: "#10b981" },
  revenueStats:  { flexDirection: "row", gap: 14, marginBottom: 12 },
  revenueStat:   { flexDirection: "row", alignItems: "center", gap: 4 },
  revenueStatText:{ fontSize: 12, color: "#aaa" },

  barWrapper: { height: 6, backgroundColor: "#f0f0f0", borderRadius: 3, overflow: "hidden" },
  barFill:    { height: "100%", backgroundColor: "#ff4d4d", borderRadius: 3 },

  emptyContainer: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText:    { color: "#ccc", fontSize: 16, fontWeight: "600" },
  emptySubText: { color: "#ddd", fontSize: 13, textAlign: "center" },
});