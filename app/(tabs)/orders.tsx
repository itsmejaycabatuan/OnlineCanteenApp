// app/(tabs)/orders.tsx
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useRef, useState } from "react";
import ViewShot from "react-native-view-shot";

import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type OrderItem = {
  id: string;
  quantity: number;
  subtotal: number;
  foods: { name: string; price: number } | null;
};

type Order = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  full_name?: string;
  order_items: OrderItem[];
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const FILTERS = ["all", "active", "completed", "cancelled"];

const STATUS_CONFIG: Record<string, {
  color: string; bg: string; icon: string; label: string;
}> = {
  pending:   { color: "#f59e0b", bg: "#fffbeb", icon: "time-outline",             label: "Pending"   },
  preparing: { color: "#3b82f6", bg: "#eff6ff", icon: "flame-outline",            label: "Preparing" },
  ready:     { color: "#10b981", bg: "#f0fdf4", icon: "checkmark-circle-outline", label: "Ready !"   },
  completed: { color: "#6b7280", bg: "#f9fafb", icon: "bag-check-outline",        label: "Completed" },
  cancelled: { color: "#ef4444", bg: "#fef2f2", icon: "close-circle-outline",     label: "Cancelled" },
};

const ACTIVE_STATUSES = ["pending", "preparing", "ready"];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function OrdersScreen() {
  const [showReceipt, setShowReceipt] = useState(false);

const receiptRef = useRef<ViewShot>(null);
  const [orders, setOrders]         = useState<Order[]>([]);
  const [filtered, setFiltered]     = useState<Order[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);



  const downloadReceipt = async () => {
  try {
    const permission =
      await MediaLibrary.requestPermissionsAsync();

    if (!permission.granted) {
      alert("Please allow storage permission.");
      return;
    }

    const uri = await receiptRef.current?.capture?.();

    if (!uri) {
      alert("Unable to generate receipt.");
      return;
    }

    await MediaLibrary.saveToLibraryAsync(uri);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }

    alert("Receipt saved successfully!");
  } catch (error) {
    console.log(error);
    alert("Failed to save receipt.");
  }
};


  // ── fetch orders ───────────────────────────────────────────────────────────
  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

     const { data, error } = await supabase
  .from("orders")
  .select(`
    id,
    status,
    total_amount,
    created_at,
    users(full_name),
    order_items(
      id,
      quantity,
      subtotal,
      foods(name, price)
    )
  `)
  .eq("user_id", user.id)
  .order("created_at", { ascending: false });

   if (error) {
  console.error(error);
  return;
}

const formattedOrders = (data || []).map((order: any) => ({
  ...order,
  full_name: order.users?.full_name,
}));

