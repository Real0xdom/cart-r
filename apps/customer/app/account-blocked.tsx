import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";

const SUPPORT_EMAIL = "support@cart-r.com";

const CustomerAccountBlocked = () => {
  const { user, profile } = useAuth();
  const customerAppEnabled = (profile as { customer_app_enabled?: boolean } | null)?.customer_app_enabled;

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  if (profile && customerAppEnabled !== false) {
    return <Redirect href="/" />;
  }

  const onRequestAppeal = async () => {
    const subject = encodeURIComponent("Customer account appeal");
    const body = encodeURIComponent(
      "Hello Cartr Support,%0D%0A%0D%0AI would like to appeal my customer account suspension.%0D%0A%0D%0APhone number:%0D%0AReason:%0D%0A"
    );
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    try {
      const supported = await Linking.canOpenURL(mailtoUrl);
      if (!supported) {
        Alert.alert("Email app not available", `Please email ${SUPPORT_EMAIL} to request an appeal.`);
        return;
      }

      await Linking.openURL(mailtoUrl);
    } catch (error) {
      Alert.alert("Unable to open email", `Please email ${SUPPORT_EMAIL} to request an appeal.`);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="lock-outline" size={42} color="#7A1F1F" />
        </View>

        <Text style={styles.title}>Customer account locked</Text>
        <Text style={styles.body}>
          You've been banned from the customer app. If you believe this was a mistake, you can request an appeal with Cartr support.
        </Text>

        <Pressable onPress={onRequestAppeal} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Request appeal</Text>
        </Pressable>

        <Pressable onPress={() => router.replace("/sign-in")} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Back to login</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(17, 24, 39, 0.7)",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    padding: 24,
    backgroundColor: "#FFFDF8",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  iconWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDE8E8",
    alignSelf: "center",
    marginBottom: 18,
  },
  title: {
    fontFamily: "Jakarta-Bold",
    fontSize: 24,
    color: "#111827",
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontFamily: "Jakarta",
    fontSize: 15,
    lineHeight: 22,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 24,
  },
  primaryButton: {
    borderRadius: 18,
    backgroundColor: "#355A31",
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    fontFamily: "Jakarta-Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  secondaryButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 15,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontFamily: "Jakarta-SemiBold",
    fontSize: 15,
    color: "#374151",
  },
});

export default CustomerAccountBlocked;
