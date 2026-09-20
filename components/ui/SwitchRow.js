import { View, Text, StyleSheet, Switch, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

/**
 * Labeled boolean toggle row — the mobile equivalent of desktop's
 * Form.Check type="switch". The whole row is tappable (44px target), not
 * just the small switch thumb. Helper text priority: warning > hint.
 */
export default function SwitchRow({ label, value, onValueChange, hint, warning, disabled = false, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        style={styles.row}
        onPress={() => !disabled && onValueChange(!value)}
        accessibilityRole="switch"
        accessibilityState={{ checked: !!value, disabled }}
        accessibilityLabel={label}
      >
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
        <Switch value={!!value} onValueChange={onValueChange} disabled={disabled} trackColor={{ true: colors.primary, false: colors.border }} />
      </Pressable>
      {warning ? (
        <View style={styles.helperRow}>
          <Feather name="alert-triangle" size={12} color={colors.warning} />
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 44 },
  label: { flex: 1, fontFamily: fonts.semiBold, fontSize: 13, color: colors.text, marginRight: 12 },
  labelDisabled: { opacity: 0.6 },
  helperRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  warningText: { color: "#B47300", fontFamily: fonts.medium, fontSize: 12, flex: 1 },
  hintText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12 },
});