setOrders(formattedOrders);
applyFilter(activeFilter, formattedOrders);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ── re-fetch every time tab is focused ────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchOrders();
    }, [])
  );

  // ── filter ─────────────────────────────────────────────────────────────────
  const applyFilter = (filter: string, source?: Order[]) => {
    const list = source ?? orders;
    setActiveFilter(filter);
    if (filter === "all") {
      setFiltered(list);
    } else if (filter === "active") {
      setFiltered(list.filter(o => ACTIVE_STATUSES.includes(o.status)));
    } else {
      setFiltered(list.filter(o => o.status === filter));
    }
  };
  

  // ── helpers ────────────────────────────────────────────────────────────────
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("en-PH", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const getFilterCount = (filter: string) => {
    if (filter === "all")       return orders.length;
    if (filter === "active")    return orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length;
    return orders.filter(o => o.status === filter).length;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4d4d" />
        <Text style={styles.loadingText}>Loading your orders…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Orders 📋</Text>
          <Text style={styles.headerSub}>{orders.length} total orders</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => { setRefreshing(true); fetchOrders(); }}
        >
          <Ionicons name="refresh-outline" size={22} color="#ff4d4d" />
        </TouchableOpacity>
      </View>

      {/* ── FILTER TABS ──────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map(f => {
          const isActive = activeFilter === f;
          const count = getFilterCount(f);
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              onPress={() => applyFilter(f)}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
              <View style={[
                styles.filterBadge,
                isActive && styles.filterBadgeActive,
              ]}>
                <Text style={[styles.filterBadgeText, isActive && { color: "#fff" }]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── ORDER LIST ───────────────────────────────────────────────────── */}
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
            <Ionicons name="receipt-outline" size={56} color="#ddd" />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubText}>
              {activeFilter === "active"
                ? "You have no active orders right now"
                : "Your order history will appear here"}
            </Text>
          </View>
        ) : (
          filtered.map(order => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
            const firstItem  = order.order_items?.[0]?.foods?.name ?? "Item";
            const extraCount = (order.order_items?.length ?? 1) - 1;
            const isActive   = ACTIVE_STATUSES.includes(order.status);

            return (
              <TouchableOpacity
                key={order.id}
                style={[styles.orderCard, isActive && styles.orderCardActive]}
                onPress={() => setSelectedOrder(order)}
              >
                {/* active pulse indicator */}
                {isActive && <View style={styles.activePulse} />}

                {/* top row */}
                <View style={styles.orderCardTop}>
                  <View style={styles.orderIconCircle}>
                    <Ionicons
                      name={cfg.icon as any}
                      size={20}
                      color={cfg.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderId}>
                      Order #{order.id.slice(0, 8).toUpperCase()}
                    </Text>
                    <Text style={styles.orderTime}>{formatTime(order.created_at)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.color }]}>
                      {cfg.label}
                    </Text>
                  </View>
                </View>

                {/* divider */}
                <View style={styles.divider} />

                {/* items preview */}
                <Text style={styles.itemsPreview} numberOfLines={1}>
                  {firstItem}{extraCount > 0 ? ` +${extraCount} more` : ""}
                </Text>

                {/* bottom row */}
                <View style={styles.orderCardBottom}>
                  <Text style={styles.orderTotal}>
                    ₱{Number(order.total_amount).toFixed(2)}
                  </Text>
                  <View style={styles.detailsBtn}>
                    <Text style={styles.detailsBtnText}>View Details</Text>
                    <Ionicons name="chevron-forward" size={14} color="#ff4d4d" />
                  </View>
                </View>

              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── ORDER DETAIL MODAL ───────────────────────────────────────────── */}
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
              
                  <View style={styles.dragHandle} />

                 
               <View style={styles.modalHeader}>
  <View>
    <Text style={styles.modalOrderId}>
      #{selectedOrder.id.slice(0, 8).toUpperCase()}
    </Text>

    <Text style={styles.modalTime}>
      {formatTime(selectedOrder.created_at)}
    </Text>

    <TouchableOpacity
      style={styles.receiptCardBtn}
      onPress={() => setShowReceipt(true)}
    >
      <Ionicons
        name="receipt-outline"
        size={18}
        color="#ff4d4d"
      />

      <Text style={styles.receiptCardTitle}>
        View Receipt
      </Text>

      <Ionicons
        name="chevron-forward"
        size={16}
        color="#ff4d4d"
      />
    </TouchableOpacity>
  </View>

  <TouchableOpacity
    style={styles.closeBtn}
    onPress={() => setSelectedOrder(null)}
  >
    <Ionicons
      name="close"
      size={20}
      color="#666"
    />
  </TouchableOpacity>
