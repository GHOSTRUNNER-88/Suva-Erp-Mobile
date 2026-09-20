import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Modal, Animated, PanResponder, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  isoAdToBs,
  isoBsToIsoAd,
  todayIsoAd,
  toIso,
  getBsDaysInMonth,
  getBsMinMaxYear,
  getNepaliFiscalYearStartAd,
  getNepaliFiscalYearEndAd,
  BS_MONTH_NAMES_EN,
  BS_MONTH_NAMES_NE,
} from "../../lib/bs-ad";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

const OPEN_DURATION = 260;
const CLOSE_DURATION = 200;

/**
 * BS-first date picker. `value` is always an AD ISO string ("YYYY-MM-DD"),
 * `onChange(isoAd)` is always called with an AD ISO string too — BS is only
 * ever the picking UI, never the stored/transmitted value
 * (../../AGENTS.md §4: both calendars everywhere, one conversion utility).
 *
 * Optional-date support: pass `placeholder` (and usually `onClear`) for a
 * field that may legitimately be empty (e.g. a deal's expected closing
 * date) — an empty value then shows the placeholder instead of silently
 * displaying today. Helper text priority: error > warning > hint, same as
 * FormField/PickerField.
 */
export default function DateField({
  value,
  onChange,
  label,
  error,
  hint,
  warning,
  required = false,
  placeholder,
  onClear,
  disabled = false,
  minDate = null,
  maxDate = null,
  restrictToFiscalYear = false,
  // BS on the first line, AD smaller underneath, for narrow side-by-side
  // fields where the one-line "BS · AD" text would cut off the AD date.
  stackedValue = false,
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  // Kept mounted past open=false so the sheet can animate out.
  const [modalVisible, setModalVisible] = useState(false);
  const { height: windowHeight } = useWindowDimensions();

  const effectiveMinAd = restrictToFiscalYear ? (minDate || getNepaliFiscalYearStartAd()) : minDate;
  const effectiveMaxAd = restrictToFiscalYear ? (maxDate || getNepaliFiscalYearEndAd()) : maxDate;

  // Drag-to-dismiss gesture on the handle bar
  const dragY = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(0)).current;
  const scrimProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      setModalVisible(true);
      slideY.setValue(windowHeight);
      const id = setTimeout(() => {
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 14 }).start();
        Animated.timing(scrimProgress, { toValue: 1, duration: OPEN_DURATION, useNativeDriver: false }).start();
      }, 16);
      return () => clearTimeout(id);
    }
    Animated.timing(scrimProgress, { toValue: 0, duration: CLOSE_DURATION, useNativeDriver: false }).start();
    Animated.timing(slideY, { toValue: windowHeight, duration: CLOSE_DURATION, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setModalVisible(false);
      },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) dragY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 80 || gesture.vy > 0.6) {
          Animated.timing(scrimProgress, { toValue: 0, duration: CLOSE_DURATION, useNativeDriver: false }).start();
          Animated.timing(dragY, { toValue: windowHeight, duration: CLOSE_DURATION, useNativeDriver: true }).start(() => {
            slideY.setValue(windowHeight);
            dragY.setValue(0);
            setOpen(false);
          });
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    })
  ).current;

  const scrimColor = scrimProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.scrimClear, colors.scrim],
  });

  const hasValue = Boolean(value && isoAdToBs(value));
  const safeAdIso = hasValue ? value : todayIsoAd();
  const bsForDisplay = isoAdToBs(safeAdIso);

  const [viewYear, setViewYear] = useState(bsForDisplay?.year);
  const [viewMonth, setViewMonth] = useState(bsForDisplay?.month);

  const { min: minYear, max: maxYear } = getBsMinMaxYear();
  const monthNames = i18n.language?.startsWith("ne") ? BS_MONTH_NAMES_NE : BS_MONTH_NAMES_EN;
  const daysInMonth = useMemo(() => {
    try {
      return getBsDaysInMonth(viewYear, viewMonth) || 30;
    } catch {
      return 30;
    }
  }, [viewYear, viewMonth]);

  function openPicker() {
    if (disabled) return;
    const bs = isoAdToBs(safeAdIso) ?? isoAdToBs(todayIsoAd());
    setViewYear(bs?.year);
    setViewMonth(bs?.month);
    setOpen(true);
  }

  function stepMonth(delta) {
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    if (nextYear < minYear || nextYear > maxYear) return;
    setViewYear(nextYear);
    setViewMonth(nextMonth);
  }

  function stepYear(delta) {
    const nextYear = viewYear + delta;
    if (nextYear < minYear || nextYear > maxYear) return;
    setViewYear(nextYear);
  }

  function selectDay(day) {
    const isoBs = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isoAd = isoBsToIsoAd(isoBs);
    if (!isoAd) return;
    if ((effectiveMinAd && isoAd < effectiveMinAd) || (effectiveMaxAd && isoAd > effectiveMaxAd)) {
      return;
    }
    onChange(isoAd);
    setOpen(false);
  }

  function selectToday() {
    const today = todayIsoAd();
    if ((effectiveMinAd && today < effectiveMinAd) || (effectiveMaxAd && today > effectiveMaxAd)) {
      return;
    }
    onChange(today);
    setOpen(false);
  }

  const closedText = hasValue || !placeholder ? (bsForDisplay ? `${toIso(bsForDisplay)} BS · ${safeAdIso} AD` : safeAdIso) : placeholder;
  const borderStyle = error ? styles.inputError : warning ? styles.inputWarning : null;

  return (
    <View style={styles.field}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}
      <TouchableOpacity
        style={[styles.input, borderStyle, disabled && styles.inputDisabled]}
        onPress={openPicker}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label || t("common.selectDate")}
      >
        {stackedValue && hasValue && bsForDisplay ? (
          <View style={styles.stackedValue}>
            <Text style={styles.stackedBsText} numberOfLines={1}>{`${toIso(bsForDisplay)} BS`}</Text>
            <Text style={styles.stackedAdText} numberOfLines={1}>{`${safeAdIso} AD`}</Text>
          </View>
        ) : (
          <Text style={[styles.valueText, !hasValue && placeholder ? styles.placeholderText : null]} numberOfLines={1}>
            {closedText}
          </Text>
        )}
        <Feather name="calendar" size={16} color={colors.iconMuted} />
      </TouchableOpacity>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : warning ? (
        <View style={styles.helperRow}>
          <Feather name="alert-triangle" size={12} color={colors.warning} />
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : restrictToFiscalYear ? (
        <Text style={styles.hintText}>
          {t("common.fiscalYearAllowedHint", { defaultValue: "Allowed dates: Nepali Fiscal Year (साउन १ - असार मसान्त)" })}
        </Text>
      ) : null}
      <Modal
        visible={modalVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="none"
        onRequestClose={() => setOpen(false)}
      >
        <Animated.View style={[styles.root, { backgroundColor: scrimColor }]}>
          <Pressable
            style={styles.backdrop}
            onPress={() => { dragY.setValue(0); setOpen(false); }}
            accessibilityLabel={t("common.close")}
          />

          <Animated.View style={[styles.sheet, { transform: [{ translateY: Animated.add(slideY, dragY) }] }]}>
            <SafeAreaView edges={["bottom"]}>
              {/* Draggable handle */}
              <View style={styles.handleHitArea} {...panResponder.panHandlers}>
                <View style={styles.handle} />
              </View>

              <View style={styles.headerRow}>
                <Text style={styles.title}>{label || t("common.selectDate")}</Text>
                <TouchableOpacity onPress={() => { dragY.setValue(0); setOpen(false); }} hitSlop={8} accessibilityLabel={t("common.close")}>
                  <Feather name="x" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.stepperRow}>
                <TouchableOpacity onPress={() => stepYear(-1)} hitSlop={8} style={styles.stepperButton}>
                  <Feather name="chevron-left" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{viewYear}</Text>
                <TouchableOpacity onPress={() => stepYear(1)} hitSlop={8} style={styles.stepperButton}>
                  <Feather name="chevron-right" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.stepperRow}>
                <TouchableOpacity onPress={() => stepMonth(-1)} hitSlop={8} style={styles.stepperButton}>
                  <Feather name="chevron-left" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{monthNames?.[viewMonth - 1] ?? viewMonth}</Text>
                <TouchableOpacity onPress={() => stepMonth(1)} hitSlop={8} style={styles.stepperButton}>
                  <Feather name="chevron-right" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.dayGrid}>
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const isoBs = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const isoAd = isoBsToIsoAd(isoBs);
                  const isDayDisabled = Boolean(
                    (effectiveMinAd && isoAd && isoAd < effectiveMinAd) ||
                    (effectiveMaxAd && isoAd && isoAd > effectiveMaxAd)
                  );
                  const isSelected = hasValue && bsForDisplay && bsForDisplay.year === viewYear && bsForDisplay.month === viewMonth && bsForDisplay.day === day;
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                        isDayDisabled && { opacity: 0.25, backgroundColor: "#f3f4f6" },
                      ]}
                      onPress={() => !isDayDisabled && selectDay(day)}
                      disabled={isDayDisabled}
                    >
                      <Text style={[styles.dayText, isSelected && styles.dayTextSelected, isDayDisabled && { color: colors.textMuted }]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.footerRow}>
                {onClear && hasValue ? (
                  <TouchableOpacity
                    style={styles.footerButton}
                    onPress={() => { onClear(); dragY.setValue(0); setOpen(false); }}
                  >
                    <Feather name="x-circle" size={14} color={colors.textMuted} />
                    <Text style={[styles.footerButtonText, { color: colors.textMuted }]}>{t("picker.clear")}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.footerButton} onPress={selectToday}>
                  <Feather name="calendar" size={14} color={colors.primary} />
                  <Text style={styles.footerButtonText}>{t("common.today")}</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Animated.View>
        </Animated.View>
      </Modal>
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
  inputError: { borderColor: colors.danger },
  inputWarning: { borderColor: colors.warning, backgroundColor: "rgba(253,175,34,0.06)" },
  inputDisabled: { opacity: 0.6 },
  valueText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, flex: 1, marginRight: 8 },
  stackedValue: { flex: 1, marginRight: 8 },
  stackedBsText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  stackedAdText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  placeholderText: { color: colors.iconMuted, fontSize: 14 },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 12, marginTop: 4 },
  helperRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  warningText: { color: "#B47300", fontFamily: fonts.medium, fontSize: 12, flex: 1 },
  hintText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12, marginTop: 4 },
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(0,0,0,0.14)",
    paddingHorizontal: 16,
    paddingTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 28,
  },
  handleHitArea: { alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#B0B8C8" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, marginTop: 10, marginBottom: 6 },
  stepperButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: colors.bodyBg },
  stepperValue: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text, minWidth: 90, textAlign: "center" },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", marginBottom: 10 },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  dayCellSelected: { backgroundColor: colors.primary, borderRadius: 999 },
  dayText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  dayTextSelected: { color: "#fff", fontFamily: fonts.semiBold },
  footerRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 },
  footerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 48,
  },
  footerButtonText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.primary },
});

