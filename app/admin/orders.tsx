// app/admin/orders.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

// ─── TYPES ───────────────────────────────────────────────────────────────────
type OrderItem = {
  id: string;
  quantity: number;
  subtotal: number;
  special_instructions: string | null;  // ← add this
  foods: { name: string; price: number } | null;
};

type Order = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  user_id: string;
  users: { full_name: string } | null;
  order_items: OrderItem[];
};

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const FILTERS = ["all", "pending", "preparing", "ready", "completed", "cancelled"];

const STATUS_CONFIG: Record<string, {
  color: string; bg: string; icon: string; label: string; next?: string; nextLabel?: string;
}> = {
  pending:   { color: "#f59e0b", bg: "#fffbeb", icon: "time-outline",            label: "Pending",   next: "preparing", nextLabel: "Start Preparing" },
  preparing: { color: "#3b82f6", bg: "#eff6ff", icon: "flame-outline",           label: "Preparing", next: "ready",     nextLabel: "Mark as Ready"   },
  ready:     { color: "#10b981", bg: "#f0fdf4", icon: "checkmark-circle-outline", label: "Ready",     next: "completed", nextLabel: "Complete Order"  },
  completed: { color: "#6b7280", bg: "#f9fafb", icon: "bag-check-outline",       label: "Completed"  },
  cancelled: { color: "#ef4444", bg: "#fef2f2", icon: "close-circle-outline",    label: "Cancelled"  },
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function AdminOrders() {
  const router = useRouter();
  const [orders, setOrders]           = useState<Order[]>([]);
  const [filtered, setFiltered]       = useState<Order[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updating, setUpdating]       = useState(false);

  // ── fetch ──────────────────────────────────────────────────────────────────
 const fetchOrders = async () => {
  try {
  const { data, error } = await supabase
  .from("orders")
  .select(`
    id, status, total_amount, created_at, user_id,
    order_items(id, quantity, subtotal, special_instructions, foods(name, price))
  `)                          // ← add special_instructions here
  .order("created_at", { ascending: false }) as unknown as {
    data: any[] | null; error: any;
  };

    if (error) { console.error(error); return; }

    const ordersWithNames = await Promise.all(
      (data ?? []).map(async (order) => {
        const { data: profile } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", order.user_id)
          .single();
        return { ...order, users: { full_name: profile?.full_name ?? "Student" } } as Order;
      })
    );

    setOrders(ordersWithNames);

    // ← KEY FIX: use the activeFilter ref directly instead of calling applyFilter
    setFiltered(
      activeFilter === "all"
        ? ordersWithNames
        : ordersWithNames.filter(o => o.status === activeFilter)
    );

  } catch (e) {
    console.error(e);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  useEffect(() => { fetchOrders(); }, []);


 // ── filter ─────────────────────────────────────────────────────────────────
const applyFilter = (filter: string, source?: Order[]) => {
  const list = source ?? orders;
  setActiveFilter(filter);
  setFiltered(filter === "all" ? list : list.filter(o => o.status === filter));
};

 // ── update status ──────────────────────────────────────────────────────────
const updateStatus = async (orderId: string, newStatus: string) => {
  console.log("updateStatus called:", orderId, newStatus); // ← add this
  setUpdating(true);

  const { error } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("id", orderId);

  console.log("update error:", error); // ← add this

  if (error) {
    Alert.alert("Error", "Failed to update order status.");
    setUpdating(false);
    return;
  }

  await fetchOrders();

  if (selectedOrder?.id === orderId) {
    setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
  }

  setUpdating(false);
};
const confirmUpdateStatus = (order: Order, next: string, nextLabel: string) => {
  console.log("confirmUpdateStatus called:", order.id, next, nextLabel); // ← add this
  Alert.alert(
    "Update Order",
    `Mark this order as "${nextLabel}"?`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () => {
          console.log("Confirm pressed"); // ← add this
          updateStatus(order.id, next);
        },
      },
    ]
  );
};

  const confirmCancel = (order: Order) => {
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order?",
      [
        { text: "No", style: "cancel" },
        { text: "Yes, Cancel", style: "destructive", onPress: () => updateStatus(order.id, "cancelled") },
      ]
    );
  };

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
        <Text style={styles.loadingText}>Loading orders…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Orders</Text>
        <TouchableOpacity onPress={() => { setLoading(true); fetchOrders(); }}>
          <Ionicons name="refresh-outline" size={22} color="#ff4d4d" />
        </TouchableOpacity>
      </View>

      {/* ── FILTER TABS ────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map(f => {
          const cfg = STATUS_CONFIG[f];
          const isActive = activeFilter === f;
          const count = f === "all" ? orders.length : orders.filter(o => o.status === f).length;
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterTab,
                isActive && {
                  backgroundColor: f === "all" ? "#ff4d4d" : cfg.color,
                  borderColor: f === "all" ? "#ff4d4d" : cfg.color,
                },
              ]}
              onPress={() => applyFilter(f)}
            >
              <Text style={[styles.filterText, isActive && { color: "#fff" }]}>
                {f === "all" ? "All" : cfg.label}
              </Text>
              <View style={[
                styles.filterBadge,
                isActive ? { backgroundColor: "rgba(255,255,255,0.3)" } : { backgroundColor: "#f0f0f0" },
              ]}>
                <Text style={[styles.filterBadgeText, isActive && { color: "#fff" }]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── ORDER LIST ─────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchOrders(); }}
            tintColor="#ff4d4d"
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color="#ddd" />
            <Text style={styles.emptyText}>No {activeFilter === "all" ? "" : activeFilter} orders</Text>
          </View>
        ) : (
          filtered.map(order => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => setSelectedOrder(order)}
              >
                {/* top row */}
                <View style={styles.orderCardTop}>
                  <View style={styles.orderCardLeft}>
                    <View style={[styles.orderAvatar, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                    </View>
                    <View>
                         <Text style={styles.orderIdText}>
      #{order.id.slice(0, 8).toUpperCase()}
    </Text>
                      <Text style={styles.orderName}>{order.users?.full_name ?? "Student"}</Text>
                      <Text style={styles.orderTime}>{formatTime(order.created_at)}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>

               {/* items preview */}
<View style={styles.orderDivider} />
<Text style={styles.orderItemsPreview} numberOfLines={1}>
  {order.order_items?.map(i => `${i.foods?.name ?? "Item"} x${i.quantity}`).join("  •  ")}
</Text>

{/* show notes if any item has special instructions */}
{order.order_items?.some(i => i.special_instructions) && (
  <View style={styles.orderNoteRow}>
    <Ionicons name="document-text-outline" size={12} color="#f59e0b" />
    <Text style={styles.orderNoteText} numberOfLines={1}>
      Has special instructions
    </Text>
  </View>
)}

                {/* bottom row */}
                <View style={styles.orderCardBottom}>
                  <Text style={styles.orderTotal}>₱{Number(order.total_amount).toFixed(2)}</Text>
                  {cfg.next && (
                    <TouchableOpacity
                      style={[styles.nextBtn, { backgroundColor: cfg.color }]}
                      onPress={() => confirmUpdateStatus(order, cfg.next!, cfg.nextLabel!)}
                    >
                      <Text style={styles.nextBtnText}>{cfg.nextLabel}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── ORDER DETAIL MODAL ─────────────────────────────────────────── */}
      <Modal
        visible={!!selectedOrder}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedOrder && (() => {
              const cfg = STATUS_CONFIG[selectedOrder.status] ?? STATUS_CONFIG.pending;
              return (
                <>
                  {/* modal header */}
             <View style={styles.modalHeader}>
  <View>
    <Text style={styles.modalOrderId}>
      Order ID: #{selectedOrder.id.slice(0, 8).toUpperCase()}
    </Text>
    <Text style={styles.modalTitle}>{selectedOrder.users?.full_name ?? "Student"}</Text>
    <Text style={styles.modalTime}>{formatTime(selectedOrder.created_at)}</Text>
  </View>
  <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.modalCloseBtn}>
    <Ionicons name="close" size={20} color="#666" />
  </TouchableOpacity>
</View>

                  {/* status badge */}
                  <View style={[styles.modalStatusRow, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                    <Text style={[styles.modalStatusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>

                {/* order items */}
<Text style={styles.modalSectionTitle}>Order Items</Text>
<ScrollView style={styles.modalItemsList}>
  {selectedOrder.order_items?.map((item, i) => (
    <View key={i} style={styles.modalItemBlock}>

      {/* item row */}
      <View style={styles.modalItem}>
        <View style={styles.modalItemLeft}>
          <Text style={styles.modalItemQty}>x{item.quantity}</Text>
          <Text style={styles.modalItemName}>{item.foods?.name ?? "Item"}</Text>
        </View>
        <Text style={styles.modalItemPrice}>
          ₱{Number(item.subtotal).toFixed(2)}
        </Text>
      </View>

      {/* special instructions */}
      {item.special_instructions ? (
        <View style={styles.modalItemNote}>
          <Ionicons name="document-text-outline" size={12} color="#f59e0b" />
          <Text style={styles.modalItemNoteText}>
            {item.special_instructions}
          </Text>
        </View>
      ) : null}

    </View>
  ))}
</ScrollView>

                  {/* total */}
                  <View style={styles.modalTotalRow}>
                    <Text style={styles.modalTotalLabel}>Total</Text>
                    <Text style={styles.modalTotalValue}>
                      ₱{Number(selectedOrder.total_amount).toFixed(2)}
                    </Text>
                  </View>

                  {/* action buttons */}
                  <View style={styles.modalActions}>
                    {cfg.next && (
                      <TouchableOpacity
                        style={[styles.modalActionBtn, { backgroundColor: cfg.color }, updating && { opacity: 0.6 }]}
                        onPress={() => confirmUpdateStatus(selectedOrder, cfg.next!, cfg.nextLabel!)}
                        disabled={updating}
                      >
                        <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                        <Text style={styles.modalActionBtnText}>
                          {updating ? "Updating…" : cfg.nextLabel}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {selectedOrder.status !== "cancelled" && selectedOrder.status !== "completed" && (
                      <TouchableOpacity
                        style={[styles.modalCancelBtn, updating && { opacity: 0.6 }]}
                        onPress={() => confirmCancel(selectedOrder)}
                        disabled={updating}
                      >
                        <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                        <Text style={styles.modalCancelBtnText}>Cancel Order</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#f8f8f8" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:      { color: "#999", fontSize: 14 },

  // HEADER
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 55, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },

  // FILTERS
  filterScroll:  { backgroundColor: "#fff", maxHeight: 56 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterTab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5, borderColor: "#e5e5e5",
    backgroundColor: "#fff",
  },
  filterText:      { fontSize: 13, fontWeight: "600", color: "#666" },
  filterBadge:     { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  filterBadgeText: { fontSize: 11, fontWeight: "700", color: "#666" },

  // ORDER CARD
  list: { flex: 1, padding: 16 },
  orderCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 16,
    marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  orderCardTop:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderCardLeft:   { flexDirection: "row", alignItems: "center", gap: 12 },
  orderAvatar:     { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  orderName:       { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  orderTime:       { fontSize: 12, color: "#999", marginTop: 2 },
  statusBadge:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText:      { fontSize: 12, fontWeight: "700" },
  orderDivider:    { height: 1, backgroundColor: "#f5f5f5", marginVertical: 12 },
  orderItemsPreview: { fontSize: 13, color: "#888", marginBottom: 12 },
  orderCardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderTotal:      { fontSize: 16, fontWeight: "800", color: "#1a1a1a" },
  nextBtn:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  nextBtnText:     { color: "#fff", fontSize: 12, fontWeight: "700" },

  // EMPTY
  emptyContainer: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText:      { color: "#ccc", fontSize: 16, fontWeight: "500" },

  // MODAL
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 16,
  },
  modalTitle:     { fontSize: 20, fontWeight: "800", color: "#1a1a1a" },
  modalTime:      { fontSize: 13, color: "#999", marginTop: 2 },
  modalCloseBtn:  { backgroundColor: "#f5f5f5", borderRadius: 10, padding: 8 },
  modalStatusRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 14, marginBottom: 20,
  },
  modalStatusText:    { fontSize: 14, fontWeight: "700" },
  modalSectionTitle:  { fontSize: 15, fontWeight: "700", color: "#1a1a1a", marginBottom: 12 },
  modalItemsList:     { maxHeight: 200, marginBottom: 16 },
  modalItem: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#f5f5f5",
  },
  modalItemLeft:  { flexDirection: "row", alignItems: "center", gap: 10 },
  modalItemQty:   { fontSize: 13, fontWeight: "700", color: "#ff4d4d", width: 28 },
  modalItemName:  { fontSize: 14, fontWeight: "500", color: "#1a1a1a" },
  modalItemPrice: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  modalTotalRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 14,
    borderTopWidth: 2, borderTopColor: "#f0f0f0", marginBottom: 20,
  },
  modalTotalLabel: { fontSize: 15, fontWeight: "600", color: "#666" },
  modalTotalValue: { fontSize: 22, fontWeight: "800", color: "#ff4d4d" },
  modalActions:    { gap: 10 },
  modalActionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 16,
  },
  modalActionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalCancelBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 16,
    backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca",
  },
  modalCancelBtnText: { color: "#ef4444", fontWeight: "700", fontSize: 15 },
  // Add these to your StyleSheet
modalOrderId: {
  fontSize: 12,
  fontWeight: "600",
  color: "#ff4d4d",
  marginBottom: 2,
  letterSpacing: 0.5,
},
orderIdText: {
  fontSize: 11,
  fontWeight: "700",
  color: "#ff4d4d",
  letterSpacing: 0.5,
},
// Add these to your StyleSheet.create
modalItemBlock: {
  borderBottomWidth: 1,
  borderBottomColor: "#f5f5f5",
  paddingVertical: 8,
},
modalItemNote: {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 6,
  backgroundColor: "#fffbeb",
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 6,
  marginTop: 4,
  marginBottom: 4,
  borderWidth: 1,
  borderColor: "#fde68a",
},
modalItemNoteText: {
  fontSize: 12,
  color: "#92400e",
  fontStyle: "italic",
  flex: 1,
  lineHeight: 16,
},
orderNoteRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 5,
  marginBottom: 10,
},
orderNoteText: {
  fontSize: 12,
  color: "#f59e0b",
  fontWeight: "600",
},
});