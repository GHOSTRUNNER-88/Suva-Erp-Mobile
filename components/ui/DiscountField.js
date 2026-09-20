import { View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import FormField from "./FormField";
import SegmentedControl from "./SegmentedControl";

/**
 * Discount value + type ({ value, type: "percent" | "amount" }) — the same
 * pair desktop's document-form shows as a number input next to a %/currency
 * select. Used for the header discount and for each line's discount.
 */
export default function DiscountField({ label, value, type, onChangeValue, onChangeType, onFocus, error, warning, hint, style }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.row, style]}>
      <FormField
        label={label ?? t("forms.headerDiscount")}
        value={value}
        onChangeText={onChangeValue}
        keyboardType="decimal-pad"
        onFocus={onFocus}
        error={error}
        warning={warning}
        hint={hint}
        style={styles.input}
        suffix={type === "percent" ? t("sale.discountPercent") : t("sale.discountAmount")}
      />
      <SegmentedControl
        variant="segmented"
        style={styles.toggle}
        value={type}
        onChange={onChangeType}
        options={[
          { value: "percent", label: t("sale.discountPercent") },
          { value: "amount", label: t("sale.discountAmount") },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  input: { flex: 1 },
  // Grouped/segmented, not pills: pill segments carry 16px wrap padding +
  // 12px gap, which left ~9px of text room here and ellipsised "%"/"Rs"
  // to "..". The grouped variant is 44 tall, matching FormField's input.
  toggle: { marginTop: 24, width: 116 },
});
