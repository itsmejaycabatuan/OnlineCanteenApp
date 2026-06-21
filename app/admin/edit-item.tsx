// app/admin/edit-item.tsx
import { Ionicons } from "@expo/vector-icons";
import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

const CATEGORIES = ["meals", "drinks", "snacks", "desserts"];

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  meals:    { icon: "fast-food-outline", color: "#ff4d4d", bg: "#fff5f5" },
  drinks:   { icon: "cafe-outline",      color: "#3b82f6", bg: "#eff6ff" },
  snacks:   { icon: "pizza-outline",     color: "#f59e0b", bg: "#fffbeb" },
  desserts: { icon: "ice-cream-outline", color: "#8b5cf6", bg: "#f5f3ff" },
};

export default function EditItem() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [name, setName]               = useState("");
  const [price, setPrice]             = useState("");
  const [category, setCategory]       = useState("meals");
  const [isAvailable, setIsAvailable] = useState(true);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState("");

  // image states
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null); // from DB
  const [newImageUri, setNewImageUri]           = useState<string | null>(null); // newly picked
  const [newImageBase64, setNewImageBase64]     = useState<string | null>(null);
  const [newImageMime, setNewImageMime]         = useState("image/jpeg");
  const [imageRemoved, setImageRemoved]         = useState(false); // user removed existing

  // ── fetch item ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchItem = async () => {
      const { data, error } = await supabase
        .from("foods")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        Alert.alert("Error", "Item not found.");
        router.back();
        return;
      }

      setName(data.name);
      setExistingImageUrl(data.image ?? null); // ← adjust column name if needed
      setPrice(String(data.price));
      setCategory(data.category?.toLowerCase() ?? "meals");
      setIsAvailable(data.is_available ?? true);
      setLoading(false);
    };

    if (id) fetchItem();
  }, [id]);

  // ── pick new image from gallery ────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to upload images."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setNewImageUri(asset.uri);
      setNewImageBase64(asset.base64 ?? null);
      setNewImageMime(asset.mimeType ?? "image/jpeg");
      setImageRemoved(false); // if they pick new, not removed
    }
  };

  // ── remove image ───────────────────────────────────────────────────────────
  const removeImage = () => {
    setNewImageUri(null);
    setNewImageBase64(null);
    setExistingImageUrl(null);
    setImageRemoved(true);
  };

  // ── upload new image to Supabase Storage ───────────────────────────────────
  const uploadImage = async (): Promise<string | null> => {
    if (!newImageBase64) return null;

    try {
      setUploadProgress("Uploading image…");
      const ext      = newImageMime.split("/")[1] ?? "jpg";
      const fileName = `food_${Date.now()}.${ext}`;
      const filePath = `foods/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("food-images")
        .upload(filePath, decode(newImageBase64), {
          contentType: newImageMime,
          upsert: false,
        });

      if (uploadError) {
        Alert.alert("Upload Failed", uploadError.message);
        return null;
      }

      const { data } = supabase.storage
        .from("food-images")
        .getPublicUrl(filePath);

      setUploadProgress("");
      return data.publicUrl;
    } catch (e: any) {
      console.error(e);
      setUploadProgress("");
      return null;
    }
  };

  // ── validate ───────────────────────────────────────────────────────────────
  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim())  newErrors.name  = "Name is required";
    if (!price.trim()) newErrors.price = "Price is required";
    if (isNaN(Number(price)) || Number(price) <= 0)
      newErrors.price = "Enter a valid price";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      let finalImageUrl: string | null = existingImageUrl;

      // if user picked a new image → upload it
      if (newImageUri && newImageBase64) {
        const uploaded = await uploadImage();
        if (!uploaded) {
          setSaving(false);
          return;
        }
        finalImageUrl = uploaded;
      }

      // if user removed the image → set null
      if (imageRemoved && !newImageUri) {
        finalImageUrl = null;
      }

      const { error } = await supabase
        .from("foods")
        .update({
          name:         name.trim(),
          image:        finalImageUrl,  // ← adjust column name if needed
          price:        Number(price),
          category,
          is_available: isAvailable,
        })
        .eq("id", id);

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      Alert.alert("Updated! ✅", `"${name}" has been updated.`, [
        { text: "OK", onPress: () => router.back() },
      ]);

    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Something went wrong");
    } finally {
      setSaving(false);
      setUploadProgress("");
    }
  };

  // ── current display image ──────────────────────────────────────────────────
  // priority: new picked → existing from DB → null
  const displayImageUri = newImageUri ?? existingImageUrl ?? null;

  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.meals;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4d4d" />
        <Text style={styles.loadingText}>Loading item…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Item</Text>
          <View style={{ width: 30 }} />
        </View>

        <View style={styles.body}>

          {/* PREVIEW CARD */}
          <View style={styles.previewCard}>
            <View style={[styles.previewImageBox, { backgroundColor: cfg.bg }]}>
              {displayImageUri ? (
                <Image source={{ uri: displayImageUri }} style={styles.previewImage} />
              ) : (
                <Ionicons name={cfg.icon as any} size={32} color={cfg.color} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewName} numberOfLines={1}>
                {name || "Item Name"}
              </Text>
              <Text style={styles.previewPrice}>
                ₱{price ? Number(price).toFixed(2) : "0.00"}
              </Text>
            </View>
            <View style={[
              styles.previewBadge,
              { backgroundColor: isAvailable ? "#f0fdf4" : "#fef2f2" },
            ]}>
              <View style={[
                styles.previewDot,
                { backgroundColor: isAvailable ? "#10b981" : "#ef4444" },
              ]} />
              <Text style={[
                styles.previewBadgeText,
                { color: isAvailable ? "#10b981" : "#ef4444" },
              ]}>
                {isAvailable ? "Available" : "Unavailable"}
              </Text>
            </View>
          </View>

          {/* IMAGE PICKER */}
          <Text style={styles.label}>
            Food Image <Text style={styles.optional}>(optional)</Text>
          </Text>

          {displayImageUri ? (
            // ── image exists (existing or newly picked) ──
            <View style={styles.imageSelectedContainer}>
              <Image
                source={{ uri: displayImageUri }}
                style={styles.imageSelected}
              />

              {/* source badge */}
              <View style={styles.imageBadge}>
                <Ionicons
                  name={newImageUri ? "cloud-upload-outline" : "cloud-done-outline"}
                  size={12} color="#fff"
                />
                <Text style={styles.imageBadgeText}>
                  {newImageUri ? "New image selected" : "Current image"}
                </Text>
              </View>

              {/* actions overlay */}
              <View style={styles.imageSelectedOverlay}>
                <TouchableOpacity
                  style={styles.imageActionBtn}
                  onPress={pickImage}
                >
                  <Ionicons name="pencil-outline" size={18} color="#fff" />
                  <Text style={styles.imageActionText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.imageActionBtn, styles.imageRemoveBtn]}
                  onPress={removeImage}
                >
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={styles.imageActionText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // ── no image ──
            <TouchableOpacity
              style={styles.imagePickerBtn}
              onPress={pickImage}
              activeOpacity={0.8}
            >
              <View style={styles.imagePickerInner}>
                <View style={styles.imagePickerIconCircle}>
                  <Ionicons name="image-outline" size={32} color="#ff4d4d" />
                </View>
                <Text style={styles.imagePickerTitle}>Browse Gallery</Text>
                <Text style={styles.imagePickerSub}>
                  Tap to select an image from your photo library
                </Text>
                <View style={styles.imagePickerFormats}>
                  {["JPG", "PNG", "JPEG"].map(f => (
                    <View key={f} style={styles.formatPill}>
                      <Text style={styles.formatPillText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* NAME */}
          <Text style={[styles.label, { marginTop: 20 }]}>
            Item Name <Text style={styles.required}>*</Text>
          </Text>
          <View style={[styles.inputWrapper, errors.name && styles.inputError]}>
            <Ionicons name="fast-food-outline" size={18} color="#aaa" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Chicken Meal"
              placeholderTextColor="#ccc"
              value={name}
              onChangeText={v => { setName(v); setErrors(p => ({ ...p, name: "" })); }}
            />
          </View>
          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

          {/* PRICE */}
          <Text style={styles.label}>
            Price <Text style={styles.required}>*</Text>
          </Text>
          <View style={[styles.inputWrapper, errors.price && styles.inputError]}>
            <Text style={styles.pesoSign}>₱</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#ccc"
              value={price}
              onChangeText={v => { setPrice(v); setErrors(p => ({ ...p, price: "" })); }}
              keyboardType="decimal-pad"
            />
          </View>
          {errors.price ? <Text style={styles.errorText}>{errors.price}</Text> : null}

          {/* CATEGORY */}
          <Text style={styles.label}>
            Category <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(cat => {
              const catCfg     = CATEGORY_CONFIG[cat];
              const isSelected = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryBtn,
                    isSelected && {
                      backgroundColor: catCfg.bg,
                      borderColor: catCfg.color,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Ionicons
                    name={catCfg.icon as any}
                    size={22}
                    color={isSelected ? catCfg.color : "#bbb"}
                  />
                  <Text style={[
                    styles.categoryBtnText,
                    isSelected && { color: catCfg.color, fontWeight: "700" },
                  ]}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={14} color={catCfg.color} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* AVAILABILITY */}
          <Text style={styles.label}>Availability</Text>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>
                {isAvailable ? "Available" : "Unavailable"}
              </Text>
              <Text style={styles.toggleSub}>
                {isAvailable
                  ? "Students can order this item"
                  : "Item is hidden from students"}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                { backgroundColor: isAvailable ? "#ff4d4d" : "#e5e5e5" },
              ]}
              onPress={() => setIsAvailable(!isAvailable)}
            >
              <View style={[
                styles.toggleThumb,
                { transform: [{ translateX: isAvailable ? 22 : 2 }] },
              ]} />
            </TouchableOpacity>
          </View>

          {/* SAVE */}
          <TouchableOpacity
            style={[styles.submitBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <View style={styles.submitRow}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.submitBtnText}>
                  {uploadProgress || "Saving…"}
                </Text>
              </View>
            ) : (
              <View style={styles.submitRow}>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Save Changes</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
  body:        { padding: 20 },

  // PREVIEW
  previewCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  previewImageBox: {
    width: 56, height: 56, borderRadius: 16,
    justifyContent: "center", alignItems: "center", overflow: "hidden",
  },
  previewImage:     { width: 56, height: 56, borderRadius: 16 },
  previewName:      { fontSize: 16, fontWeight: "800", color: "#1a1a1a" },
  previewPrice:     { fontSize: 14, fontWeight: "700", color: "#ff4d4d", marginTop: 2 },
  previewBadge:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  previewDot:       { width: 7, height: 7, borderRadius: 4 },
  previewBadgeText: { fontSize: 11, fontWeight: "700" },

  // FORM
  label:    { fontSize: 13, fontWeight: "700", color: "#444", marginBottom: 8, marginTop: 4 },
  required: { color: "#ff4d4d" },
  optional: { color: "#bbb", fontWeight: "400" },

  // IMAGE PICKER (no image)
  imagePickerBtn: {
    borderWidth: 2, borderColor: "#ff4d4d",
    borderStyle: "dashed", borderRadius: 20,
    overflow: "hidden", marginBottom: 4,
  },
  imagePickerInner: {
    padding: 28, alignItems: "center", gap: 8,
    backgroundColor: "#fff5f5",
  },
  imagePickerIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#ff4d4d", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
    marginBottom: 4,
  },
  imagePickerTitle: { fontSize: 16, fontWeight: "800", color: "#1a1a1a" },
  imagePickerSub:   { fontSize: 13, color: "#aaa", textAlign: "center", lineHeight: 18 },
  imagePickerFormats: { flexDirection: "row", gap: 8, marginTop: 4 },
  formatPill: {
    backgroundColor: "#fff", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: "#fecaca",
  },
  formatPillText: { fontSize: 11, fontWeight: "700", color: "#ff4d4d" },

  // IMAGE SELECTED
  imageSelectedContainer: {
    borderRadius: 20, overflow: "hidden",
    height: 200, marginBottom: 4,
    position: "relative",
  },
  imageSelected: { width: "100%", height: "100%", resizeMode: "cover" },
  imageBadge: {
    position: "absolute", top: 10, left: 10,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  imageBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  imageSelectedOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", gap: 10, padding: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  imageActionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  imageRemoveBtn:  { backgroundColor: "rgba(239,68,68,0.4)" },
  imageActionText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // INPUTS
  inputWrapper: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6,
    borderWidth: 1.5, borderColor: "#f0f0f0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  inputError:  { borderColor: "#ff4d4d" },
  inputIcon:   { marginRight: 10 },
  input:       { flex: 1, fontSize: 14, color: "#1a1a1a" },
  pesoSign:    { fontSize: 16, fontWeight: "700", color: "#ff4d4d", marginRight: 8 },
  errorText:   { fontSize: 12, color: "#ff4d4d", marginBottom: 10, marginLeft: 4 },

  // CATEGORY
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  categoryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: "#f0f0f0", width: "47%",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  categoryBtnText: { fontSize: 13, color: "#bbb", fontWeight: "500", flex: 1 },

  // TOGGLE
  toggleRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 24,
    borderWidth: 1.5, borderColor: "#f0f0f0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  toggleTitle: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  toggleSub:   { fontSize: 12, color: "#999", marginTop: 2 },
  toggleBtn:   { width: 48, height: 26, borderRadius: 13, justifyContent: "center" },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },

  // SUBMIT
  submitBtn: {
    backgroundColor: "#ff4d4d", borderRadius: 16, paddingVertical: 16,
    shadowColor: "#ff4d4d", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  submitRow:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});