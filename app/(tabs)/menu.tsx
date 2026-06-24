// app/(tabs)/menu.tsx
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
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
import { useCart } from "../../contexts/CartContext";
import { supabase } from "../../lib/supabase";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = (width - 54) / 2;

// ─── TYPES ────────────────────────────────────────────────────────────────────
type FoodItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
  image: string | null;
  is_available: boolean;
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CATEGORIES = ["all", "meals", "drinks", "snacks", "desserts"];

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  all:      { icon: "grid-outline",       color: "#ff4d4d", bg: "#fff5f5" },
  meals:    { icon: "fast-food-outline",  color: "#ff4d4d", bg: "#fff5f5" },
  drinks:   { icon: "cafe-outline",       color: "#3b82f6", bg: "#eff6ff" },
  snacks:   { icon: "pizza-outline",      color: "#f59e0b", bg: "#fffbeb" },
  desserts: { icon: "ice-cream-outline",  color: "#8b5cf6", bg: "#f5f3ff" },
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function MenuScreen() {
  const router = useRouter();
  const { addToCart, cartItems } = useCart();

  const [items, setItems]               = useState<FoodItem[]>([]);
  const [filtered, setFiltered]         = useState<FoodItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch]             = useState("");
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  // modal
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [quantity, setQuantity]         = useState(1);
  const [note, setNote]                 = useState("");

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from("foods")
        .select("*")
        .eq("is_available", true)
        .order("category", { ascending: true });

      if (error) { console.error(error); return; }
      setItems(data ?? []);
      applyFilters("all", "", data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
  useCallback(() => {
    setLoading(true);
    fetchItems();
  }, [])
);

  // ── filter ─────────────────────────────────────────────────────────────────
  const applyFilters = (category: string, query: string, source?: FoodItem[]) => {
    const list = source ?? items;
    let result = category === "all"
      ? list
      : list.filter(i => i.category?.toLowerCase() === category.toLowerCase());
    if (query.trim()) {
      result = result.filter(i =>
        i.name.toLowerCase().includes(query.toLowerCase())
      );
    }
    setFiltered(result);
  };

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    applyFilters(cat, search);
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    applyFilters(activeCategory, text);
  };

  // ── modal ──────────────────────────────────────────────────────────────────
  const handleOpenModal = (item: FoodItem) => {
    setSelectedItem(item);
    setQuantity(1);
    setNote("");
    setModalVisible(true);
  };

  const handleConfirmAdd = () => {
    if (selectedItem) {
      addToCart({
        ...selectedItem,
        quantity,
        note: note.trim() || undefined,
      });
      setModalVisible(false);
      setSelectedItem(null);
    }
  };

  // ── helpers ────────────────────────────────────────────────────────────────
  const getImageUri = (item: FoodItem): string | null =>
    item?.image_url || item?.image || null;

  const cartCount = cartItems?.reduce((sum: number, i: any) => sum + i.quantity, 0) ?? 0;

  // ── loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4d4d" />
        <Text style={styles.loadingText}>Loading menu…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Our Menu 🍽️</Text>
          <Text style={styles.headerSub}>{filtered.length} items available</Text>
        </View>
        <TouchableOpacity
          style={styles.cartBtn}
          onPress={() => router.push("/(tabs)/cart")}
        >
          <Ionicons name="cart-outline" size={22} color="#ff4d4d" />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── SEARCH ───────────────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#aaa" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search food, drinks..."
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

     
     {/* ── CATEGORY FILTERS ─────────────────────────────────────────────── */}
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  style={styles.filterScroll}
  // Add alignItems: "center" here to prevent the buttons from stretching vertically
  contentContainerStyle={[styles.filterContent, { alignItems: "center" }]} 
