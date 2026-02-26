"use client"

import { useState, useEffect } from "react"
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, Modal, TextInput } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useAuthStore } from "../../lib/authStore"
import axios from "axios"
import AsyncStorage from "@react-native-async-storage/async-storage"

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.254.10:5000/api"

export default function ProfileScreen() {
  const { user, logout, loadUser, refreshUser } = useAuthStore()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [phoneModalVisible, setPhoneModalVisible] = useState(false)
  const [newPhone, setNewPhone] = useState(user?.phone || "")
  const [stats, setStats] = useState({
    eventsLiked: 0,
    eventsCheckedIn: 0,
    totalEvents: 0,
  })

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      setLoading(true)
      await loadUser()
      await fetchUserStats()
    } catch (error) {
      console.error("Error loading user data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserStats = async () => {
    try {
      const token = await AsyncStorage.getItem("token")
      if (!token) return

      // Fetch user's liked events
      const likesResponse = await axios.get(`${API_URL}/likes/my-likes`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      // Fetch user's check-ins
      const checkinsResponse = await axios.get(`${API_URL}/checkin/my-checkins`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setStats({
        eventsLiked: likesResponse.data?.length || 0,
        eventsCheckedIn: checkinsResponse.data?.length || 0,
        totalEvents: (likesResponse.data?.length || 0) + (checkinsResponse.data?.length || 0),
      })
    } catch (error) {
      console.error("Error fetching stats:", error)
      if (error.response?.status === 401) {
        console.warn("Session expired or invalid token. Logging out...")
        await logout()
        router.replace("/auth/login")
        Alert.alert("Session Expired", "Please login again to continue.")
      }
    }
  }

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout()
          router.replace("/auth/login")
        },
      },
    ])
  }

  const handleSettings = () => {
    Alert.alert("Settings", "Settings feature coming soon!")
  }

  const handleHelp = () => {
    Alert.alert("Help & Support", "Need help? Contact us at support@eventblinker.com")
  }

  const handleAbout = () => {
    Alert.alert("About Event Blinker", "Event Blinker v1.0.0\nDiscover events in Nepal!")
  }

  const handleUpdatePhone = async () => {
    if (!newPhone || newPhone.length < 10) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit phone number.")
      return
    }

    try {
      setUpdating(true)
      const token = await AsyncStorage.getItem("token")
      await axios.put(`${API_URL}/users/profile`, { phone: newPhone }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      await refreshUser()
      setPhoneModalVisible(false)
      Alert.alert("Success", "Phone number updated successfully.")
    } catch (error) {
      console.error("Update phone error:", error)
      Alert.alert("Error", error.response?.data?.error || "Failed to update phone number.")
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    )
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Please login to view profile</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.push("/auth/login")}>
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileImageContainer}>
          {user?.profile_image_url ? (
            <Image source={{ uri: user.profile_image_url }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, styles.placeholderImage]}>
              <Ionicons name="person" size={50} color="#fff" />
            </View>
          )}
        </View>

        <Text style={styles.userName}>{user?.name || "User"}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={styles.userTypeTag}>
          <Text style={styles.userTypeText}>{user?.user_type === "organizer" ? "Organizer" : "User"}</Text>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalEvents}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.eventsLiked}</Text>
          <Text style={styles.statLabel}>Liked</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.eventsCheckedIn}</Text>
          <Text style={styles.statLabel}>Check-ins</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Details</Text>
        <TouchableOpacity style={styles.infoRow} onPress={() => {
          setNewPhone(user?.phone || "")
          setPhoneModalVisible(true)
        }}>
          <View style={styles.infoLeft}>
            <Ionicons name="call-outline" size={20} color="#666" />
            <Text style={styles.infoLabel}>Phone Number</Text>
          </View>
          <View style={styles.infoRight}>
            <Text style={[styles.infoValue, !user?.phone && styles.missingInfo]}>
              {user?.phone || "Add Number"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#CCC" />
          </View>
        </TouchableOpacity>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={phoneModalVisible}
        onRequestClose={() => setPhoneModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Phone Number</Text>
            <Text style={styles.modalSub}>This is required for booking rides.</Text>

            <TextInput
              style={styles.phoneInput}
              placeholder="98XXXXXXXX"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
              maxLength={15}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setPhoneModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={handleUpdatePhone}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem} onPress={handleSettings} activeOpacity={0.7}>
          <Ionicons name="settings-outline" size={20} color="#333" />
          <Text style={styles.menuText}>Settings</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleHelp} activeOpacity={0.7}>
          <Ionicons name="help-circle-outline" size={20} color="#333" />
          <Text style={styles.menuText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleAbout} activeOpacity={0.7}>
          <Ionicons name="information-circle-outline" size={20} color="#333" />
          <Text style={styles.menuText}>About</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#FF6B35" />
          <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#fff",
    paddingVertical: 24,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  profileImageContainer: {
    marginBottom: 12,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ddd",
  },
  placeholderImage: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FF6B35",
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  userEmail: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  userTypeTag: {
    marginTop: 8,
    backgroundColor: "#FFE8DC",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  userTypeText: {
    color: "#FF6B35",
    fontSize: 12,
    fontWeight: "600",
  },
  bioSection: {
    backgroundColor: "#fff",
    padding: 16,
    marginTop: 12,
  },
  bioTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginTop: 12,
    paddingVertical: 16,
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FF6B35",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  menuSection: {
    backgroundColor: "#fff",
    marginTop: 12,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  menuText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    marginLeft: 12,
    fontWeight: "500",
  },
  logoutItem: {
    marginTop: 8,
  },
  logoutText: {
    color: "#FF6B35",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: "#FF6B35",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  section: { backgroundColor: '#FFF', marginTop: 12, padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#999', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { fontSize: 15, color: '#333', fontWeight: '500' },
  infoRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoValue: { fontSize: 15, color: '#666' },
  missingInfo: { color: '#FF6B35', fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', width: '100%', borderRadius: 25, padding: 25, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#333', textAlign: 'center' },
  modalSub: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, marginBottom: 20 },
  phoneInput: { backgroundColor: '#F8F9FA', borderRadius: 15, height: 60, paddingHorizontal: 20, fontSize: 18, fontWeight: '700', color: '#333', borderWidth: 1, borderColor: '#EEE', marginBottom: 25 },
  modalActions: { flexDirection: 'row', gap: 15 },
  modalBtn: { flex: 1, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F0F0F0' },
  cancelBtnText: { color: '#666', fontWeight: '700' },
  saveBtn: { backgroundColor: '#FF6B35' },
  saveBtnText: { color: '#FFF', fontWeight: '700' }
})
