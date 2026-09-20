import { Tabs } from "expo-router";
import { useModuleAccess } from "../../lib/orgSession";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

/**
 * Bottom tab bar structure (Home / Dashboard / Items / Scan / Menu) matches
 * ../../../mobile-ui-ref's reference app exactly — that's the actual app
 * being built, per the user's own framing. Flat white bar, colored
 * icon+label when active, no pill-highlight background (unlike the iBank
 * kit's tab bar) — the reference app doesn't use one.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const canSee = useModuleAccess();
  const insets = useSafeAreaInsets();
  // Android is edge-to-edge, so the system nav is drawn over this bar. Every
  // phone reserves something different down there — gesture pill, 3-button
  // row, OEM taskbar, nothing — and insets.bottom is the OS's exact answer for
  // the device it's running on. So clear it as-is and never guess the
  // navigation mode. The breathing room is a fixed gap *inside* the bar, which
  // keeps the icon+label block identical on every phone, sitting on top of
  // whatever the system reserves. (Padding by exactly the inset, with no gap,
  // left the labels flush against the gesture pill.)
  const BAR_GAP = 8;
  const bottomPadding = insets.bottom + BAR_GAP;
  const barHeight = 54 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.iconMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarStyle: {
          borderTopColor: colors.border,
          borderTopWidth: 1,
          backgroundColor: colors.cardBg,
          height: barHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
          elevation: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t("nav.home"), tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{ title: t("nav.dashboard"), tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="items"
        // href: null hides the tab (expo-router) when the items module isn't visible
        options={{ href: canSee("items") ? undefined : null, title: t("nav.items"), tabBarIcon: ({ color, size }) => <Feather name="box" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="scan"
        options={{ title: t("nav.scan"), tabBarIcon: ({ color, size }) => <Feather name="camera" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="menu"
        options={{ title: t("nav.menu"), tabBarIcon: ({ color, size }) => <Feather name="menu" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
