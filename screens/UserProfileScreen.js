import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { setLanguage } from "../i18n/language";
import ScreenHeader from "../components/ui/ScreenHeader";
import { SkeletonForm, ErrorState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { useFadeInUp } from "../lib/useFadeInUp";

export default function UserProfileScreen() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestToken = useRef(0);
  const enterAnim = useFadeInUp(0);

  const load = useCallback(() => {
    const token = ++requestToken.current;
    setLoading(true);
    apiFetch("/api/mobile/session")
      .then((session) => {
        if (token !== requestToken.current) return;
        setData(session ?? null);
        setError(null);
      })
      .catch((err) => {
        if (token !== requestToken.current) return;
        setError(err.messageKey ? t(err.messageKey) : err.message);
      })
      .finally(() => {
        if (token !== requestToken.current) return;
        setLoading(false);
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeLanguage(language) {
    await setLanguage(language);
  }

  const user = data?.user;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || t("profile.notProvided");

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={t("profile.title", { defaultValue: "My Profile" })} />

      {loading ? (
        <View style={styles.content}>
          <SkeletonForm fields={4} />
        </View>
      ) : error || !data ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={enterAnim}>
            {/* Header Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.avatarCircle}>
                <Feather name="user" size={32} color={colors.primary} />
              </View>
              <Text style={styles.name}>{fullName}</Text>
              <Text style={styles.email}>{user?.email || t("profile.notProvided")}</Text>
              {user?.role ? (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{String(user.role).toUpperCase()}</Text>
                </View>
              ) : null}
            </View>

            {/* Account Details Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="shield" size={16} color={colors.primary} style={styles.cardHeaderIcon} />
                <Text style={styles.sectionTitle}>{t("profile.accountDetails", { defaultValue: "Account Details" })}</Text>
              </View>
              <InfoRow icon="briefcase" label={t("profile.role", { defaultValue: "Role" })} value={user?.role || t("profile.notProvided")} />
              <InfoRow icon="home" label={t("profile.organization", { defaultValue: "Organization" })} value={data?.organization?.name || t("profile.notProvided")} />
              {user?.phone ? <InfoRow icon="phone" label={t("common.phone", { defaultValue: "Phone" })} value={user.phone} /> : null}
            </View>

            {/* Language Switcher Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="globe" size={16} color={colors.primary} style={styles.cardHeaderIcon} />
                <Text style={styles.sectionTitle}>{t("common.language", { defaultValue: "Language" })}</Text>
              </View>
              <View style={styles.languageGrid}>
                {[
                  { key: "en", label: "English", subLabel: "English" },
                  { key: "ne", label: "नेपाली", subLabel: "Nepali" },
                ].map((item) => {
                  const active = i18n.language === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.langOption, active && styles.langOptionActive]}
                      onPress={() => changeLanguage(item.key)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.langTextWrap}>
                        <Text style={[styles.langMainText, active && styles.langMainTextActive]}>{item.label}</Text>
                        <Text style={[styles.langSubText, active && styles.langSubTextActive]}>{item.subLabel}</Text>
                      </View>
                      {active ? (
                        <View style={styles.checkCircle}>
                          <Feather name="check" size={14} color="#fff" />
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      {icon ? <Feather name={icon} size={15} color={colors.iconMuted} style={styles.infoIcon} /> : null}
      <View style={styles.infoTexts}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  content: { padding: 16, paddingBottom: 40 },
  heroCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: `${colors.primary}12`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  name: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.text,
    textAlign: "center",
  },
  email: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 3,
  },
  roleBadge: {
    marginTop: 10,
    backgroundColor: `${colors.primary}15`,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cardHeaderIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  infoIcon: {
    marginRight: 12,
  },
  infoTexts: {
    flex: 1,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  value: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  languageGrid: {
    gap: 10,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.cardBg,
  },
  langOptionActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}08`,
  },
  langTextWrap: {
    gap: 2,
  },
  langMainText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  langMainTextActive: {
    color: colors.primary,
  },
  langSubText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  langSubTextActive: {
    color: colors.primary,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
