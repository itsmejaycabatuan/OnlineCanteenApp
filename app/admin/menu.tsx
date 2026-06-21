// app/admin/menu.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

// ─── TYPES ───────────────────────────────────────────────────────────────────
type FoodItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  is_available: boolean;
  created_at: string;
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CATEGORIES = ["all", "meals", "drinks", "snacks", "desserts"];

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  meals:    { icon: "fast-food-outline",  color: "#ff4d4d", bg: "#fff5f5" },
  drinks:   { icon: "cafe-outline",       color: "#3b82f6", bg: "#eff6ff" },
  snacks:   { icon: "pizza-outline",      color: "#f59e0b", bg: "#fffbeb" },
  desserts: { icon: "ice-cream-outline",  color: "#8b5cf6", bg: "#f5f3ff" },
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AdminMenu() {
  const router = useRouter();
  const [items, setItems]             = useState<FoodItem[]>([]);
  const [filtered, setFiltered]       = useState<FoodItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch]           = useState("");
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [togglingId, setTogglingId]   = useState<string | null>(null);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from("foods")
        .select("*")
        .order("created_at", { ascending: false });
  console.log("categories in DB:", data?.map(i => i.category)); // ← add this
      if (error) { console.error(error); return; }
      setItems(data ?? []);
      applyFilters(activeCategory, search, data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  // ── filter & search ────────────────────────────────────────────────────────
  const applyFilters = (category: string, query: string, source?: FoodItem[]) => {
  const list = source ?? items;
  let result = category === "all"
    ? list
    : list.filter(i => i.category?.toLowerCase() === category.toLowerCase()); // ← add .toLowerCase()
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

  // ── toggle availability ────────────────────────────────────────────────────
  const toggleAvailability = async (item: FoodItem) => {
    setTogglingId(item.id);
    const { error } = await supabase
      .from("foods")
      .update({ is_available: !item.is_available })
      .eq("id", item.id);

    if (error) {
      Alert.alert("Error", "Failed to update availability.");
      setTogglingId(null);
      return;
    }

    const updated = items.map(i =>
      i.id === item.id ? { ...i, is_available: !item.is_available } : i
    );
    setItems(updated);
    applyFilters(activeCategory, search, updated);
    setTogglingId(null);
  };

  // ── delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = (item: FoodItem) => {
    Alert.alert(
      "Delete Item",
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("foods")
              .delete()
              .eq("id", item.id);

            if (error) {
              Alert.alert("Error", "Failed to delete item.");
              return;
            }

            const updated = items.filter(i => i.id !== item.id);
            setItems(updated);
            applyFilters(activeCategory, search, updated);
          },
        },
      ]
    );
  };

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

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu Management</Text>
        <TouchableOpacity onPress={() => { setLoading(true); fetchItems(); }}>
          <Ionicons name="refresh-outline" size={22} color="#ff4d4d" />
        </TouchableOpacity>
      </View>

      {/* ── SEARCH BAR ─────────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#aaa" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search food items..."
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

      {/* ── CATEGORY FILTERS ───────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat;
          const cfg = CATEGORY_CONFIG[cat];
          const count = cat === "all"
            ? items.length
            : items.filter(i => i.category === cat).length;
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterTab,
                isActive && {
                  backgroundColor: cat === "all" ? "#ff4d4d" : cfg.color,
                  borderColor: cat === "all" ? "#ff4d4d" : cfg.color,
                },
              ]}
              onPress={() => handleCategoryChange(cat)}
            >
              {cat !== "all" && (
                <Ionicons
                  name={cfg.icon as any}
                  size={13}
                  color={isActive ? "#fff" : cfg.color}
                />
              )}
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

      {/* ── ITEM LIST ──────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchItems(); }}
            tintColor="#ff4d4d"
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="fast-food-outline" size={48} color="#ddd" />
            <Text style={styles.emptyText}>No items found</Text>
            <Text style={styles.emptySubText}>
              {search ? "Try a different search term" : "Tap + to add a new item"}
            </Text>
          </View>
        ) : (
          filtered.map(item => {
            const cfg = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.meals;
            return (
              <View key={item.id} style={[
                styles.itemCard,
                !item.is_available && styles.itemCardDisabled,
              ]}>

                {/* LEFT — icon */}
                <View style={[styles.itemIcon, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon as any} size={24} color={cfg.color} />
                </View>

                {/* MIDDLE — info */}
                <View style={styles.itemInfo}>
                  <View style={styles.itemTopRow}>
                    <Text style={[
                      styles.itemName,
                      !item.is_available && { color: "#bbb" },
                    ]}>
                      {item.name}
                    </Text>
                    <View style={[
                      styles.categoryPill,
                      { backgroundColor: cfg.bg },
                    ]}>
                      <Text style={[styles.categoryPillText, { color: cfg.color }]}>
                        {item.category}
                      </Text>
                    </View>
                  </View>
                  {item.description ? (
                    <Text style={styles.itemDesc} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}
                  <Text style={styles.itemPrice}>₱{Number(item.price).toFixed(2)}</Text>
                </View>

                {/* RIGHT — actions */}
                <View style={styles.itemActions}>

                  {/* availability toggle */}
                  <Switch
                    value={item.is_available}
                    onValueChange={() => toggleAvailability(item)}
                    trackColor={{ false: "#f0f0f0", true: "#ff4d4d" }}
                    thumbColor="#fff"
                    disabled={togglingId === item.id}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />

                  {/* edit & delete */}
                  <View style={styles.itemBtns}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() =>
                        router.push({
                          pathname: "/admin/edit-item",
                          params: { id: item.id },
                        } as any)
                      }
                    >
                      <Ionicons name="pencil-outline" size={15} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => confirmDelete(item)}
                    >
                      <Ionicons name="trash-outline" size={15} color="#ef4444" />
                    </TouchableOpacity>
                  </View>

                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── FLOATING ADD BUTTON ────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/admin/add-item" as any)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

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

  // SEARCH
  searchContainer: { backgroundColor: "#fff", paddingHorizontal: 16, paddingBottom: 12 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#f5f5f5", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1a1a1a" },

  // FILTERS
  filterScroll:  { backgroundColor: "#fff", maxHeight: 56 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterTab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5, borderColor: "#e5e5e5",
    backgroundColor: "#fff",
  },
  filterText:      { fontSize: 13, fontWeight: "600", color: "#666" },
  filterBadge:     { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  filterBadgeText: { fontSize: 11, fontWeight: "700", color: "#666" },

  // ITEM CARD
  list: { flex: 1, padding: 16 },
  itemCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 18, padding: 14,
    marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  itemCardDisabled: { opacity: 0.5 },
  itemIcon: { width: 50, height: 50, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  itemInfo:   { flex: 1 },
  itemTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  itemName:   { fontSize: 15, fontWeight: "700", color: "#1a1a1a", flex: 1 },
  itemDesc:   { fontSize: 12, color: "#aaa", marginBottom: 4 },
  itemPrice:  { fontSize: 15, fontWeight: "800", color: "#ff4d4d" },
  categoryPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  categoryPillText: { fontSize: 10, fontWeight: "700", textTransform: "capitalize" },

  // ACTIONS
  itemActions: { alignItems: "center", gap: 8 },
  itemBtns:    { flexDirection: "row", gap: 6 },
  editBtn: {
    backgroundColor: "#eff6ff", borderRadius: 10,
    padding: 7, alignItems: "center", justifyContent: "center",
  },
  deleteBtn: {
    backgroundColor: "#fef2f2", borderRadius: 10,
    padding: 7, alignItems: "center", justifyContent: "center",
  },

  // EMPTY
  emptyContainer: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyText:      { color: "#ccc", fontSize: 16, fontWeight: "600" },
  emptySubText:   { color: "#ddd", fontSize: 13 },

  // FAB
  fab: {
    position: "absolute", bottom: 30, right: 24,
    backgroundColor: "#ff4d4d",
    width: 60, height: 60, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#ff4d4d", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
});