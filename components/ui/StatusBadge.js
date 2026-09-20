import { View, Text, StyleSheet } from "react-native";
import { statusColor } from "../../lib/statusColor";
import { fonts } from "../../theme/typography";

/** The one status pill every list row/detail screen should use. */
export default function StatusBadge({ status, label }) {
  if (!status) return null;
  const color = statusColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A`, borderColor: `${color}33` }]}>
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {label ?? status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  text: { fontFamily: fonts.semiBold, fontSize: 10, textTransform: "capitalize" },
});
