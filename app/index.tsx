import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      
      <Image
        source={require("../assets/images/logo2.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.title}>Welcome to Online Canteen</Text>
      <Text style={styles.subtitle}>
        Fast, simple, and convenient food ordering for students
      </Text>

      {/* 🔥 FEATURE ICONS */}
      <View style={styles.iconRow}>

        <View style={styles.iconBox}>
          <Ionicons name="fast-food-outline" size={28} color="#ff4d4d" />
          <Text style={styles.iconText}>Food</Text>
        </View>

        <View style={styles.iconBox}>
          <Ionicons name="time-outline" size={28} color="#ff4d4d" />
          <Text style={styles.iconText}>Fast</Text>
        </View>

        <View style={styles.iconBox}>
          <Ionicons name="rocket-outline" size={28} color="#ff4d4d" />
          <Text style={styles.iconText}>Efficient</Text>
        </View>

      </View>

      {/* ORDER BUTTON */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/login")}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 20,
  },

  logo: {
    width: 500,
    height: 180,
    marginBottom: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
  },

  subtitle: {
    fontSize: 14,
    color: "gray",
    marginBottom: 25,
    marginTop: 10,
    textAlign: "center",
  },

  iconRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "90%",
    marginBottom: 30,
  },

  iconBox: {
    alignItems: "center",
    flex: 1,
  },

  iconText: {
    marginTop: 5,
    fontSize: 12,
    color: "#333",
  },

  button: {
    backgroundColor: "#ff4d4d",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});