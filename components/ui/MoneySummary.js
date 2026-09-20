import { View, Text, StyleSheet } from "react-native";
import { formatNpr } from "../../lib/format";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

/**
 * Label/value rows for a Sale/Purchase/Expense totals block, ending in a
 * strong-hierarchy grand-total row and an optional due/balance row below it.
 * Display only — never computes anything itself, just renders numbers
 * that were already computed server-side (../../AGENTS.md §5).
 */
export default function MoneySummary({ rows = [], totalLabel, totalValue, dueLabel, dueValue, style }) {
  return (
    <View style={style}>
      {rows.map((row, index) => (
        <View key={row.key ?? index} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.formatted ?? formatNpr(row.value)}</Text>
        </View>
      ))}
      {totalLabel != null ? (
        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalLabel}>{totalLabel}</Text>
          <Text style={styles.totalValue}>{formatNpr(totalValue)}</Text>
        </View>
      ) : null}
      {dueLabel != null ? (
        <View style={styles.row}>
          <Text style={styles.dueLabel}>{dueLabel}</Text>
          <Text style={styles.dueValue}>{formatNpr(dueValue)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  value: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 10 },
  totalLabel: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  totalValue: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.primary },
  dueLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.danger },
  dueValue: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.danger },
});
