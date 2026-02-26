"use client"

import { useState } from "react"
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useAuthStore } from "../lib/authStore"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as ImagePicker from "expo-image-picker"
import axios from "axios"
import { LinearGradient } from "expo-linear-gradient"

const { width } = Dimensions.get("window")
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.254.10:5000/api"

export default function RiderRegisterScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [step, setStep] = useState(1) // 1: Personal, 2: Vehicle, 3: License, 4: Review
  const [loading, setLoading] = useState(false)

  // Personal data
  const [personalData, setPersonalData] = useState({
    emergency_contact: "",
    nid_number: "",
    bank_name: "",
    account_number: "",
    account_holder_name: "",
  })
  const [profilePhoto, setProfilePhoto] = useState(null)
  const [termsAccepted, setTermsAccepted] = useState(false)

  // Vehicle data
  const [vehicleData, setVehicleData] = useState({
    make: "",
    model: "",
    year: "",
    color: "",
    license_plate: "",
    vehicle_type: "motorcycle",
    seats_available: "1",
  })
  const [vehicleDoc, setVehicleDoc] = useState(null) // This is the Billbook photo

  // License data
  const [licenseData, setLicenseData] = useState({
    license_number: "",
    expiry_date: "",
    issued_date: "",
    issuing_authority: "",
    license_holder_name: user?.name || "",
    date_of_birth: "",
  })
  const [licensePhoto, setLicensePhoto] = useState(null)

  const pickImage = async (setter) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "We need access to your gallery to upload documents.")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    })

    if (!result.canceled) {
      setter(result.assets[0])
    }
  }

  const uploadFile = async (asset, type = "image") => {
    try {
      const token = await AsyncStorage.getItem("token")
      if (!token) {
        console.error(`[uploadFile] 🛑 No token found in AsyncStorage for ${type} upload`)
        throw new Error("Your session has expired. Please log out and log in again.")
      }

      console.log(`[uploadFile] 🚀 Uploading ${type}... Token length: ${token.length}`)
      const formData = new FormData()

      // Determine file extension and type
      const uri = asset.uri
      const fileExt = uri.split('.').pop().toLowerCase()
      const mimeType = fileExt === 'png' ? 'image/png' : 'image/jpeg'
      const fileName = asset.fileName || `${type}-${Date.now()}.${fileExt}`

      formData.append(type === "license" ? "license_photo" : "image", {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name: fileName,
        type: mimeType,
      })

      const endpoint = type === "license" ? "/upload/license" : "/upload/image"
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: formData,
      })

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        console.error(`[uploadFile] ❌ Server returned ${response.status}:`, errJson)

        if (response.status === 401) {
          throw new Error("Unauthorized: Your session is invalid. Please login again.")
        }

        const serverError = errJson.error || errJson.message || `Status ${response.status}`
        throw new Error(`Upload failed: ${serverError}`)
      }

      const data = await response.json()
      console.log(`[uploadFile] ✅ ${type} upload successful:`, data.imageUrl)
      return data.imageUrl
    } catch (err) {
      console.error(`[uploadFile] 💥 Fatal error uploading ${type}:`, err.message)
      throw err
    }
  }

  const handleNextStep = async () => {
    if (step === 1) {
      if (!profilePhoto || !personalData.emergency_contact) {
        return Alert.alert("Required", "Profile photo and Emergency contact are required.")
      }
      setStep(2)
    } else if (step === 2) {
      if (!vehicleData.make || !vehicleData.model || !vehicleData.license_plate || !vehicleDoc) {
        return Alert.alert("Missing Details", "All vehicle details and Billbook photo are required.")
      }
      setStep(3)
    } else if (step === 3) {
      if (!licenseData.license_number || !licenseData.expiry_date || !licensePhoto) {
        return Alert.alert("Missing Details", "License number, expiry and photo are required.")
      }
      setStep(4)
    }
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      const token = await AsyncStorage.getItem("token")

      // 1. Upload All Photos (Sequential)
      console.log("Uploading photos...")
      const profilePhotoUrl = await uploadFile(profilePhoto, "profile")
      const billbookUrl = await uploadFile(vehicleDoc, "billbook")
      const licensePhotoUrl = await uploadFile(licensePhoto, "license")

      // 2. Step 1: Personal Info
      console.log("Saving personal info...")
      await axios.post(`${API_URL}/rides/rider/register/personal`, {
        ...personalData,
        profile_photo_url: profilePhotoUrl,
        terms_accepted: termsAccepted
      }, { headers: { Authorization: `Bearer ${token}` } })

      // 3. Step 2: Vehicle
      console.log("Registering vehicle...")
      await axios.post(`${API_URL}/rides/rider/register/vehicle`, {
        ...vehicleData,
        billbook_photo_url: billbookUrl,
        year: parseInt(vehicleData.year) || 2020,
      }, { headers: { Authorization: `Bearer ${token}` } })

      // 4. Step 3: License
      console.log("Registering license...")
      await axios.post(`${API_URL}/rides/rider/register/license`, {
        ...licenseData,
        license_photo_url: licensePhotoUrl,
      }, { headers: { Authorization: `Bearer ${token}` } })

      // 5. Finalize
      console.log("Finalizing registration...")
      await axios.post(`${API_URL}/rides/rider/register/complete`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })

      Alert.alert("Application Submitted!", "Your rider profile is now under review. We will notify you once approved.", [
        { text: "Got it", onPress: () => router.back() }
      ])
    } catch (error) {
      console.error("Submission error:", error)
      const errMsg = error.response?.data?.error || error.message || "Failed to submit application."
      Alert.alert("Submission Error", errMsg)
    } finally {
      setLoading(false)
    }
  }

  const renderProgress = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3, 4].map((s) => (
        <View key={s} style={styles.progressBarWrapper}>
          <View style={[styles.progressCircle, step >= s && styles.progressCircleActive]}>
            <Text style={[styles.progressText, step >= s && styles.progressTextActive]}>{s}</Text>
          </View>
          {s < 4 && <View style={[styles.progressLine, step > s && styles.progressLineActive]} />}
        </View>
      ))}
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#FFF", "#FDF2F0"]} style={styles.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become a Rider</Text>
        <View style={{ width: 40 }} />
      </View>

      {renderProgress()}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {step === 1 && (
          <View style={styles.formCard}>
            <Text style={styles.stepTitle}>Step 1: Personal</Text>
            <Text style={styles.stepSubtitle}>Identify yourself to become a rider</Text>

            <TouchableOpacity style={styles.profilePicker} onPress={() => pickImage(setProfilePhoto)}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto.uri }} style={styles.profileImgMain} />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="camera" size={36} color="#FF6B35" />
                  <Text style={styles.uploadTextSmall}>Upload Selfie</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.inputGroup}>
              <Ionicons name="call-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Emergency Contact Phone"
                keyboardType="phone-pad"
                value={personalData.emergency_contact}
                onChangeText={(v) => setPersonalData({ ...personalData, emergency_contact: v })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="card-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="National ID / Document Number"
                value={personalData.nid_number}
                onChangeText={(v) => setPersonalData({ ...personalData, nid_number: v })}
              />
            </View>

            <Text style={styles.label}>Payout Details (Optional)</Text>
            <View style={styles.inputGroup}>
              <Ionicons name="business-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Bank Name"
                value={personalData.bank_name}
                onChangeText={(v) => setPersonalData({ ...personalData, bank_name: v })}
              />
            </View>
            <View style={styles.inputGroup}>
              <Ionicons name="wallet-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Account Number"
                value={personalData.account_number}
                onChangeText={(v) => setPersonalData({ ...personalData, account_number: v })}
              />
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.formCard}>
            <Text style={styles.stepTitle}>Step 2: Vehicle</Text>
            <Text style={styles.stepSubtitle}>Provide information about your transport</Text>

            <View style={styles.inputGroup}>
              <Ionicons name="car-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Make (e.g. Honda)"
                value={vehicleData.make}
                onChangeText={(v) => setVehicleData({ ...vehicleData, make: v })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="construct-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Model (e.g. CB Shine)"
                value={vehicleData.model}
                onChangeText={(v) => setVehicleData({ ...vehicleData, model: v })}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <TextInput
                  style={styles.input}
                  placeholder="Year"
                  keyboardType="numeric"
                  value={vehicleData.year}
                  onChangeText={(v) => setVehicleData({ ...vehicleData, year: v })}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <TextInput
                  style={styles.input}
                  placeholder="Color"
                  value={vehicleData.color}
                  onChangeText={(v) => setVehicleData({ ...vehicleData, color: v })}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="barcode-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="License Plate (e.g. BA 97 PA 1234)"
                autoCapitalize="characters"
                value={vehicleData.license_plate}
                onChangeText={(v) => setVehicleData({ ...vehicleData, license_plate: v })}
              />
            </View>

            <Text style={styles.label}>Vehicle Type</Text>
            <View style={styles.typeContainer}>
              {["motorcycle", "sedan", "suv"].map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setVehicleData({ ...vehicleData, vehicle_type: type, seats_available: type === 'motorcycle' ? '1' : '4' })}
                  style={[styles.typeBtn, vehicleData.vehicle_type === type && styles.typeBtnActive]}
                >
                  <Ionicons
                    name={type === "motorcycle" ? "bicycle" : "car"}
                    size={20}
                    color={vehicleData.vehicle_type === type ? "#FFF" : "#FF6B35"}
                  />
                  <Text style={[styles.typeBtnText, vehicleData.vehicle_type === type && styles.typeBtnTextActive]}>
                    {type.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Billbook / Bluebook Photo</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setVehicleDoc)}>
              {vehicleDoc ? (
                <Image source={{ uri: vehicleDoc.uri }} style={styles.previewImg} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={32} color="#FF6B35" />
                  <Text style={styles.uploadText}>Upload Registration</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.formCard}>
            <Text style={styles.stepTitle}>Step 3: License</Text>
            <Text style={styles.stepSubtitle}>Your driving credentials</Text>

            <View style={styles.inputGroup}>
              <Ionicons name="card-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="License Number"
                value={licenseData.license_number}
                onChangeText={(v) => setLicenseData({ ...licenseData, license_number: v })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="calendar-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Expiry (YYYY-MM-DD)"
                value={licenseData.expiry_date}
                onChangeText={(v) => setLicenseData({ ...licenseData, expiry_date: v })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="person-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name on License"
                value={licenseData.license_holder_name}
                onChangeText={(v) => setLicenseData({ ...licenseData, license_holder_name: v })}
              />
            </View>

            <Text style={styles.label}>License Original Photo</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setLicensePhoto)}>
              {licensePhoto ? (
                <Image source={{ uri: licensePhoto.uri }} style={styles.previewImg} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={32} color="#FF6B35" />
                  <Text style={styles.uploadText}>Capture License</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {step === 4 && (
          <View style={styles.formCard}>
            <View style={styles.successIcon}>
              <Ionicons name="shield-checkmark" size={60} color="#FF6B35" />
            </View>
            <Text style={styles.stepTitle}>Final Review</Text>
            <Text style={[styles.stepSubtitle, { textAlign: 'center' }]}>
              Check your details. Once submitted, our team will review your profile.
            </Text>

            <View style={styles.reviewList}>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Identity</Text>
                <Text style={styles.reviewValue}>{user?.name} | Emergency: {personalData.emergency_contact}</Text>
              </View>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Vehicle</Text>
                <Text style={styles.reviewValue}>{vehicleData.make} {vehicleData.model} ({vehicleData.license_plate})</Text>
              </View>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>License</Text>
                <Text style={styles.reviewValue}>{licenseData.license_number}</Text>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#666" />
              <Text style={styles.infoText}>Approvals usually take 24-48 hours.</Text>
            </View>

            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setTermsAccepted(!termsAccepted)}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxActive]}>
                {termsAccepted && <Ionicons name="checkmark" size={12} color="#FFF" />}
              </View>
              <Text style={styles.termsText}>I agree to the Rider Terms & Service Conditions</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, (loading || (!termsAccepted && step === 4)) && styles.disabledBtn]}
          onPress={step < 4 ? handleNextStep : handleSubmit}
          disabled={loading || (!termsAccepted && step === 4)}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : (
            <>
              <Text style={styles.primaryBtnText}>{step < 4 ? (step === 3 ? "Review Details" : "Continue") : "Submit Application"}</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  background: { ...StyleSheet.absoluteFillObject },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 8,
  },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.05)" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#333", letterSpacing: -0.5 },

  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
    paddingHorizontal: 40
  },
  progressBarWrapper: { flexDirection: "row", alignItems: "center" },
  progressCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EEE",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#DDD"
  },
  progressCircleActive: { backgroundColor: "#FF6B35", borderColor: "#FF8C60" },
  progressText: { fontSize: 14, fontWeight: "700", color: "#999" },
  progressTextActive: { color: "#FFF" },
  progressLine: { width: 50, height: 4, backgroundColor: "#EEE", marginHorizontal: 2 },
  progressLineActive: { backgroundColor: "#FF6B35" },

  scrollContent: { padding: 20, paddingBottom: 40 },
  formCard: {
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
  },
  stepTitle: { fontSize: 22, fontWeight: "800", color: "#333" },
  stepSubtitle: { fontSize: 14, color: "#888", marginBottom: 25, marginTop: 4 },

  label: { fontSize: 13, fontWeight: "700", color: "#666", marginTop: 20, marginBottom: 10 },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#EEE"
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: "#333" },
  row: { flexDirection: "row" },

  typeContainer: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#FDF2F0",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFE1D2"
  },
  typeBtnActive: { backgroundColor: "#FF6B35", borderColor: "#FF6B35" },
  typeBtnText: { fontSize: 11, fontWeight: "800", color: "#FF6B35" },
  typeBtnTextActive: { color: "#FFF" },

  uploadBox: {
    width: "100%",
    height: 140,
    backgroundColor: "#FFF7F5",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FF6B35",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden"
  },
  uploadText: { marginTop: 10, color: "#FF6B35", fontWeight: "700", fontSize: 14 },
  previewImg: { width: "100%", height: "100%", resizeMode: "cover" },

  successIcon: { alignSelf: "center", marginBottom: 20, padding: 20, backgroundColor: "#FFF7F5", borderRadius: 50 },
  reviewList: { marginTop: 20, gap: 12 },
  reviewItem: { backgroundColor: "#FFF", padding: 15, borderRadius: 15, borderWidth: 1, borderColor: "#EEE" },
  reviewLabel: { fontSize: 12, color: "#999", fontWeight: "700", textTransform: "uppercase" },
  reviewValue: { fontSize: 15, color: "#333", fontWeight: "600", marginTop: 2 },

  infoBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 25, alignSelf: "center" },
  infoText: { fontSize: 12, color: "#666", fontWeight: "500" },

  primaryBtn: {
    backgroundColor: "#FF6B35",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 20,
    marginTop: 30,
    gap: 10,
    shadowColor: "#FF6B35",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8
  },
  primaryBtnText: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  profilePicker: { alignSelf: 'center', marginBottom: 25 },
  profilePlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,107,53,0.05)', borderStyle: 'dashed', borderWidth: 2, borderColor: '#FF6B35', justifyContent: 'center', alignItems: 'center' },
  profileImgMain: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#FF6B35' },
  uploadTextSmall: { fontSize: 10, fontWeight: '800', color: '#FF6B35', marginTop: 5 },
  disabledBtn: { opacity: 0.6 },
  termsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 10, alignSelf: 'center' },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderSize: 1, borderColor: '#FF6B35', borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#FF6B35' },
  termsText: { fontSize: 11, color: '#666', fontWeight: '500' }
})
