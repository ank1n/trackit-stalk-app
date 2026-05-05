import { Tabs, router } from "expo-router";
import { TouchableOpacity, View, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { t } from "../../lib/i18n";

const PRIMARY = "#4A7BF7";
const TAB_BG = "#1C1C1E";
const TAB_INACTIVE = "#8E8E93";

function FABButton() {
  return (
    <View style={styles.fabContainer}>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/issue/create")}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        headerStyle: { backgroundColor: "#FAFAFA" },
        headerTitleStyle: { fontWeight: "700", fontSize: 28, color: "#1A1A1A", letterSpacing: -0.5 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab.home"),
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={22} color={color} />,
          headerTitle: t("home.title"),
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push("/search")} style={{ marginRight: 16 }}>
              <Ionicons name="search" size={22} color="#1A1A1A" />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: t("tab.projects"),
          tabBarIcon: ({ color, size }) => <Ionicons name="folder" size={22} color={color} />,
          headerTitle: t("projects.title"),
        }}
      />
      <Tabs.Screen
        name="create-placeholder"
        options={{
          title: "",
          tabBarIcon: () => <FABButton />,
          tabBarLabel: () => null,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/issue/create");
          },
        }}
      />
      <Tabs.Screen
        name="my-tasks"
        options={{
          title: t("tab.myTasks"),
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle" size={22} color={color} />,
          headerTitle: t("myTasks.title"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tab.profile"),
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={22} color={color} />,
          headerTitle: t("profile.title"),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: TAB_BG,
    borderTopWidth: 0,
    height: Platform.OS === "ios" ? 90 : 68,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 28 : 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
  tabItem: {
    paddingTop: 4,
  },
  fabContainer: {
    position: "relative",
    top: -16,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
});
