import { Stack } from "expo-router"

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="login" options={{ animationEnabled: false }} />
      <Stack.Screen name="register" options={{ animationEnabled: false }} />
    </Stack>
  )
}
