import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName

          if (route.name === "map") {
            iconName = focused ? "map" : "map-outline"
          } else if (route.name === "events") {
            iconName = focused ? "list" : "list-outline"
          } else if (route.name === "chat") {
            iconName = focused ? "chatbubbles" : "chatbubbles-outline"
          } else if (route.name === "rides") {
            iconName = focused ? "car" : "car-outline"
          } else if (route.name === "profile") {
            iconName = focused ? "person" : "person-outline"
          }

          return <Ionicons name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: "#FF6B35",
        tabBarInactiveTintColor: "#4D5675",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.3,
        },
        tabBarStyle: {
          height: 70,
          paddingBottom: 14,
          paddingTop: 8,
          backgroundColor: "#0D1120",
          borderTopColor: "rgba(255,255,255,0.04)",
          borderTopWidth: 1,
          elevation: 20,
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 15,
          shadowOffset: { width: 0, height: -5 },
        },
      })}
    >
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="events" options={{ title: "Events" }} />
      <Tabs.Screen name="rides" options={{ title: "Rides" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  )
}
