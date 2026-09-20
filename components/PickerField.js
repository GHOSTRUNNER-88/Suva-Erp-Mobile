import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import BottomSheet from "./ui/BottomSheet";
import { EmptyState } from "./ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

/**
 * Searchable bottom-sheet picker — the mobile equivalent of desktop's
 * searchable-select pattern (../AGENTS.md workspace rule: "every relation
 * select must be searchable"). Was a full-screen Modal; now a slide-up sheet
 * (components/ui/BottomSheet.js) so the form underneath stays in context.
 * No inline quick-create here (that's a real form-plus-permissions feature,
 * out of scope for this pass) — picking from an existing list only.
 *
 * Prop API is a superset of the original (label, placeholder, value,
 * options, onSelect, error, getLabel, getKey) so every existing caller
 * keeps working unchanged. Additions:
 *  - `hint`      muted helper text under the field
 *  - `warning`   amber helper text + amber border (scan low-confidence /
 *                unresolved marker — see lib/scanDraftReview.js)
 *  - `required`  shows the asterisk desktop's forms show
 *  - `disabled`  non-interactive, dimmed
 *  - `getSubtitle(option)` optional second line per row (e.g. a price)
 *  - `onClear`   when given, a "Clear selection" row is offered
 */
export default function PickerField({
  label,
  placeholder,
  value,
  options = [],
  onSelect,
  error,
  hint,
  warning,
  required = false,
  disabled = false,
  getLabel = (option) => option?.name ?? "",
  getKey = (option) => String(option?.id),
  getSubtitle,
  onClear,
  onAddNew,
  addNewLabel,
  style,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const normalizedValue = value == null || value === "" ? null : String(value);
  const selected = useMemo(() => options.find((option) => getKey(option) === normalizedValue), [options, normalizedValue, getKey]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => {
      const primary = String(getLabel(option) ?? "").toLowerCase();
      const secondary = getSubtitle ? String(getSubtitle(option) ?? "").toLowerCase() : "";
      return primary.includes(query) || secondary.includes(query);
    });
  }, [options, search, getLabel, getSubtitle]);

  function choose(option) {
    onSelect(option);
    setOpen(false);
  }

  const borderStyle = error ? styles.inputError : warning ? styles.inputWarning : null;

  return (
    <View style={[styles.field, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}
      <Pressable
        style={({ pressed }) => [styles.input, borderStyle, disabled && styles.inputDisabled, pressed && !disabled && styles.inputPressed]}
        onPress={() => !disabled && setOpen(true)}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        accessibilityLabel={label || placeholder}
      >
        <Text style={selected ? styles.valueText : styles.placeholderText} numberOfLines={1}>
          {selected ? getLabel(selected) : placeholder}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.iconMuted} />
      </Pressable>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : warning ? (
        <View style={styles.helperRow}>
          <Feather name="alert-triangle" size={12} color={colors.warning} />
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label || placeholder} maxHeightRatio={0.82}>
        <View style={styles.searchRow}>
          <Feather name="search" size={16} color={colors.iconMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t("common.searchPlaceholder")}
            placeholderTextColor={colors.iconMuted}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t("common.searchPlaceholder")}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8} accessibilityLabel={t("common.reset")}>
              <Feather name="x-circle" size={16} color={colors.iconMuted} />
            </Pressable>
          ) : null}
        </View>

        {onAddNew ? (
          <Pressable
            style={({ pressed }) => [styles.addNewButton, pressed && styles.addNewButtonPressed]}
            onPress={() => {
              setOpen(false);
              onAddNew();
            }}
            accessibilityRole="button"
          >
            <Feather name="plus-circle" size={16} color={colors.primary} />
            <Text style={styles.addNewButtonText}>{addNewLabel || t("common.addNew", { defaultValue: "Add New" })}</Text>
          </Pressable>
        ) : null}

        {options.length === 0 ? (
          <EmptyState icon="inbox" title={t("picker.emptyTitle")} body={t("picker.emptyBody")} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="search" title={t("picker.noResultsTitle")} body={t("picker.noResultsBody")} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={getKey}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={16}
            ListHeaderComponent={
              onClear && selected ? (
                <Pressable style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]} onPress={() => { onClear(); setOpen(false); }}>
                  <Feather name="x-circle" size={16} color={colors.iconMuted} />
                  <Text style={[styles.optionText, styles.clearText]}>{t("picker.clear")}</Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => {
              const isSelected = getKey(item) === normalizedValue;
              const subtitle = getSubtitle ? getSubtitle(item) : null;
              return (
                <Pressable
                  style={({ pressed }) => [styles.optionRow, isSelected && styles.optionRowSelected, pressed && styles.optionRowPressed]}
                  onPress={() => choose(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]} numberOfLines={1}>
                      {getLabel(item)}
                    </Text>
                    {subtitle ? (
                      <Text style={styles.optionSubtitle} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected ? <Feather name="check" size={18} color={colors.primary} /> : null}
                </Pressable>
              );
            }}
          />
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  required: { color: colors.danger },
  input: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.cardBg,
  },
  inputPressed: { borderColor: colors.primary },
  inputError: { borderColor: colors.danger },
  inputWarning: { borderColor: colors.warning, backgroundColor: "rgba(253,175,34,0.06)" },
  inputDisabled: { opacity: 0.6 },
  valueText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, flex: 1, marginRight: 8 },
  placeholderText: { fontFamily: fonts.medium, fontSize: 14, color: colors.iconMuted, flex: 1, marginRight: 8 },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 12, marginTop: 4 },
  helperRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  warningText: { color: "#B47300", fontFamily: fonts.medium, fontSize: 12, flex: 1 },
  hintText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12, marginTop: 4 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    backgroundColor: colors.bodyBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  addNewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(152,95,253,0.08)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(152,95,253,0.25)",
  },
  addNewButtonPressed: { backgroundColor: "rgba(152,95,253,0.16)" },
  addNewButtonText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primary },
  list: { flexGrow: 0, flexShrink: 1 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionRowSelected: { backgroundColor: "rgba(152,95,253,0.06)" },
  optionRowPressed: { backgroundColor: colors.bodyBg },
  optionTextWrap: { flex: 1, marginRight: 8 },
  optionText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  optionTextSelected: { fontFamily: fonts.semiBold, color: colors.primary },
  optionSubtitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  clearText: { color: colors.textMuted },
});
