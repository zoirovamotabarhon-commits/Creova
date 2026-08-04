import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="images" options={{ title: "Images" }} />
      <Tabs.Screen name="videos" options={{ title: "Videos" }} />
      <Tabs.Screen name="music" options={{ title: "Music" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
