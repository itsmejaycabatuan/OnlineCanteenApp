import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      
      {/* Logo */}
      <Image
        source={require("../../assets/images/logo.png")} 
        style={styles.logo}
        resizeMode="contain"
      />

      {/* App Title */}
      <Text style={styles.title}>Online Canteen</Text>
      <Text style={styles.subtitle}>Order your favorite meals easily</Text>

      {/* Order Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("Menu")}
      >
        <Text style={styles.buttonText}>Order Now</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  logo: {
    width: 180,
    height: 180,
    marginBottom: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1e1e1e",
  },

  subtitle: {
    fontSize: 14,
    color: "gray",
    marginBottom: 40,
    marginTop: 5,
    textAlign: "center",
  },

  button: {
    backgroundColor: "#ff4d4d",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    elevation: 5,
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});