import { useState } from "react";
import { View, Text, StyleSheet, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

/**
 * The one labeled-input wrapper every form should use — consistent
 * border/radius/focus state, always a real 44px+ height (multiline fields
 * grow taller, never shorter). Helper text priority under the input:
 *   error (red)  >  warning (amber — scan low-confidence/unresolved marker,
 *   see lib/scanDraftReview.js)  >  hint (muted).
 * `required` renders the same asterisk desktop's forms show.
 * `prefix`/`suffix` render a small static text inside the input box (e.g.
 * "Rs", "%") without affecting the value.
 */
export default function FormField({
  label,
  value,
  onChangeText,
  error,
  hint,
  warning,
  required = false,
  placeholder,
  keyboardType = "default",
  multiline = false,
  secureTextEntry = false,
  editable = true,
  prefix,
  suffix,
  style,
  inputStyle,
  inputRef,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  const hasAdornment = prefix != null || suffix != null;
  const boxStyle = [
    styles.box,
    multiline && styles.multilineBox,
    focused && styles.boxFocused,
    warning && !error && styles.boxWarning,
    error && styles.boxError,
    !editable && styles.boxDisabled,
  ];

  return (
    <View style={[styles.field, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}
      <View style={boxStyle}>
        {prefix != null ? <Text style={styles.adornment}>{prefix}</Text> : null}
        <TextInput
          ref={inputRef}
          style={[styles.input, multiline && styles.multilineInput, hasAdornment && styles.inputWithAdornment, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.iconMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          secureTextEntry={secureTextEntry}
          editable={editable}
          onFocus={(e) => {
            setFocused(true);
            if (typeof rest.onFocus === "function") rest.onFocus(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            if (typeof rest.onBlur === "function") rest.onBlur(e);
          }}
          accessibilityLabel={label}
          {...rest}
        />
        {suffix != null ? <Text style={styles.adornment}>{suffix}</Text> : null}
      </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  required: { color: colors.danger },
  box: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.cardBg,
  },
  multilineBox: { alignItems: "flex-start", minHeight: 90 },
  boxFocused: { borderColor: colors.primary },
  boxWarning: { borderColor: colors.warning, backgroundColor: "rgba(253,175,34,0.06)" },
  boxError: { borderColor: colors.danger },
  boxDisabled: { opacity: 0.6 },
  input: {
    flex: 1,
    minHeight: 42,
    paddingVertical: 10,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  multilineInput: { minHeight: 88, textAlignVertical: "top", paddingTop: 12 },
  inputWithAdornment: { paddingHorizontal: 6 },
  adornment: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textMuted },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 12, marginTop: 4 },
  helperRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  warningText: { color: "#B47300", fontFamily: fonts.medium, fontSize: 12, flex: 1 },
  hintText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12, marginTop: 4 },
});
