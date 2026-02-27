"use client"

import { Stack, useRouter, useSegments } from "expo-router"
import { useEffect } from "react"
import * as SplashScreen from "expo-splash-screen"
import { useAuthStore } from "../lib/authStore"

SplashScreen.preventAutoHideAsync()

// Initialize Mapbox as early as possible
try {
  const MapboxGL = require("@rnmapbox/maps").default
  const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoicHJhYmlubm5ubiIsImEiOiJjbW00OHZ4NTAwOHRlMnFxcnU0bHpnM2pkIn0.qaMlA24-5I_qANfRSN2jvA"
  if (MAPBOX_TOKEN) {
    MapboxGL.setAccessToken(MAPBOX_TOKEN)
  }
} catch (e) {
  console.warn("Mapbox initialization failed in root layout:", e.message)
}

export default function RootLayout() {
  const { user, loadUser } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    async function prepare() {
      try {
        await loadUser()
      } catch (e) {
        console.warn(e)
      } finally {
        await SplashScreen.hideAsync()
      }
    }

    prepare()
  }, [])

  useEffect(() => {
    // Wait for loading to complete
    if (user === undefined) return // Still loading (undefined means loading, null means not logged in)

    const inAuthGroup = segments[0] === "auth"
    const inTabsGroup = segments[0] === "(tabs)"

    // If not logged in and not in auth group, redirect to login
    if (user === null && !inAuthGroup) {
      // Defer navigation to ensure the Root Layout has mounted
      setTimeout(() => router.replace("/auth/login"), 0)
    }
    // If logged in and in auth group, redirect to map
    else if (user !== null && inAuthGroup) {
      setTimeout(() => router.replace("/(tabs)/map"), 0)
    }
    // If not logged in and trying to access tabs, redirect to login
    else if (user === null && inTabsGroup) {
      setTimeout(() => router.replace("/auth/login"), 0)
    }
  }, [user, segments])

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="eventDetail" />
    </Stack>
  )
}