>
        {CATEGORIES.map(cat => {
          const cfg = CATEGORY_CONFIG[cat];
          const isActive = activeCategory === cat;
          const count = cat === "all"
            ? items.length
            : items.filter(i => i.category?.toLowerCase() === cat).length;
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterTab,
                isActive && { backgroundColor: cfg.color, borderColor: cfg.color },
              ]}
              onPress={() => handleCategoryChange(cat)}
            >
              <Ionicons
                name={cfg.icon as any}
                size={14}
                color={isActive ? "#fff" : cfg.color}
              />
              <Text style={[styles.filterText, isActive && { color: "#fff" }]}>
                {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
              <View style={[
                styles.filterBadge,
                isActive
                  ? { backgroundColor: "rgba(255,255,255,0.3)" }
                  : { backgroundColor: "#f0f0f0" },
              ]}>
                <Text style={[styles.filterBadgeText, isActive && { color: "#fff" }]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── ITEMS GRID ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="fast-food-outline" size={48} color="#ddd" />
          <Text style={styles.emptyText}>No items found</Text>
          <Text style={styles.emptySubText}>
            {search ? "Try a different search term" : "Check back later"}
          </Text>
        </View>
      ) : (
       <FlatList
  data={filtered}
  keyExtractor={item => item.id}
  numColumns={2}

  columnWrapperStyle={styles.columnWrapper}
  contentContainerStyle={styles.listContent}
  showsVerticalScrollIndicator={false}
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); fetchItems(); }}
      tintColor="#ff4d4d"
    />
  }
  renderItem={({ item }) => {
    const imageUri = getImageUri(item);
    const cfg = CATEGORY_CONFIG[item.category?.toLowerCase()] ?? CATEGORY_CONFIG.meals;
    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => handleOpenModal(item)}
        activeOpacity={0.9}
      >
        {/* IMAGE */}
        <View style={styles.imageWrapper}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.itemImage} />
          ) : (
            <View style={[styles.imageFallback, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon as any} size={36} color={cfg.color} />
            </View>
          )}
          <View style={[styles.categoryPill, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.categoryPillText, { color: cfg.color }]}>
              {item.category}
            </Text>
          </View>
        </View>

        {/* INFO */}
        <View style={styles.cardInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.itemFooter}>
            <Text style={styles.itemPrice}>₱{item.price}</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => handleOpenModal(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }}