</View>

                  {/* status banner */}
                  <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.statusBannerTitle, { color: cfg.color }]}>
                        {cfg.label}
                      </Text>
                      <Text style={styles.statusBannerSub}>
                        {selectedOrder.status === "pending"   && "Your order has been received"}
                        {selectedOrder.status === "preparing" && "The canteen is preparing your order"}
                        {selectedOrder.status === "ready"     && "Your order is ready for pickup! 🎉"}
                        {selectedOrder.status === "completed" && "Order has been completed"}
                        {selectedOrder.status === "cancelled" && "This order was cancelled"}
                      </Text>
                    </View>
                  </View>

                  {/* order items */}
                  <Text style={styles.modalSectionTitle}>Items Ordered</Text>
                  <ScrollView style={styles.itemsList}>
                    {selectedOrder.order_items?.map((item, i) => (
                      <View key={i} style={styles.itemRow}>
                        <View style={styles.itemRowLeft}>
                          <View style={styles.itemQtyBadge}>
                            <Text style={styles.itemQtyText}>x{item.quantity}</Text>
                          </View>
                          <Text style={styles.itemRowName}>
                            {item.foods?.name ?? "Item"}
                          </Text>
                        </View>
                        <Text style={styles.itemRowPrice}>
                          ₱{Number(item.subtotal).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>

                  {/* total */}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Amount</Text>
                    <Text style={styles.totalValue}>
                      ₱{Number(selectedOrder.total_amount).toFixed(2)}
                    </Text>
                  </View>

                  {/* close button */}
                  <TouchableOpacity
                    style={styles.closeBtnFull}
                    onPress={() => setSelectedOrder(null)}
                  >
                    <Text style={styles.closeBtnFullText}>Close</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
      <Modal
  visible={showReceipt}
  transparent
  animationType="fade"
  onRequestClose={() => setShowReceipt(false)}
>
  <View style={styles.receiptOverlay}>
    <ViewShot
      ref={receiptRef}
      options={{
        format: "png",
        quality: 1,
      }}
    >
      <View style={styles.receiptModal}>
        {selectedOrder && (
          <>
            {/* Success Icon */}
            <View style={styles.receiptSuccess}>
              <Ionicons
                name="checkmark"
                size={40}
                color="#fff"
              />
            </View>

            <Text style={styles.receiptTitle}>
              Order Confirmed!
            </Text>

            <Text style={styles.receiptSubtitle}>
              Present this stub to the canteen counter
            </Text>

            <View style={styles.receiptDivider} />

            {/* Order Info */}
            <View style={styles.receiptInfoRow}>
              <Text style={styles.receiptLabel}>
                Order ID:
              </Text>

              <Text style={styles.receiptValue}>
                #{selectedOrder.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>

              <View style={styles.receiptInfoRow}>
            <Text style={styles.receiptLabel}>
              Customer:
            </Text>

            <Text style={styles.receiptValue}>
              {selectedOrder.full_name || "N/A"}
            </Text>
              </View>


            <View style={styles.receiptInfoRow}>
              <Text style={styles.receiptLabel}>
                Date:
              </Text>

              <Text style={styles.receiptValue}>
                {formatTime(selectedOrder.created_at)}
              </Text>
            </View>

            <View style={styles.receiptInfoRow}>
              <Text style={styles.receiptLabel}>
                Status:
              </Text>

              <Text style={styles.receiptValue}>
                {selectedOrder.status}
              </Text>
            </View>

            <View style={styles.receiptDivider} />

            <Text style={styles.receiptSection}>
              ITEMS ORDERED
            </Text>

            {selectedOrder.order_items.map((item, index) => (
              <View
                key={index}
                style={styles.receiptItemRow}
              >
                <Text style={styles.receiptQty}>
                  {item.quantity}x
                </Text>

                <Text style={styles.receiptItemName}>
                  {item.foods?.name}
                </Text>

                <Text style={styles.receiptPrice}>
                  ₱{Number(item.subtotal).toFixed(2)}
                </Text>
              </View>
            ))}

            <View style={styles.receiptDivider} />

            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalText}>
                Total Amount
              </Text>

              <Text style={styles.receiptTotalPrice}>
                ₱{Number(
                  selectedOrder.total_amount
                ).toFixed(2)}
              </Text>
            </View>
          </>
        )}
      </View>
    </ViewShot>

    {/* Download Button */}

    {/* Close Button */}
    <TouchableOpacity
      style={styles.receiptCloseBtn}
      onPress={() => setShowReceipt(false)}
    >
      <Text style={styles.receiptCloseText}>
        Close Receipt
      </Text>
    </TouchableOpacity>
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
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 55, paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#1a1a1a" },
  headerSub:   { fontSize: 13, color: "#aaa", marginTop: 2 },
  refreshBtn:  { backgroundColor: "#fff5f5", borderRadius: 12, padding: 10 },

  // FILTERS
  filterScroll:  { backgroundColor: "#fff", maxHeight: 56 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterTab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5, borderColor: "#e5e5e5",
    backgroundColor: "#fff",
  },
  filterTabActive:    { backgroundColor: "#ff4d4d", borderColor: "#ff4d4d" },
  filterText:         { fontSize: 13, fontWeight: "600", color: "#666" },
  filterTextActive:   { color: "#fff" },
  filterBadge:        { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: "#f0f0f0" },
  filterBadgeActive:  { backgroundColor: "rgba(255,255,255,0.3)" },
  filterBadgeText:    { fontSize: 11, fontWeight: "700", color: "#666" },

  // ORDER CARD
  list: { flex: 1, padding: 16 },
  orderCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    position: "relative", overflow: "hidden",
  },
  orderCardActive: {
    borderWidth: 1.5, borderColor: "#ff4d4d",
  },
  activePulse: {
    position: "absolute", top: 0, left: 0, bottom: 0,
    width: 4, backgroundColor: "#ff4d4d", borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  orderCardTop:  { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  orderIconCircle: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: "#f8f8f8",
    justifyContent: "center", alignItems: "center",
  },
  orderId:       { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  orderTime:     { fontSize: 12, color: "#aaa", marginTop: 2 },
  statusBadge:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText:    { fontSize: 12, fontWeight: "700" },
  divider:       { height: 1, backgroundColor: "#f5f5f5", marginBottom: 12 },
  itemsPreview:  { fontSize: 13, color: "#888", marginBottom: 12 },
  orderCardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderTotal:    { fontSize: 16, fontWeight: "800", color: "#1a1a1a" },
  detailsBtn:    { flexDirection: "row", alignItems: "center", gap: 4 },
  detailsBtnText:{ fontSize: 13, color: "#ff4d4d", fontWeight: "600" },

  // EMPTY
  emptyContainer: { alignItems: "center", paddingTop: 100, gap: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: "700", color: "#ccc" },
  emptySubText:   { fontSize: 13, color: "#ddd", textAlign: "center", paddingHorizontal: 40 },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, maxHeight: "85%",
  },
  dragHandle:    { width: 40, height: 5, backgroundColor: "#e5e7eb", borderRadius: 3, alignSelf: "center", marginBottom: 20 },
  modalHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  modalOrderId:  { fontSize: 20, fontWeight: "800", color: "#1a1a1a" },
  modalTime:     { fontSize: 13, color: "#999", marginTop: 2 },
  closeBtn:      { backgroundColor: "#f5f5f5", borderRadius: 10, padding: 8 },

  // STATUS BANNER
  statusBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 16, marginBottom: 20,
  },
  statusBannerTitle: { fontSize: 15, fontWeight: "800" },
  statusBannerSub:   { fontSize: 12, color: "#888", marginTop: 2 },

  // ITEMS
  modalSectionTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a1a", marginBottom: 12 },
  itemsList:         { maxHeight: 200, marginBottom: 16 },
  itemRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#f5f5f5",
  },
  itemRowLeft:   { flexDirection: "row", alignItems: "center", gap: 10 },
  itemQtyBadge:  { backgroundColor: "#fff5f5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  itemQtyText:   { fontSize: 12, fontWeight: "700", color: "#ff4d4d" },
  itemRowName:   { fontSize: 14, fontWeight: "500", color: "#1a1a1a" },
  itemRowPrice:  { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },

  // TOTAL
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, borderTopWidth: 2, borderTopColor: "#f0f0f0", marginBottom: 20,
  },
  totalLabel: { fontSize: 15, fontWeight: "600", color: "#666" },
  totalValue: { fontSize: 22, fontWeight: "800", color: "#ff4d4d" },

  // CLOSE BUTTON
  closeBtnFull: {
    backgroundColor: "#f5f5f5", borderRadius: 14,
    paddingVertical: 14, alignItems: "center",
  },
  closeBtnFullText: { fontSize: 15, fontWeight: "700", color: "#666" },
  receiptBtn: {
  backgroundColor: "#ff4d4d",
  borderRadius: 14,
  paddingVertical: 14,
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  gap: 8,
  marginBottom: 12,
},

receiptBtnText: {
  color: "#fff",
  fontWeight: "700",
},

receiptOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.5)",
  justifyContent: "center",
  alignItems: "center",
},

