import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as MediaLibrary from "expo-media-library";
import React, { useEffect, useRef, useState } from "react";
import ViewShot from "react-native-view-shot";

import {
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

const { width, height } = Dimensions.get("window");

export default function CartScreen() {
  const {
    cart,
    total,
    removeFromCart,
    increaseQty,
    decreaseQty,
    clearCart,
    updateNote,
  } = useCart();

  // REFERENCE FOR AUTOMATIC VIEWSHOT CAPTURE
  const viewShotRef = useRef<any>(null);

  // STATE MANAGEMENT
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [placedOrderDetails, setPlacedOrderDetails] = useState<any | null>(null);

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [editableNote, setEditableNote] = useState("");

  // AUTOMATIC PERMISSION CHECK ON LAUNCH
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();

  useEffect(() => {
    if (permissionResponse && !permissionResponse.granted && permissionResponse.canAskAgain) {
      requestPermission();
    }
  }, [permissionResponse]);

  // Delete Handlers
  const handleDeletePress = (id: string, name: string) => {
    setSelectedItem({ id, name });
    setDeleteModalVisible(true);
  };

  const confirmDelete = () => {
    if (selectedItem) {
      removeFromCart(selectedItem.id);
      setDeleteModalVisible(false);
      setSelectedItem(null);
    }
  };

  // Edit Handlers
  const handleEditPress = (item: any) => {
    setSelectedItem(item);
    setEditableNote(item.note || "");
    setEditModalVisible(true);
  };

const saveEditedNote = () => {
  if (selectedItem) {
    updateNote(selectedItem.id, editableNote.trim() || undefined); // 👈 updates React state
    setEditModalVisible(false);
    setSelectedItem(null);
  }
};

  const handlePlaceOrderPress = () => {
    setSummaryModalVisible(true);
  };

  // TRUE AUTOMATIC SAVE IMAGE HANDLER (Fixed with saveToLibraryAsync)
  const captureAndSaveReceiptImage = async () => {
  try {
    // 1. Verify we have the view reference bound
    if (!viewShotRef.current) {
      return alert("Receipt layout is still rendering. Please try again in a second.");
    }

    // 2. Give Android a tiny moment to draw the canvas layout tree completely
    setTimeout(async () => {
      try {
        // Capture directly into a local native file path string
        const uri = await viewShotRef.current.capture();
        
        if (uri) {
          // Push the image directly into the Android media gallery database
          await MediaLibrary.saveToLibraryAsync(uri);
          alert("Receipt image automatically saved to your Gallery!");
        }
      } catch (captureError: any) {
        // If this still fails, it means ViewShot is wrapping something it can't measure
        alert(`Android Capture Error: ${captureError.message}`);
      }
    }, 200);

  } catch (error: any) {
    alert(`Failed to save receipt: ${error.message}`);
  }
};


 const handleFinalCheckoutConfirm = async () => {
  try {
    // 1. Get user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert("Please log in first!");
      return;
    }

    const userId = session.user.id;
    const studentFullName =
      session.user.user_metadata?.full_name || "Anonymous Student";

    // 2. Insert main order
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          user_id: userId,
          student_name: studentFullName,
          total_amount: total,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (orderError) {
      alert(`Database Orders Error: ${orderError.message}`);
      return;
    }

    // 3. Prepare order 
    //  payload
    const orderItemsPayload = cart.map((item: any) => ({
      order_id: orderData.id,
      food_id: item.id,
      food_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
      special_instructions: item.note || null,
    }));

    // 4. Insert order items
    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    if (itemsError) {
      alert(`Database Items Error: ${itemsError.message}`);
      return;
    }

    // 5. CREATE SNAPSHOT (IMPORTANT: BEFORE CLEARING CART)
    const payloadDetails = {
      id: orderData.id,
      studentName: studentFullName,
      items: [...cart], // snapshot
      totalAmount: total,
      date: new Date().toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setPlacedOrderDetails(payloadDetails);

    // 6. CLOSE SUMMARY MODAL FIRST
    setSummaryModalVisible(false);

    // 7. CLEAR CART (MAIN FIX ✔)
    clearCart();

    // 8. OPEN RECEIPT
    setReceiptModalVisible(true);

  } catch (error: any) {
    alert(`System Exception Error: ${error.message}`);
  }
};

  return (
    <LinearGradient
      colors={["#fff5f2", "#fafafa"]}
      style={styles.container}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      {/* HEADER SECTION */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Cart</Text>
          <Text style={styles.subtitle}>
            {cart.length} {cart.length === 1 ? "item" : "items"} ready for pickup
          </Text>
        </View>
      </View>

      {/* EMPTY CART STATE */}
      {cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="basket-outline" size={44} color="#ff4d4d" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Looks like you haven't added anything from the canteen menu yet.
          </Text>
        </View>
      ) : (
        <>
          {/* CART ITEMS LIST */}
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollList}
          >
            {cart.map((item: any) => (
              <View key={item.id} style={styles.card}>
                <Image source={{ uri: item.image }} style={styles.image} />

                <View style={styles.cardDetails}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  
               <Text style={styles.price}>₱{item.price * item.quantity}</Text>

                  {/* SPECIAL INSTRUCTIONS UI DISPLAY */}
                  {item.note && (
                    <View style={styles.noteBadge}>
                      <Ionicons name="document-text-outline" size={12} color="#6b7280" />
                      <Text style={styles.noteText} numberOfLines={2}>
                        "{item.note}"
                      </Text>
                    </View>
                  )}

                  {/* QUANTITY CHANGER */}
                  <View style={styles.qtyContainer}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => decreaseQty(item.id)}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="remove" size={13} color="#1f2937" />
                    </TouchableOpacity>

                    <Text style={styles.qtyText}>{item.quantity}</Text>

                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => increaseQty(item.id)}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="add" size={13} color="#1f2937" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ACTION BUTTON GROUP ROW */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.editActionBtn}
                    onPress={() => handleEditPress(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={18} color="#4b5563" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteActionBtn}
                    onPress={() => handleDeletePress(item.id, item.name)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ff4d4d" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* TOTAL & BOTTOM CHECKOUT BLOCK */}
          <View style={styles.bottomCard}>
            <View style={styles.totalBlock}>
              <Text style={styles.totalLabel}>Total Payment</Text>
              <Text style={styles.totalValue}>₱{total}</Text>
            </View>

            <TouchableOpacity 
              style={styles.checkoutBtn} 
              activeOpacity={0.85}
              onPress={handlePlaceOrderPress}
            >
              <Text style={styles.checkoutText}>Place Order</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* CUSTOM CONFIRMATION DELETE MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.customModalContent}>
            <View style={styles.warningIconCircle}>
              <Ionicons name="trash" size={32} color="#ff4d4d" />
            </View>
            
            <Text style={styles.customModalTitle}>Remove Item?</Text>
            <Text style={styles.customModalSubtitle}>
              Are you sure you want to remove <Text style={styles.boldItemName}>"{selectedItem?.name}"</Text> from your cart?
            </Text>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelModalBtn]} 
                onPress={() => setDeleteModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtn, styles.deleteModalBtn]} 
                onPress={confirmDelete}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CUSTOM EDIT NOTE MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.customModalContent}>
            <View style={styles.editIconCircle}>
              <Ionicons name="document-text" size={30} color="#3b82f6" />
            </View>
            
            <Text style={styles.customModalTitle}>Special Instructions</Text>
            <Text style={styles.editItemNameLabel}>{selectedItem?.name}</Text>
            
            <TextInput
              style={styles.noteTextInput}
              placeholder="Example: No onions, extra spicy, etc..."
              placeholderTextColor="#9ca3af"
              value={editableNote}
              onChangeText={setEditableNote}
              maxLength={120}
              multiline={true}
              textAlignVertical="top"
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelModalBtn]} 
                onPress={() => setEditModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Discard</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtn, styles.saveModalBtn]} 
                onPress={saveEditedNote}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ORDER SUMMARY MODAL (SLIDE-UP DESIGN) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={summaryModalVisible}
        onRequestClose={() => setSummaryModalVisible(false)}
      >
        <View style={styles.bottomSheetOverlay}>
          <View style={styles.summarySheetContent}>
            <View style={styles.dragIndicator} />
            
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Order Summary</Text>
              <TouchableOpacity 
                style={styles.closeSummaryBtn}
                onPress={() => setSummaryModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false} 
              style={styles.summaryScroll}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <Text style={styles.summarySectionLabel}>Items Review</Text>
              
              {cart.map((item: any) => (
                <View key={item.id} style={styles.summaryRowItem}>
                  <View style={styles.summaryItemInfo}>
                    <Text style={styles.summaryItemQty}>{item.quantity}x</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.summaryItemName} numberOfLines={1}>{item.name}</Text>
                      {item.note && (
                        <Text style={styles.summaryItemNote} numberOfLines={1}>
                          ✍️ {item.note}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.summaryItemPrice}>₱{item.price * item.quantity}</Text>
                </View>
              ))}

              <View style={styles.summaryDivider} />

              {/* PAYMENT DETAILS */}
              <View style={styles.billingRow}>
                <Text style={styles.billingLabel}>Subtotal</Text>
                <Text style={styles.billingValue}>₱{total}</Text>
              </View>
              <View style={styles.billingRow}>
                <Text style={styles.billingLabel}>Canteen Service Fee</Text>
                <Text style={styles.billingValue}>₱0</Text>
              </View>

              <View style={[styles.billingRow, { marginTop: 10 }]}>
                <Text style={styles.billingTotalLabel}>Total Amount</Text>
                <Text style={styles.billingTotalValue}>₱{total}</Text>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.finalConfirmBtn}
              onPress={handleFinalCheckoutConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.finalConfirmText}>Confirm & Pay ₱{total}</Text>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CLEAN MINIMAL STUB RECEIPT MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={receiptModalVisible}
        onRequestClose={() => setReceiptModalVisible(false)}
      >
        <View style={styles.receiptOverlay}>
          
          {/* VIEWSHOT CONTAINER */}
          <ViewShot 
            ref={viewShotRef} 
            options={{ format: "png", quality: 1.0 }}
            style={styles.receiptPaper}
          >
            <View style={styles.successCheckCircle}>
              <Ionicons name="checkmark" size={28} color="#fff" />
            </View>

            <Text style={styles.receiptMainTitle}>Order Confirmed!</Text>
            <Text style={styles.receiptMessage}>Present this stub to the canteen counter</Text>

            <View style={styles.receiptDashedDivider} />

            {/* METADATA INFO */}
            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMetaLabel}>Order ID:</Text>
              <Text style={styles.receiptMetaValue}>
                #{placedOrderDetails?.id?.slice(0, 8).toUpperCase()}
              </Text>
            </View>
            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMetaLabel}>Customer:</Text>
              <Text style={styles.receiptMetaValue}>{placedOrderDetails?.studentName}</Text>
            </View>
            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMetaLabel}>Date:</Text>
              <Text style={styles.receiptMetaValue}>{placedOrderDetails?.date}</Text>
            </View>

            <View style={styles.receiptDashedDivider} />

           {/* ORDER ITEMS BREAKDOWN */}
