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

type OverallStats = {
  totalRevenue: number;
  totalOrders: number;
  bestDay: string;
  bestDayRevenue: number;
};

export default function RevenueScreen() {
  const router = useRouter();
  const [summaries, setSummaries]   = useState<RevenueSummary[]>([]);
  const [overall, setOverall]       = useState<OverallStats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeRange, setActiveRange] = useState<"7" | "30" | "all">("7");

  const fetchRevenue = async () => {
    try {
      let query = supabase
        .from("revenue_summary")
        .select("*")
        .order("date", { ascending: false });

      // date range filter
      if (activeRange !== "all") {
        const days = parseInt(activeRange);
        const from = new Date();
        from.setDate(from.getDate() - days);
        query = query.gte("date", from.toISOString().split("T")[0]);
      }

      const { data, error } = await query;
      if (error) { console.error(error); return; }

      setSummaries(data ?? []);

      // calculate overall stats
      if (data && data.length > 0) {
        const totalRevenue = data.reduce((sum, d) => sum + Number(d.total_revenue), 0);
        const totalOrders  = data.reduce((sum, d) => sum + d.total_orders, 0);
        const best = data.reduce((a, b) =>
          Number(a.total_revenue) > Number(b.total_revenue) ? a : b
        );
        setOverall({
          totalRevenue,
          totalOrders,
          bestDay: best.date,
          bestDayRevenue: Number(best.total_revenue),
        });
      } else {
        setOverall({ totalRevenue: 0, totalOrders: 0, bestDay: "—", bestDayRevenue: 0 });
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchRevenue(); }, [activeRange]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-PH", {
      weekday: "short", month: "short", day: "numeric",
    });

  const formatCurrency = (amount: number) =>
    `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

  const isToday = (dateStr: string) =>
    dateStr === new Date().toISOString().split("T")[0];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4d4d" />
        <Text style={styles.loadingText}>Loading revenue…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* HEADER */}
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

        {/* OVERALL STATS */}
        <View style={styles.overallRow}>
          <View style={styles.overallItem}>
            <Text style={styles.overallValue}>
              {formatCurrency(overall?.totalRevenue ?? 0)}
            </Text>
            <Text style={styles.overallLabel}>Total Revenue</Text>
          </View>
          <View style={styles.overallDivider} />
          <View style={styles.overallItem}>
            <Text style={styles.overallValue}>{overall?.totalOrders ?? 0}</Text>
            <Text style={styles.overallLabel}>Total Orders</Text>
          </View>
        </View>
      </LinearGradient>

      {/* BEST DAY CARD */}
      {overall && overall.bestDay !== "—" && (
        <View style={styles.bestDayCard}>
          <View style={styles.bestDayLeft}>
            <Ionicons name="trophy-outline" size={20} color="#f59e0b" />
            <View>
              <Text style={styles.bestDayTitle}>Best Day</Text>
              <Text style={styles.bestDayDate}>{formatDate(overall.bestDay)}</Text>
            </View>
          </View>
          <Text style={styles.bestDayRevenue}>
            {formatCurrency(overall.bestDayRevenue)}
          </Text>
        </View>
      )}

      {/* DATE RANGE FILTER */}
      <View style={styles.rangeRow}>
        {(["7", "30", "all"] as const).map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.rangeBtn, activeRange === r && styles.rangeBtnActive]}
            onPress={() => setActiveRange(r)}
          >
            <Text style={[styles.rangeBtnText, activeRange === r && styles.rangeBtnTextActive]}>
              {r === "7" ? "Last 7 Days" : r === "30" ? "Last 30 Days" : "All Time"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* REVENUE LIST */}
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchRevenue(); }}
            tintColor="#ff4d4d"
          />
        }
      >
        {summaries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cash-outline" size={48} color="#ddd" />
            <Text style={styles.emptyText}>No revenue data yet</Text>
            <Text style={styles.emptySubText}>
              Revenue is recorded when orders are completed
            </Text>
          </View>
        ) : (
          summaries.map(item => (
            <View
              key={item.id}
              style={[styles.revenueCard, isToday(item.date) && styles.revenueCardToday]}
            >
              {/* date + today badge */}
              <View style={styles.revenueCardTop}>
                <View>
                  <View style={styles.dateBadgeRow}>
                    <Text style={styles.revenueDate}>{formatDate(item.date)}</Text>
                    {isToday(item.date) && (
                      <View style={styles.todayBadge}>
                        <Text style={styles.todayBadgeText}>Today</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.revenueAmount}>
                  {formatCurrency(item.total_revenue)}
                </Text>
              </View>

              {/* stats row */}
              <View style={styles.revenueStats}>
                <View style={styles.revenueStat}>
                  <Ionicons name="receipt-outline" size={13} color="#aaa" />
                  <Text style={styles.revenueStatText}>
                    {item.total_orders} orders
                  </Text>
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

              {/* revenue bar */}
              {overall && overall.totalRevenue > 0 && (
                <View style={styles.barWrapper}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.min(
                          (Number(item.total_revenue) / overall.bestDayRevenue) * 100,
                          100
                        )}%`,
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
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
  backBtn:     { padding: 4 },
  refreshBtn:  { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },

  // OVERALL
  overallRow: { flexDirection: "row", justifyContent: "space-around" },
  overallItem:    { alignItems: "center", gap: 4 },
  overallDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: 20 },
  overallValue:   { fontSize: 24, fontWeight: "800", color: "#fff" },
  overallLabel:   { fontSize: 12, color: "rgba(255,255,255,0.8)" },

  // BEST DAY
  bestDayCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", marginHorizontal: 20, marginTop: 16,
    borderRadius: 16, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  bestDayLeft:    { flexDirection: "row", alignItems: "center", gap: 10 },
  bestDayTitle:   { fontSize: 11, color: "#aaa", fontWeight: "600" },
  bestDayDate:    { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  bestDayRevenue: { fontSize: 16, fontWeight: "800", color: "#f59e0b" },

  // RANGE FILTER
  rangeRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  rangeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#fff", alignItems: "center",
    borderWidth: 1.5, borderColor: "#e5e5e5",
  },
  rangeBtnActive:     { backgroundColor: "#ff4d4d", borderColor: "#ff4d4d" },
  rangeBtnText:       { fontSize: 12, fontWeight: "600", color: "#666" },
  rangeBtnTextActive: { color: "#fff" },

  // REVENUE CARD
  list: { flex: 1, paddingHorizontal: 20 },
  revenueCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 16,
    marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  revenueCardToday: {
    borderWidth: 1.5, borderColor: "#ff4d4d",
  },
  revenueCardTop: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 10,
  },
  dateBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  revenueDate:  { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  todayBadge: {
    backgroundColor: "#fff5f5", borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  todayBadgeText: { fontSize: 10, fontWeight: "700", color: "#ff4d4d" },
  revenueAmount:  { fontSize: 18, fontWeight: "800", color: "#10b981" },
  revenueStats:   { flexDirection: "row", gap: 14, marginBottom: 12 },
  revenueStat:    { flexDirection: "row", alignItems: "center", gap: 4 },
  revenueStatText:{ fontSize: 12, color: "#aaa" },

  // BAR
  barWrapper: {
    height: 6, backgroundColor: "#f0f0f0",
    borderRadius: 3, overflow: "hidden",
  },
  barFill: {
    height: "100%", backgroundColor: "#ff4d4d",
    borderRadius: 3,
  },

  // EMPTY
  emptyContainer: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText:      { color: "#ccc", fontSize: 16, fontWeight: "600" },
  emptySubText:   { color: "#ddd", fontSize: 13, textAlign: "center" },
});