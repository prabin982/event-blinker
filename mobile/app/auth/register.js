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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Picker } from "@react-native-picker/picker"
import { useRouter } from "expo-router"
import { useAuthStore } from "../../lib/authStore"
import { Ionicons } from "@expo/vector-icons"

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [userType, setUserType] = useState("user")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register } = useAuthStore()
  const router = useRouter()

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields")
      return
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match")
      return
    }

    setLoading(true)
    const fullName = `${firstName} ${lastName}`
    const result = await register(fullName, email, password)
    setLoading(false)

    if (!result.success) {
      Alert.alert("Registration Failed", result.error || "An error occurred")
    } else {
      router.replace("/(tabs)/map")
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FF6B35" />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Event Blinker today</Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>First Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#FF6B35" />
              <TextInput
                style={styles.input}
                placeholder="John"
                placeholderTextColor="#4D5675"
                value={firstName}
                onChangeText={setFirstName}
                editable={!loading}
              />
            </View>

            <Text style={[styles.label, { marginTop: 18 }]}>Last Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#FF6B35" />
              <TextInput
                style={styles.input}
                placeholder="Doe"
                placeholderTextColor="#4D5675"
                value={lastName}
                onChangeText={setLastName}
                editable={!loading}
              />
            </View>

            <Text style={[styles.label, { marginTop: 18 }]}>Email</Text>
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

            <Text style={[styles.label, { marginTop: 18 }]}>Account Type</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={userType}
                onValueChange={(value) => setUserType(value)}
                style={styles.picker}
                enabled={!loading}
                dropdownIconColor="#FF6B35"
              >
                <Picker.Item label="User" value="user" color="#F0F2F8" />
                <Picker.Item label="Organizer" value="organizer" color="#F0F2F8" />
              </Picker>
            </View>

            <Text style={[styles.label, { marginTop: 18 }]}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#FF6B35" />
              <TextInput
                style={styles.input}
                placeholder="Create a password"
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

            <Text style={[styles.label, { marginTop: 18 }]}>Confirm Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#FF6B35" />
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                placeholderTextColor="#4D5675"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
            </View>

            <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.loginSection}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/auth/login")}>
              <Text style={styles.loginLink}>Login</Text>
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
    padding: 24,
  },
  backButton: {
    paddingVertical: 8,
    width: 40,
  },
  headerSection: {
    marginTop: 16,
    marginBottom: 36,
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
    marginBottom: 24,
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    backgroundColor: "#151A2D",
    overflow: "hidden",
  },
  picker: {
    height: 50,
    color: "#F0F2F8",
  },
  registerButton: {
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
  registerButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  loginSection: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
  },
  loginText: {
    color: "#6B7599",
    fontSize: 14,
  },
  loginLink: {
    color: "#FF6B35",
    fontSize: 14,
    fontWeight: "700",
  },
})