<Text style={styles.receiptSectionHeader}>Items Ordered</Text>
<ScrollView style={styles.receiptItemsScroll} showsVerticalScrollIndicator={false}>
  {placedOrderDetails?.items.map((item: any, index: number) => (
    <View key={item.id} style={styles.receiptItemBlock}>
      {/* item row */}
      <View style={styles.receiptItemLine}>
        <Text style={styles.receiptItemQtyName}>
          {item.quantity}x{" "}
          <Text style={{ fontWeight: "500", color: "#374151" }}>
            {item.name}
          </Text>
        </Text>
        <Text style={styles.receiptItemPrice}>
          ₱{(item.price * item.quantity).toFixed(2)}
        </Text>
      </View>

      {/* special instructions — only show if exists */}
      {(item.note || item.special_instructions) ? (
        <View style={styles.receiptNoteRow}>
          <Ionicons name="document-text-outline" size={11} color="#9ca3af" />
          <Text style={styles.receiptNoteText}>
            {item.note || item.special_instructions}
          </Text>
        </View>
      ) : null}

      {/* divider between items except last */}
      {index < (placedOrderDetails?.items.length ?? 0) - 1 && (
        <View style={styles.receiptItemDivider} />
      )}
    </View>
  ))}
</ScrollView>

            <View style={styles.receiptDashedDivider} />

            {/* TOTAL AMOUNT DUE */}
            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>Total Amount</Text>
              <Text style={styles.receiptTotalValue}>₱{placedOrderDetails?.totalAmount.toFixed(2)}</Text>
            </View>
          </ViewShot>

          {/* ACTION BUTTON GROUP ROW (Outside ViewShot wrapper) */}
          <View style={styles.receiptActionColumn}>
            <TouchableOpacity 
              style={styles.receiptDownloadBtn}
              activeOpacity={0.85}
              onPress={captureAndSaveReceiptImage}
            >
              <Ionicons name="cloud-download-outline" size={18} color="#fff" />
              <Text style={styles.receiptDownloadText}>Download Receipt</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.receiptCloseBtn}
              onPress={() => setReceiptModalVisible(false)}
            >
              <Text style={styles.receiptCloseText}>Close Screen</Text>
            </TouchableOpacity>
          </View>

        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 65,
    marginBottom: 16,
    backgroundColor: "transparent",
  },
  title: { fontSize: 28, fontWeight: "800", color: "#111827", letterSpacing: -0.6 },
  subtitle: { fontSize: 13, color: "#9ca3af", marginTop: 2, fontWeight: "600" },
  scrollList: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  image: { width: 86, height: 86, borderRadius: 16, backgroundColor: "#f3f4f6" },
  cardDetails: { flex: 1, paddingLeft: 14, justifyContent: "center" },
  name: { fontSize: 16, fontWeight: "700", color: "#1f2937", marginBottom: 3 },
  price: { color: "#ff4d4d", fontWeight: "900", fontSize: 15, marginBottom: 4 },
  noteBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    marginBottom: 8,
    alignSelf: "flex-start",
    maxWidth: width * 0.40,
  },
  noteText: { fontSize: 11, color: "#6b7280", fontStyle: "italic", fontWeight: "500" },
  qtyContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    alignSelf: "flex-start",
    borderRadius: 20,
    padding: 3,
    gap: 12,
  },
  qtyBtn: {
    backgroundColor: "#fff",
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  qtyText: { fontWeight: "700", fontSize: 13, color: "#1f2937", minWidth: 16, textAlign: "center" },
  actionRow: { flexDirection: "row", alignItems: "center", marginLeft: 6, gap: 8 },
  editActionBtn: {
    backgroundColor: "#f3f4f6",
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  deleteActionBtn: {
    backgroundColor: "#fff1f1",
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 77, 0.1)",
  },
  bottomCard: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 34,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(241, 245, 249, 0.8)",
  },
  totalBlock: { flexDirection: "column" },
  totalLabel: { color: "#9ca3af", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  totalValue: { fontSize: 26, fontWeight: "900", color: "#ff4d4d", marginTop: 1 },
  checkoutBtn: {
    backgroundColor: "#ff4d4d",
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#ff4d4d",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  checkoutText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40, marginBottom: 60 },
  emptyIconCircle: { width: 84, height: 84, borderRadius: 28, backgroundColor: "#fff1f1", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: "#9ca3af", textAlign: "center", lineHeight: 19 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.5)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  customModalContent: { backgroundColor: "#fff", borderRadius: 28, padding: 24, width: "100%", alignItems: "center", shadowColor: "#0f172a", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  warningIconCircle: { width: 64, height: 64, borderRadius: 22, backgroundColor: "#fff1f1", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  editIconCircle: { width: 64, height: 64, borderRadius: 22, backgroundColor: "#eff6ff", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  customModalTitle: { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 4 },
  editItemNameLabel: { fontSize: 14, color: "#6b7280", fontWeight: "600", marginBottom: 16 },
  customModalSubtitle: { fontSize: 14, color: "#4b5563", textAlign: "center", lineHeight: 20, marginBottom: 24, paddingHorizontal: 8 },
  boldItemName: { fontWeight: "700", color: "#1f2937" },
  noteTextInput: { width: "100%", backgroundColor: "#f8fafc", borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", padding: 14, fontSize: 14, color: "#1f2937", height: 80, marginBottom: 20 },
  modalButtonRow: { flexDirection: "row", gap: 12, width: "100%" },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cancelModalBtn: { backgroundColor: "#f3f4f6" },
  deleteModalBtn: { backgroundColor: "#ff4d4d", shadowColor: "#ff4d4d", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 2 },
  saveModalBtn: { backgroundColor: "#ff4d4d", shadowColor: "#ff4d4d", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 2 },
  cancelBtnText: { color: "#4b5563", fontSize: 15, fontWeight: "700" },
  deleteBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  bottomSheetOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.6)", justifyContent: "flex-end" },
  summarySheetContent: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: height * 0.80, paddingHorizontal: 24, paddingBottom: 34 },
  dragIndicator: { width: 42, height: 5, backgroundColor: "#e5e7eb", borderRadius: 4, alignSelf: "center", marginTop: 12, marginBottom: 16 },
  summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  summaryTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  closeSummaryBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  summaryScroll: { flexGrow: 0, marginBottom: 16 },
  summarySectionLabel: { fontSize: 12, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  summaryRowItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderColor: "#f8fafc" },
  summaryItemInfo: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 16, gap: 10 },
  summaryItemQty: { fontSize: 14, fontWeight: "700", color: "#ff4d4d", backgroundColor: "#fff1f1", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  summaryItemName: { fontSize: 15, fontWeight: "600", color: "#374151" },
  summaryItemNote: { fontSize: 12, color: "#6b7280", fontStyle: "italic", marginTop: 1 },
  summaryItemPrice: { fontSize: 15, fontWeight: "700", color: "#1f2937" },
  summaryDivider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 16, borderStyle: "dashed" },
  billingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  billingLabel: { fontSize: 14, color: "#6b7280", fontWeight: "500" },
  billingValue: { fontSize: 14, color: "#1f2937", fontWeight: "600" },
  billingTotalLabel: { fontSize: 16, fontWeight: "800", color: "#111827" },
  billingTotalValue: { fontSize: 20, fontWeight: "900", color: "#ff4d4d" },
  finalConfirmBtn: { backgroundColor: "#ff4d4d", paddingVertical: 16, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#ff4d4d", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  finalConfirmText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  receiptOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  receiptPaper: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  successCheckCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  receiptMainTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  receiptMessage: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 4,
  },
  receiptDashedDivider: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
    marginVertical: 16,
    borderRadius: 1,
  },
  receiptMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 6,
  },
  receiptMetaLabel: {
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: "500",
  },
  receiptMetaValue: {
    fontSize: 13,
    color: "#1f2937",
    fontWeight: "700",
  },
  receiptSectionHeader: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  receiptItemsScroll: {
    width: "100%",
    maxHeight: 140,
  },
  receiptItemLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 5,
  },
  receiptItemQtyName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ff4d4d",
    flex: 1,
    marginRight: 10,
  },
  receiptItemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  receiptTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    alignItems: "center",
    marginBottom: 8,
  },
  receiptTotalLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  receiptTotalValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ff4d4d",
  },
  receiptActionColumn: {
    width: "100%",
    maxWidth: 340,
    marginTop: 16,
    gap: 8,
  },
  receiptDownloadBtn: {
    backgroundColor: "#ff4d4d",
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#ff4d4d",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  receiptDownloadText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  receiptCloseBtn: { width: "100%", paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  receiptCloseText: { color: "#dfdfdf", fontSize: 13, fontWeight: "600" },
  // inside your existing styles
receiptItemBlock: {
  width: "100%",
  paddingVertical: 4,
},
receiptNoteRow: {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 5,
  marginTop: 3,
  marginBottom: 4,
  paddingLeft: 4,
},
receiptNoteText: {
  fontSize: 11,
  color: "#9ca3af",
  fontStyle: "italic",
  flex: 1,
  lineHeight: 15,
},
receiptItemDivider: {
  height: 1,
  backgroundColor: "#f5f5f5",
  marginVertical: 4,
},
});