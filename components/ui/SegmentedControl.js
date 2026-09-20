import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

export default function SegmentedControl({
  options = [],
  value,
  onChange,
  style,
  compact = false,
  variant = "pill",
}) {
  const isPill = variant === "pill";

  return (
    <View
      style={[
        isPill ? styles.pillWrap : styles.wrap,
        compact && styles.wrapCompact,
        style,
      ]}
      accessibilityRole="radiogroup"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              isPill ? styles.pillSegment : styles.segment,
              compact && (isPill ? styles.pillSegmentCompact : styles.segmentCompact),
              active && (isPill ? styles.pillSegmentActive : styles.segmentActive),
              pressed && !active && styles.segmentPressed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.segmentText,
                isPill && styles.pillSegmentText,
                active && (isPill ? styles.pillSegmentTextActive : styles.segmentTextActive),
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pillWrap: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pillSegment: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: colors.cardBg,
    borderWidth: 1.2,
    borderColor: colors.border,
  },
  pillSegmentCompact: {
    minHeight: 36,
    paddingHorizontal: 8,
  },
  pillSegmentActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  pillSegmentText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textMuted,
  },
  pillSegmentTextActive: {
    color: colors.primary,
  },

  wrap: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    padding: 3,
  },
  wrapCompact: {
    padding: 2,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  segmentCompact: {
    minHeight: 34,
    paddingHorizontal: 8,
  },
  segmentActive: {
    backgroundColor: colors.light,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  segmentPressed: {
    backgroundColor: "rgba(152,95,253,0.08)",
  },
  segmentText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    flexShrink: 1,
    textAlign: "center",
  },
  segmentTextActive: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
});
