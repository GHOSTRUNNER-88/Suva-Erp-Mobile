import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { todayIsoAd } from "../lib/bs-ad";
import ScreenHeader from "../components/ui/ScreenHeader";
import StickyActionBar from "../components/ui/StickyActionBar";
import { SkeletonList, ErrorState, EmptyState, InlineError } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

const STATUS_CONFIG = {
  present: { code: "P", labelKey: "payroll.present", color: "#16A34A", bg: "#DCFCE7", border: "#BBF7D0" },
  absent: { code: "A", labelKey: "payroll.absent", color: "#DC2626", bg: "#FEE2E2", border: "#FECACA" },
  leave: { code: "L", labelKey: "payroll.leave", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
  half_day: { code: "H", labelKey: "payroll.halfDay", color: "#7C3AED", bg: "#EDE9FE", border: "#DDD6FE" },
};

const STATUS_KEYS = ["present", "absent", "leave", "half_day"];

export default function AttendanceScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const todayStr = todayIsoAd();

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [employees, setEmployees] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const requestToken = useRef(0);

  const load = useCallback(() => {
    const token = ++requestToken.current;
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch("/api/mobile/payroll/employees?isActive=true").catch(() => []),
      apiFetch(`/api/mobile/payroll/attendance?yearMonth=${selectedMonth}`).catch(() => []),
    ])
      .then(([emps, attRecords]) => {
        if (token !== requestToken.current) return;
        const activeEmps = Array.isArray(emps) ? emps : [];
        setEmployees(activeEmps);

        // Build mapping: employeeId -> { status, overtimeHours } for selectedDate
        const map = {};
        activeEmps.forEach((e) => {
          map[e.id] = { status: "present", overtimeHours: "0" };
        });

        (attRecords || []).forEach((rec) => {
          if (rec.attendanceDate === selectedDate && map[rec.employeeId]) {
            map[rec.employeeId] = {
              status: rec.status || "present",
              overtimeHours: rec.overtimeHours ? String(rec.overtimeHours) : "0",
            };
          }
        });

        setAttendanceMap(map);
      })
      .catch((err) => {
        if (token !== requestToken.current) return;
        setError(err.messageKey ? t(err.messageKey) : err.message);
      })
      .finally(() => {
        if (token !== requestToken.current) return;
        setLoading(false);
      });
  }, [selectedDate, selectedMonth, t]);

  useEffect(() => {
    load();
  }, [load]);

  function handleStatusToggle(empId, nextStatus) {
    setAttendanceMap((prev) => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || {}),
        status: nextStatus,
      },
    }));
  }

  function handleOtChange(empId, text) {
    setAttendanceMap((prev) => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || {}),
        overtimeHours: text,
      },
    }));
  }

  function shiftMonth(delta) {
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(newMonth);
    setSelectedDate(`${newMonth}-01`);
  }

  async function handleBulkSave() {
    if (employees.length === 0) return;
    setSaving(true);
    setFormError(null);

    const records = employees.map((emp) => {
      const att = attendanceMap[emp.id] || { status: "present", overtimeHours: "0" };
      return {
        employeeId: Number(emp.id),
        attendanceDate: selectedDate,
        status: att.status || "present",
        overtimeHours: Number(att.overtimeHours) || 0,
      };
    });

    try {
      await apiFetch("/api/mobile/payroll/attendance", {
        method: "POST",
        body: { records },
      });
      Alert.alert(t("common.save", "Success"), t("payroll.attendanceSaved", "Attendance saved successfully!"));
    } catch (err) {
      setFormError(err.formError || (err.messageKey ? t(err.messageKey) : err.message));
    } finally {
      setSaving(false);
    }
  }

  const listPaddingBottom = Math.max(insets.bottom + 88, 96);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("payroll.attendance", "Attendance")}
        subtitle={selectedDate}
      />

      {/* Month & Date Selector Row */}
      <View style={styles.pickerBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(-1)}>
          <Feather name="chevron-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.monthDisplay}>
          <Text style={styles.monthText}>{selectedMonth}</Text>
          <Text style={styles.dateSubtext}>{selectedDate}</Text>
        </View>
        <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(1)}>
          <Feather name="chevron-right" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <InlineError message={formError} style={styles.inlineErr} />

      {loading ? (
        <View style={styles.content}>
          <SkeletonList rows={6} />
        </View>
      ) : error && employees.length === 0 ? (
        <View style={styles.content}>
          <ErrorState message={error} onRetry={load} />
        </View>
      ) : employees.length === 0 ? (
        <EmptyState
          icon="calendar-check"
          title={t("payroll.noEmployees", "No active employees found")}
          body={t("payroll.noEmployeesDesc", "Please add employees before recording attendance.")}
        />
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.content, { paddingBottom: listPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const att = attendanceMap[item.id] || { status: "present", overtimeHours: "0" };

            return (
              <View style={styles.empCard}>
                <View style={styles.cardTop}>
                  <View style={styles.empInfo}>
                    <Text style={styles.empName}>{item.fullName}</Text>
                    <Text style={styles.empSub}>
                      {item.code} {item.department ? `• ${item.department}` : ""}
                    </Text>
                  </View>
                  <View style={styles.otBox}>
                    <Text style={styles.otLabel}>{t("payroll.overtimeHours", "OT Hrs")}</Text>
                    <TextInput
                      style={styles.otInput}
                      value={att.overtimeHours}
                      onChangeText={(v) => handleOtChange(item.id, v)}
                      keyboardType="numeric"
                      placeholder="0"
                      maxLength={4}
                    />
                  </View>
                </View>

                {/* Day status toggle buttons */}
                <View style={styles.statusGroup}>
                  {STATUS_KEYS.map((key) => {
                    const cfg = STATUS_CONFIG[key];
                    const isSelected = att.status === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.statusBtn,
                          { borderColor: cfg.border },
                          isSelected && { backgroundColor: cfg.color, borderColor: cfg.color },
                        ]}
                        activeOpacity={0.75}
                        onPress={() => handleStatusToggle(item.id, key)}
                      >
                        <Text
                          style={[
                            styles.statusBtnText,
                            { color: cfg.color },
                            isSelected && { color: "#FFFFFF" },
                          ]}
                        >
                          {cfg.code} - {t(cfg.labelKey)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          }}
        />
      )}

      {employees.length > 0 && (
        <StickyActionBar
          primaryLabel={t("payroll.bulkSave", "Save Attendance")}
          onPrimary={handleBulkSave}
          loading={saving}
          style={styles.actionBar}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  pickerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navBtn: {
    padding: 8,
    borderRadius: 8,
  },
  monthDisplay: {
    alignItems: "center",
  },
  monthText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.text,
  },
  dateSubtext: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  inlineErr: { marginHorizontal: 16, marginTop: 10 },
  content: { padding: 16 },

  empCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  empInfo: { flex: 1 },
  empName: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  empSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },

  otBox: {
    alignItems: "center",
  },
  otLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  otInput: {
    width: 54,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: "center",
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bodyBg,
  },

  statusGroup: {
    flexDirection: "row",
    gap: 8,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bodyBg,
  },
  statusBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },

  actionBar: {
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
