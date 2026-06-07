"use client"

import { useState } from "react"
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useAuthStore } from "../../lib/authStore"
import { Ionicons } from "@expo/vector-icons"

export default function LoginScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const router = useRouter()

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields")
      return
    }

    setLoading(true)
    const result = await login(email, password)
    setLoading(false)

    if (!result.success) {
      Alert.alert("Login Failed", result.error || "An error occurred")
    } else {
      router.replace("/(tabs)/map")
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Ionicons name="flash" size={48} color="#FF6B35" />
            </View>
            <Text style={styles.title}>Event Blinker</Text>
            <Text style={styles.subtitle}>Find events near you</Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#FF6B35" />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#4D5675"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
                keyboardType="email-address"
              />
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#FF6B35" />
              <TextInput
                style={styles.input}
                placeholder="Your password"
                placeholderTextColor="#4D5675"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye" : "eye-off"} size={20} color="#FF6B35" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Login</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.signupSection}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/auth/register")}>
              <Text style={styles.signupLink}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F1A",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    padding: 24,
  },
  headerSection: {
    alignItems: "center",
    marginTop: 60,
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,107,53,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.2)",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#F0F2F8",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7599",
  },
  formSection: {
    marginTop: 48,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8892B0",
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#151A2D",
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 15,
    color: "#F0F2F8",
  },
  loginButton: {
    backgroundColor: "#FF6B35",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 36,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  signupSection: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
  },
  signupText: {
    color: "#6B7599",
    fontSize: 14,
  },
  signupLink: {
    color: "#FF6B35",
    fontSize: 14,
    fontWeight: "700",
  },
})