receiptModal: {
  width: 320,
  backgroundColor: "#fff",
  borderRadius: 25,
  padding: 20,
},

receiptSuccess: {
  width: 70,
  height: 70,
  borderRadius: 35,
  backgroundColor: "#22c55e",
  alignSelf: "center",
  justifyContent: "center",
  alignItems: "center",
  marginBottom: 12,
},

receiptTitle: {
  textAlign: "center",
  fontSize: 22,
  fontWeight: "800",
},

receiptSubtitle: {
  textAlign: "center",
  color: "#888",
  marginBottom: 15,
},

receiptDivider: {
  borderBottomWidth: 1,
  borderColor: "#eee",
  marginVertical: 15,
},

receiptInfoRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginBottom: 10,
},

receiptLabel: {
  color: "#888",
},

receiptValue: {
  fontWeight: "700",
},

receiptSection: {
  fontWeight: "800",
  color: "#999",
  marginBottom: 15,
},

receiptItemRow: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 10,
},

receiptQty: {
  width: 40,
  color: "#ff4d4d",
  fontWeight: "700",
},

receiptItemName: {
  flex: 1,
},

receiptPrice: {
  fontWeight: "700",
},

receiptTotalRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: 10,
},

receiptTotalText: {
  fontSize: 18,
  fontWeight: "800",
},

