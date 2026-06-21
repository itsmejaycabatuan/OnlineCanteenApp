// app/(tabs)/home.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useCallback, useState } from "react";
import { useCart } from "../../contexts/CartContext";
import { supabase } from "../../lib/supabase";

const { width, height } = Dimensions.get("window");

export default function HomeScreen() {
  const router = useRouter();
  const { addToCart } = useCart();

  const [foods, setFoods]           = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible]   = useState(false);
  const [selectedItem, setSelectedItem]   = useState<any | null>(null);
  const [quantity, setQuantity]           = useState(1);
  const [note, setNote]                   = useState("");

  const categories = [
    { icon: "fast-food-outline", label: "Meals",    bg: "#fff1f1", accent: "#ff4d4d" },
    { icon: "cafe-outline",      label: "Drinks",   bg: "#f0f7ff", accent: "#4d9fff" },
    { icon: "pizza-outline",     label: "Snacks",   bg: "#fff8f0", accent: "#ff9f4d" },
    { icon: "ice-cream-outline", label: "Desserts", bg: "#f5f0ff", accent: "#9f4dff" },
  ];

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchFoods = async () => {
    const { data, error } = await supabase
      .from("foods")
      .select("*")
      .eq("is_available", true)
      .limit(5);              // ← limit to 5 featured items

    if (error) {
      console.log("Fetch error:", error.message);
    } else {
      setFoods(data ?? []);
    }
    setRefreshing(false);
  };

  // ── auto refresh when tab is focused ──────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      fetchFoods();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchFoods();
  };

  // ── modal ──────────────────────────────────────────────────────────────────
  const handleOpenModal = (item: any) => {
    setSelectedItem(item);
    setQuantity(1);
    setNote("");
    setModalVisible(true);
  };

  const handleConfirmAdd = () => {
    if (selectedItem) {
      addToCart({
        ...selectedItem,
        quantity: Number(quantity),
        note: note.trim() || undefined,
      });
      setModalVisible(false);
      setSelectedItem(null);
      setQuantity(1);
      setNote("");
    }
  };

  return (
    <LinearGradient
      colors={["#fff5f2", "#fafafa"]}
      style={styles.container}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        // ← pull to refresh
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ff4d4d"
            colors={["#ff4d4d"]}
          />
        }
      >
        {/* GRADIENT HEADER */}
        <LinearGradient
          colors={["#ff4d4d", "#ff7043"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerSmall}>Good morning ☀️</Text>
              <Text style={styles.headerName}>Hello, Student!</Text>
            </View>

            {/* ← REFRESH BUTTON */}
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={onRefresh}
            >
              <Ionicons
                name={refreshing ? "sync" : "refresh-outline"}
                size={22}
                color="#ff4d4d"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => router.push("/(tabs)/menu" as any)}
          >
            <Ionicons name="search-outline" size={18} color="#aaa" />
            <Text style={styles.searchText}>Search food, drinks...</Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.body}>

          {/* CATEGORIES */}
          <Text style={styles.sectionTitle}>Categories</Text>
          <View style={styles.categoryRow}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.label}
                style={[styles.categoryBox, { backgroundColor: cat.bg }]}
                onPress={() => router.push(`/category/${cat.label.toLowerCase()}` as any)}
              >
                <Ionicons name={cat.icon as any} size={26} color={cat.accent} />
                <Text style={[styles.categoryLabel, { color: cat.accent }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* TODAY'S SPECIAL */}
          <LinearGradient
            colors={["#1a1a2e", "#16213e"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <View style={styles.bannerLeft}>
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>🔥 Limited Time</Text>
              </View>
              <Text style={styles.bannerTitle}>Today's Special</Text>
              <Text style={styles.bannerSub}>Fresh meals available now</Text>
            </View>
            <Text style={styles.bannerEmoji}>🍱</Text>
          </LinearGradient>

          {/* FEATURED ITEMS */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Items</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/menu" as any)}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>

          {foods.length === 0 ? (
            <View style={styles.emptyFeatured}>
              <Ionicons name="fast-food-outline" size={32} color="#ddd" />
              <Text style={styles.emptyFeaturedText}>No items available</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.featuredScroll}
              contentContainerStyle={styles.featuredScrollContent}
            >
              {foods.map((item: any) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.featuredCard}
                  onPress={() => handleOpenModal(item)}
                  activeOpacity={0.9}
                >
                  <View style={styles.featuredEmoji}>
                    <Image
                      source={{ uri: item.image_url || item.image }}
                      style={{ width: 80, height: 80, borderRadius: 12 }}
                    />
                  </View>

                  <View style={styles.featuredTag}>
                    <Text style={styles.featuredTagText}>{item.category}</Text>
                  </View>

                  <Text style={styles.featuredName} numberOfLines={1}>
                    {item.name}
                  </Text>

                  <View style={styles.featuredFooter}>
                    <Text style={styles.featuredPrice}>₱{item.price}</Text>
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => handleOpenModal(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* QUICK STATS */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="time-outline" size={20} color="#ff4d4d" />
              <Text style={styles.statValue}>~10 min</Text>
              <Text style={styles.statLabel}>Avg. Wait</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="storefront-outline" size={20} color="#ff4d4d" />
              <Text style={styles.statValue}>Open</Text>
              <Text style={styles.statLabel}>Canteen</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="star-outline" size={20} color="#ff4d4d" />
              <Text style={styles.statValue}>4.8 ★</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* MODAL */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>

            <View style={styles.dragIndicator} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configure Order</Text>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollBody}
              >
                <View style={styles.previewContainer}>
                  <Image
                    source={{ uri: selectedItem.image_url || selectedItem.image }}
                    style={styles.previewImage}
                  />
                  <View style={styles.previewDetails}>
                    <Text style={styles.previewName}>{selectedItem.name}</Text>
                    <Text style={styles.previewPrice}>₱{selectedItem.price}</Text>
                  </View>
                </View>

                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>Select Quantity</Text>
                  <View style={styles.counterGroup}>
                    <TouchableOpacity
                      style={[styles.counterBtn, quantity <= 1 && styles.counterBtnDisabled]}
                      disabled={quantity <= 1}
                      onPress={() => setQuantity(prev => prev - 1)}
                    >
                      <Ionicons name="remove" size={18} color={quantity <= 1 ? "#d1d5db" : "#1f2937"} />
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{quantity}</Text>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => setQuantity(prev => prev + 1)}
                    >
                      <Ionicons name="add" size={18} color="#1f2937" />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.sectionLabel}>Special Instructions</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="e.g., Less spicy, no onions, extra sauce..."
                  placeholderTextColor="#9ca3af"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={140}
                />

                <TouchableOpacity
                  style={styles.confirmActionBtn}
                  onPress={handleConfirmAdd}
                  activeOpacity={0.85}
                >
                  <Text style={styles.confirmActionText}>
                    Add to Cart  •  ₱{Number(selectedItem.price) * quantity}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  scrollContainer: { flexGrow: 1 },

  headerGradient: {
    paddingTop: 55, paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 18,
  },
  headerSmall: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 2 },
  headerName:  { fontSize: 24, fontWeight: "800", color: "#fff" },
  notifBtn:    { backgroundColor: "#fff", borderRadius: 12, padding: 10 },
  searchBar: {
    backgroundColor: "#fff", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  searchText: { color: "#bbb", fontSize: 14 },

  body:         { padding: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 14 },
  sectionHeader:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, marginTop: 6 },
  seeAll:       { fontSize: 13, color: "#ff4d4d", fontWeight: "600" },

  categoryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22, gap: 8 },
  categoryBox: { alignItems: "center", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 6, flex: 1 },
  categoryLabel:{ marginTop: 6, fontSize: 11, fontWeight: "600" },

  banner: { borderRadius: 20, padding: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  bannerLeft:       { flex: 1 },
  bannerBadge:      { backgroundColor: "rgba(255,77,77,0.2)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 8 },
  bannerBadgeText:  { color: "#ff6b6b", fontSize: 11, fontWeight: "600" },
  bannerTitle:      { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 4 },
  bannerSub:        { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 14 },
  bannerEmoji:      { fontSize: 64, marginLeft: 10 },

  // EMPTY FEATURED
  emptyFeatured:     { alignItems: "center", paddingVertical: 30, gap: 8, marginBottom: 24 },
  emptyFeaturedText: { color: "#ccc", fontSize: 14 },

  featuredScroll:        { marginBottom: 24, marginHorizontal: -20 },
  featuredScrollContent: { paddingHorizontal: 20, paddingBottom: 8 },
  featuredCard: {
    backgroundColor: "#fff", borderRadius: 24, padding: 12,
    marginRight: 14, width: 154, borderWidth: 1, borderColor: "#f1f5f9",
    shadowColor: "#0f172a", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 3,
  },
  featuredEmoji:   { backgroundColor: "#f8fafc", borderRadius: 16, overflow: "hidden", alignItems: "center", marginBottom: 10 },
  featuredTag:     { backgroundColor: "#fff1f1", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 6 },
  featuredTagText: { fontSize: 10, color: "#ff4d4d", fontWeight: "700" },
  featuredName:    { fontSize: 14, fontWeight: "700", color: "#1f2937", marginBottom: 10 },
  featuredFooter:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  featuredPrice:   { fontSize: 16, fontWeight: "900", color: "#ff4d4d" },
  addBtn: {
    backgroundColor: "#ff4d4d", borderRadius: 10,
    width: 28, height: 28, alignItems: "center", justifyContent: "center",
  },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 30 },
  statCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 20, padding: 14,
    alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#f1f5f9",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 6, elevation: 2,
  },
  statValue: { fontSize: 13, fontWeight: "800", color: "#1f2937" },
  statLabel: { fontSize: 11, color: "#9ca3af", fontWeight: "500" },

  modalOverlay:  { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.6)", justifyContent: "flex-end" },
  modalContent:  { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: height * 0.85, paddingBottom: 34 },
  dragIndicator: { width: 40, height: 5, backgroundColor: "#e5e7eb", borderRadius: 3, alignSelf: "center", marginTop: 12 },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 1, borderColor: "#f1f5f9",
  },
  modalTitle:      { fontSize: 18, fontWeight: "800", color: "#111827" },
  closeModalBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f3f4f6", justifyContent: "center", alignItems: "center" },
  modalScrollBody: { paddingHorizontal: 24, paddingTop: 20 },
  previewContainer:{ flexDirection: "row", backgroundColor: "#f8fafc", borderRadius: 20, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#f1f5f9", marginBottom: 24 },
  previewImage:    { width: 70, height: 70, borderRadius: 14, backgroundColor: "#e2e8f0" },
  previewDetails:  { marginLeft: 14, flex: 1 },
  previewName:     { fontSize: 16, fontWeight: "700", color: "#1f2937", marginBottom: 4 },
  previewPrice:    { fontSize: 16, fontWeight: "900", color: "#ff4d4d" },
  sectionRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  sectionLabel:    { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8 },
  counterGroup:    { flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f6", borderRadius: 16, padding: 4, gap: 16 },
  counterBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  counterBtnDisabled: { backgroundColor: "#f9fafb", elevation: 0 },
  counterValue:    { fontSize: 16, fontWeight: "800", color: "#111827", minWidth: 20, textAlign: "center" },
  noteInput: {
    backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0",
    borderRadius: 16, padding: 14, fontSize: 14, color: "#1f2937",
    height: 80, textAlignVertical: "top", marginBottom: 28,
  },
  confirmActionBtn: {
    backgroundColor: "#ff4d4d", borderRadius: 20, paddingVertical: 16,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#ff4d4d", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  confirmActionText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});