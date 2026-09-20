import { View, TextInput, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { IconButton } from "./Button";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

/**
 * Compact search input row + an optional filter button (opens whatever the
 * caller wants, e.g. a FilterSheet) + an optional sort button. Single row,
 * 44px controls.
 */
export default function SearchToolbar({ value, onChangeText, placeholder, onFilterPress, onSortPress, filterActive = false, style }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.row, style]}>
      <View style={styles.searchBox}>
        <Feather name="search" size={16} color={colors.iconMuted} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? t("common.searchPlaceholder")}
          placeholderTextColor={colors.iconMuted}
        />
      </View>
      {onSortPress ? (
        <IconButton icon="sliders" onPress={onSortPress} accessibilityLabel={t("common.sort")} style={styles.toolButton} />
      ) : null}
      {onFilterPress ? (
        <IconButton
          icon="filter"
          onPress={onFilterPress}
          accessibilityLabel={t("common.filter")}
          color={filterActive ? colors.primary : colors.text}
          style={[styles.toolButton, filterActive && styles.toolButtonActive]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.cardBg,
  },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text, paddingVertical: 10 },
  toolButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBg },
  toolButtonActive: { borderColor: colors.primary },
});