receiptTotalPrice: {
  fontSize: 24,
  fontWeight: "900",
  color: "#ff4d4d",
},

downloadBtn: {
  marginTop: 20,
  backgroundColor: "#10b981",
  borderRadius: 14,
  paddingVertical: 14,
  paddingHorizontal: 25,
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
},

downloadBtnText: {
  color: "#fff",
  fontWeight: "700",
},

receiptCloseBtn: {
  marginTop: 20,
  width: 320,
  backgroundColor: "#ff4d4d",

  paddingVertical: 16,

  borderRadius: 16,

  justifyContent: "center",
  alignItems: "center",

  shadowColor: "#ff4d4d",
  shadowOffset: {
    width: 0,
    height: 6,
  },
  shadowOpacity: 0.25,
  shadowRadius: 10,

  elevation: 6,
},

receiptCloseText: {
  color: "#fff",
  fontSize: 15,
  fontWeight: "800",
  letterSpacing: 0.3,
},
receiptCardBtn: {
  marginTop: 12,

  backgroundColor: "#ff4d4d",

  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",

  paddingVertical: 10,
  paddingHorizontal: 16,

  borderRadius: 12,

  alignSelf: "flex-start",

  shadowColor: "#ff4d4d",
  shadowOffset: {
    width: 0,
    height: 4,
  },
  shadowOpacity: 0.25,
  shadowRadius: 8,

  elevation: 5,
},

receiptCardTitle: {
  color: "#fff",
  fontSize: 13,
  fontWeight: "700",
  marginHorizontal: 6,
},
});