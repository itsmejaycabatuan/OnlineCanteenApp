// app/category/[name].tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
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

export default function CategoryScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const { addToCart } = useCart();

  const [items, setItems]               = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [quantity, setQuantity]         = useState(1);
  const [note, setNote]                 = useState("");

  useEffect(() => {
    if (name) fetchCategoryItems();
  }, [name]);

  const fetchCategoryItems = async () => {
    setLoading(true);

    // ← KEY FIX: normalize both sides to lowercase
    const { data, error } = await supabase
      .from("foods")
      .select("*")
      .ilike("category", name as string)  // ilike = case-insensitive match
      .eq("is_available", true);           // only show available items

    if (error) {
      console.log("Fetch error:", error.message);
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  };

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
        quantity,
        note: note.trim() || undefined,
      });
      setModalVisible(false);
      setSelectedItem(null);
    }
  };

  // ── helper: get image uri safely ──────────────────────────────────────────
  // handles both "image" and "image_url" column names
  const getImageUri = (item: any): string | null => {
    return item?.image_url || item?.image || null;
  };

  const displayName = typeof name === "string"
    ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
    : "";

  return (
    <LinearGradient
      colors={["#fff5f2", "#fafafa"]}
      style={styles.container}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>{displayName}</Text>
          <Text style={styles.headerSubtitle}>Fresh Choices</Text>
        </View>

        <View style={styles.headerRightSpacer} />
      </View>

      {/* CONTENT */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ff4d4d" />
          <Text style={styles.loadingText}>Curating menu...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconWrapper}>
            <Ionicons name="fast-food-outline" size={42} color="#ff4d4d" />
          </View>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyText}>
            We are currently updating our {displayName} catalog.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollList}
        >
          <View style={styles.gridRow}>
            {items.map((item) => {
              const imageUri = getImageUri(item);
              return (
                <View key={item.id} style={styles.itemCard}>

                  {/* IMAGE */}
                  <View style={styles.imageWrapper}>
                    {imageUri ? (
                      <Image
                        source={{ uri: imageUri }}
                        style={styles.itemImage}
                      />
                    ) : (
                      // fallback if no image
                      <View style={styles.imageFallback}>
                        <Ionicons name="fast-food-outline" size={36} color="#ff4d4d" />
                      </View>
                    )}
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={10} color="#ffb300" />
                      <Text style={styles.ratingText}>4.8</Text>
                    </View>
                  </View>

                  {/* DETAILS */}
                  <View style={styles.cardInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemDescription} numberOfLines={1}>
                      Freshly prepared premium item
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

                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ADD TO CART MODAL */}
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
                {/* ITEM PREVIEW */}
                <View style={styles.previewContainer}>
                  {getImageUri(selectedItem) ? (
                    <Image
                      source={{ uri: getImageUri(selectedItem)! }}
                      style={styles.previewImage}
                    />
                  ) : (
                    <View style={[styles.previewImage, styles.imageFallback]}>
                      <Ionicons name="fast-food-outline" size={28} color="#ff4d4d" />
                    </View>
                  )}
                  <View style={styles.previewDetails}>
                    <Text style={styles.previewName}>{selectedItem.name}</Text>
                    <Text style={styles.previewPrice}>₱{selectedItem.price}</Text>
                  </View>
                </View>

                {/* QUANTITY */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>Select Quantity</Text>
                  <View style={styles.counterGroup}>
                    <TouchableOpacity
                      style={[styles.counterBtn, quantity <= 1 && styles.counterBtnDisabled]}
                      disabled={quantity <= 1}
                      onPress={() => setQuantity(prev => prev - 1)}
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
                      onPress={() => setQuantity(prev => prev + 1)}
                    >
                      <Ionicons name="add" size={18} color="#1f2937" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* SPECIAL INSTRUCTIONS */}
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

                {/* CONFIRM */}
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
  container: { flex: 1 },

  // HEADER
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    backgroundColor: "transparent",
    borderBottomWidth: 1, borderColor: "rgba(239, 241, 245, 0.6)",
  },
  backBtn: {
    backgroundColor: "#fff", width: 42, height: 42, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "#e5e7eb",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  titleContainer:    { alignItems: "center" },
  headerTitle:       { fontSize: 19, fontWeight: "800", color: "#111827", letterSpacing: -0.3 },
  headerSubtitle:    { fontSize: 11, color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 1 },
  headerRightSpacer: { width: 42 },

  // CENTER
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  loadingText:     { marginTop: 12, color: "#6b7280", fontSize: 14, fontWeight: "500" },
  emptyIconWrapper:{ width: 80, height: 80, borderRadius: 24, backgroundColor: "#fff1f1", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle:      { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 6 },
  emptyText:       { color: "#9ca3af", fontSize: 13, textAlign: "center", lineHeight: 18 },

  // GRID
  scrollList: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  gridRow:    { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 18 },

  // CARD
  itemCard: {
    backgroundColor: "#fff", borderRadius: 24, width: CARD_WIDTH,
    overflow: "hidden", borderWidth: 1, borderColor: "#f1f5f9",
    shadowColor: "#0f172a", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04, shadowRadius: 12, elevation: 3,
  },
  imageWrapper:  { width: "100%", height: 130, position: "relative", backgroundColor: "#f3f4f6" },
  itemImage:     { width: "100%", height: "100%", resizeMode: "cover" },
  imageFallback: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center", backgroundColor: "#fff5f5" },
  ratingBadge: {
    position: "absolute", bottom: 8, left: 8,
    backgroundColor: "rgba(17, 24, 39, 0.75)",
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  ratingText:       { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardInfo:         { padding: 12 },
  itemName:         { fontSize: 15, fontWeight: "700", color: "#1f2937", marginBottom: 2 },
  itemDescription:  { fontSize: 11, color: "#9ca3af", marginBottom: 12 },
  itemFooter:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemPrice:        { fontSize: 17, fontWeight: "900", color: "#ff4d4d" },
  addBtn: {
    backgroundColor: "#ff4d4d", width: 32, height: 32, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#ff4d4d", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 3,
  },

  // MODAL
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