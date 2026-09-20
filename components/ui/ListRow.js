import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";
import { useFadeInUp, staggerDelay } from "../../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function ListRow({ title, subtitle, meta, metaSecondary, badge, onPress, style, index = 0, leading, trailing }) {
  const Container = onPress ? AnimatedTouchable : Animated.View;
  const entrance = useFadeInUp(staggerDelay(index));
  return (
    <Container
      style={[styles.row, { opacity: entrance.opacity, transform: entrance.transform }, style]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={[styles.left, !leading && styles.leftFull]}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {meta != null ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {metaSecondary != null ? (
          <Text style={styles.metaSecondary} numberOfLines={1}>
            {metaSecondary}
          </Text>
        ) : null}
        {badge ? <View style={styles.badgeSlot}>{badge}</View> : null}
        {trailing != null ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    minHeight: 44,
    gap: 10,
  },
  leading: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  left: { flex: 1, marginRight: 6 },
  leftFull: { marginRight: 0 },
  title: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  subtitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  right: { alignItems: "flex-end", gap: 4, flexShrink: 0 },
  meta: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  metaSecondary: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  badgeSlot: { marginTop: 2 },
  trailing: { marginLeft: 4 },
});
