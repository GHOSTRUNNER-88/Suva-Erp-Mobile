import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

export default function ScreenHeader({ title, onBack, right, subtitle }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack ?? (() => router.back())}
        hitSlop={8}
        style={styles.backButton}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Feather name="arrow-left" size={22} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right ? <View style={styles.rightWrap}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBg,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  rightWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
