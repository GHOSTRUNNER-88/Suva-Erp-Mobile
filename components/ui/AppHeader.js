import { useEffect, useRef, useState } from "react";
import { View, Image, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useOrgSession } from "../../lib/orgSession";
import { setLanguage } from "../../i18n/language";
import { apiFetch } from "../../lib/api";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

export function LanguageSwitch() {
  const { i18n } = useTranslation();
  const isNepali = (i18n.language || "").toLowerCase().startsWith("ne");
  const scale = useRef(new Animated.Value(1)).current;

  function toggleLanguage() {
    const next = isNepali ? "en" : "ne";
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, speed: 30, bounciness: 6, useNativeDriver: true }),
    ]).start();
    setLanguage(next);
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.langButton}
        activeOpacity={0.8}
        onPress={toggleLanguage}
        accessibilityRole="button"
        accessibilityLabel="Toggle Language English / Nepali"
      >
        <Feather name="globe" size={11} color={colors.primary} />
        <Text style={styles.langText}>{isNepali ? "NP" : "EN"}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AppHeader({ title, subtitle, right }) {
  const { t } = useTranslation();
  const { organizationName, companyName } = useOrgSession();
  const tenant = organizationName || companyName || "Suva ERP";
  const headingTitle = title || tenant;
  const headingSubtitle = subtitle ?? (title ? tenant : null);

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch("/api/mobile/notifications")
      .then((data) => {
        if (!active) return;
        const count =
          typeof data?.unreadCount === "number"
            ? data.unreadCount
            : Array.isArray(data?.items)
            ? data.items.filter((i) => !i.isRead).length
            : 0;
        setUnreadCount(count);
      })
      .catch(() => {
        // Silently ignore if offline or unauthenticated
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.header}>
      {/* SUVA Brand Mark Badge */}
      <TouchableOpacity
        style={styles.brandBadge}
        activeOpacity={0.8}
        onPress={() => router.push("/business-profile")}
        accessibilityRole="button"
        accessibilityLabel={t("nav.businessProfile", "Business Profile")}
      >
        <Image
          source={require("../../assets/icon.png")}
          style={styles.brandImage}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Business / Screen Title */}
      <TouchableOpacity
        style={styles.titleWrap}
        activeOpacity={0.7}
        onPress={() => router.push("/business-profile")}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {headingTitle.toUpperCase()}
          </Text>
        </View>
        <View style={styles.titleUnderline} />
        {headingSubtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {headingSubtitle}
          </Text>
        ) : null}
      </TouchableOpacity>

      {/* Right Header Actions */}
      <View style={styles.rightActions}>
        <LanguageSwitch />

        {right}

        <TouchableOpacity
          onPress={() => {
            setUnreadCount(0);
            router.push("/notifications");
          }}
          hitSlop={8}
          style={styles.headerIcon}
          accessibilityRole="button"
          accessibilityLabel={t("common.notifications")}
        >
          <Feather name="bell" size={18} color={colors.text} />
          {unreadCount > 0 ? <View style={styles.notificationDot} /> : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  brandBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#2F2F2F",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  brandImage: { width: 58, height: 58 },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    letterSpacing: 0.4,
    color: colors.text,
  },
  titleUnderline: {
    width: 28,
    height: 2.5,
    backgroundColor: colors.gold,
    borderRadius: 2,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  langButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: "rgba(152,95,253,0.25)",
    minHeight: 26,
  },
  langText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.light,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 6,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },
});