/>
      )}

      {/* ── ADD TO CART MODAL ────────────────────────────────────────────── */}
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
              <Text style={styles.modalTitle}>Add to Cart</Text>
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
                {/* ITEM PREVIEW */}
                <View style={styles.previewContainer}>
                  {getImageUri(selectedItem) ? (
                    <Image
                      source={{ uri: getImageUri(selectedItem)! }}
                      style={styles.previewImage}
                    />
                  ) : (
                    <View style={[
                      styles.previewImage,
                      styles.previewFallback,
                      { backgroundColor: CATEGORY_CONFIG[selectedItem.category?.toLowerCase()]?.bg ?? "#fff5f5" },
                    ]}>
                      <Ionicons
                        name={CATEGORY_CONFIG[selectedItem.category?.toLowerCase()]?.icon as any ?? "fast-food-outline"}
                        size={28}
                        color={CATEGORY_CONFIG[selectedItem.category?.toLowerCase()]?.color ?? "#ff4d4d"}
                      />
                    </View>
                  )}
                  <View style={styles.previewDetails}>
                    <Text style={styles.previewName}>{selectedItem.name}</Text>
                    <Text style={styles.previewCategory}>{selectedItem.category}</Text>
                    <Text style={styles.previewPrice}>₱{selectedItem.price}</Text>
                  </View>
                </View>

                {/* QUANTITY */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>Quantity</Text>
                  <View style={styles.counterGroup}>
                    <TouchableOpacity
                      style={[styles.counterBtn, quantity <= 1 && styles.counterBtnDisabled]}
                      disabled={quantity <= 1}
                      onPress={() => setQuantity(p => p - 1)}
                    >
                      <Ionicons
                        name="remove"
                        size={18}
                        color={quantity <= 1 ? "#d1d5db" : "#1f2937"}
                      />
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{quantity}</Text>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => setQuantity(p => p + 1)}
                    >
                      <Ionicons name="add" size={18} color="#1f2937" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* SPECIAL INSTRUCTIONS */}
                <Text style={styles.sectionLabel}>Special Instructions</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="e.g. Less spicy, no onions..."
                  placeholderTextColor="#9ca3af"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={140}
                />

                {/* TOTAL + CONFIRM */}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    ₱{Number(selectedItem.price) * quantity}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleConfirmAdd}
                  activeOpacity={0.85}
                >
                  <Ionicons name="cart-outline" size={20} color="#fff" />
                  <Text style={styles.confirmBtnText}>
                    Add to Cart  •  ₱{Number(selectedItem.price) * quantity}
                  </Text>
                </TouchableOpacity>

              </ScrollView>
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
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 55, paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#1a1a1a" },
  headerSub:   { fontSize: 13, color: "#aaa", marginTop: 2 },
  cartBtn: {
    backgroundColor: "#fff5f5", borderRadius: 14, padding: 10,
    position: "relative",
  },
  cartBadge: {
    position: "absolute", top: -4, right: -4,
    backgroundColor: "#ff4d4d", borderRadius: 10,
    width: 18, height: 18, justifyContent: "center", alignItems: "center",
  },
  cartBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  // SEARCH
  searchContainer: { backgroundColor: "#fff", paddingHorizontal: 16, paddingBottom: 12 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#f5f5f5", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1a1a1a" },

  // FILTERS
// FILTERS
 filterScroll: {
    backgroundColor: "#fff",
    // Fix the wrapper container to an exact height so it never pushes content down
    height: 50, 
    maxHeight: 50,
  },
  filterContent: { 
    paddingHorizontal: 16, 
    // Remove vertical padding so the container size dictates layout limits
    paddingVertical: 0, 
    gap: 8,
    alignItems: "center", // Keep items perfectly centered vertically
  },
  filterTab: {
    flexDirection: "row", 
    alignItems: "center", 
    gap: 5,
    paddingHorizontal: 12, 
    // Give the tab an exact height so changing icons/borders can't resize it
    height: 34, 
    borderRadius: 20, 
    borderWidth: 1.5, 
    borderColor: "#e5e5e5",
    backgroundColor: "#fff",
  },
  filterText:      { fontSize: 13, fontWeight: "600", color: "#666" },
  filterBadge:     { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  filterBadgeText: { fontSize: 11, fontWeight: "700", color: "#666" },

  // GRID
  listContent:   { padding: 16, paddingBottom: 40 },
columnWrapper: {
  justifyContent: "space-between",
  marginBottom: 16,
  paddingHorizontal: 0,
},

  // ITEM CARD
itemCard: {
  backgroundColor: "#fff",
  borderRadius: 20,
  width: CARD_WIDTH,
  overflow: "hidden",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
},
  imageWrapper:  { width: "100%", height: 130, position: "relative" },
  itemImage:     { width: "100%", height: "100%", resizeMode: "cover" },
  imageFallback: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  categoryPill: {
    position: "absolute", top: 8, left: 8,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  categoryPillText: { fontSize: 10, fontWeight: "700", textTransform: "capitalize" },
  cardInfo:    { padding: 12 },
  itemName:    { fontSize: 14, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  itemFooter:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemPrice:   { fontSize: 16, fontWeight: "900", color: "#ff4d4d" },
  addBtn: {
    backgroundColor: "#ff4d4d", width: 32, height: 32, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#ff4d4d", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 3,
  },

  // EMPTY
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText:      { color: "#ccc", fontSize: 16, fontWeight: "600" },
  emptySubText:   { color: "#ddd", fontSize: 13 },

  // MODAL
  modalOverlay:  { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "flex-end" },
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

  // MODAL PREVIEW
  previewContainer: {
    flexDirection: "row", backgroundColor: "#f8fafc", borderRadius: 20,
    padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#f1f5f9", marginBottom: 24,
  },
  previewImage:    { width: 70, height: 70, borderRadius: 14 },
  previewFallback: { justifyContent: "center", alignItems: "center" },
  previewDetails:  { marginLeft: 14, flex: 1, gap: 3 },
  previewName:     { fontSize: 16, fontWeight: "700", color: "#1f2937" },
  previewCategory: { fontSize: 12, color: "#aaa", textTransform: "capitalize" },
  previewPrice:    { fontSize: 16, fontWeight: "900", color: "#ff4d4d" },

  // QUANTITY
  sectionRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sectionLabel: { fontSize: 14, fontWeight: "700", color: "#374151" },
  counterGroup: { flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f6", borderRadius: 16, padding: 4, gap: 16 },
  counterBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  counterBtnDisabled: { backgroundColor: "#f9fafb", elevation: 0 },
  counterValue:       { fontSize: 16, fontWeight: "800", color: "#111827", minWidth: 20, textAlign: "center" },

  // NOTE
  noteInput: {
    backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0",
    borderRadius: 16, padding: 14, fontSize: 14, color: "#1f2937",
    height: 80, textAlignVertical: "top", marginBottom: 20,
  },

  // TOTAL + CONFIRM
  totalRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: "#f0f0f0", marginBottom: 16,
  },
  totalLabel: { fontSize: 15, fontWeight: "600", color: "#666" },
  totalValue: { fontSize: 22, fontWeight: "800", color: "#ff4d4d" },
  confirmBtn: {
    backgroundColor: "#ff4d4d", borderRadius: 20, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: "#ff4d4d", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});