import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

/**
 * Generic honest placeholder for every menu row / quick-link that has no
 * screen built yet — never fabricates data or fakes a working flow, per
 * ../AGENTS.md. Every destination that isn't real yet routes here with a
 * `title` param instead of silently pretending to work.
 */
export default function ComingSoonScreen() {
  const { t } = useTranslation();
  const { title } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
        <Feather name="arrow-left" size={22} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.center}>
        <View style={styles.iconBadge}>
          <Feather name="clock" size={28} color={colors.primary} />
        </View>
        <Text style={styles.title}>{title || t("menu.comingSoonTitle")}</Text>
        <Text style={styles.body}>{t("menu.comingSoonBody")}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg, padding: 20 },
  backButton: { width: 40, height: 40, justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOpacity: 0.07,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  title: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text, marginBottom: 6, textAlign: "center" },
  body: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, textAlign: "center" },
});
