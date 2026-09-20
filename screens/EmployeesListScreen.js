import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import SearchToolbar from "../components/ui/SearchToolbar";
import BottomFAB from "../components/ui/BottomFAB";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

export default function EmployeesListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestToken = useRef(0);

  const load = useCallback((isRefresh = false) => {
    const token = ++requestToken.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    apiFetch("/api/mobile/payroll/employees")
      .then((data) => {
        if (token !== requestToken.current) return;
        setEmployees(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (token !== requestToken.current) return;
        setError(err.messageKey ? t(err.messageKey) : err.message);
      })
      .finally(() => {
        if (token !== requestToken.current) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, [t]);

  useEffect(() => {
    load(false);
  }, [load]);

  const departments = useMemo(() => {
    const set = new Set();
    employees.forEach((emp) => {
      if (emp.department?.trim()) set.add(emp.department.trim());
    });
    return ["ALL", ...Array.from(set)];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((emp) => {
      const matchesDept = selectedDept === "ALL" || (emp.department && emp.department.trim() === selectedDept);
      if (!matchesDept) return false;
      if (!q) return true;
      return (
        (emp.fullName && emp.fullName.toLowerCase().includes(q)) ||
        (emp.fullNameNe && emp.fullNameNe.toLowerCase().includes(q)) ||
        (emp.code && emp.code.toLowerCase().includes(q)) ||
        (emp.department && emp.department.toLowerCase().includes(q)) ||
        (emp.designation && emp.designation.toLowerCase().includes(q)) ||
        (emp.phoneNumber && emp.phoneNumber.toLowerCase().includes(q))
      );
    });
  }, [employees, search, selectedDept]);

  const listPaddingBottom = Math.max(insets.bottom + 88, 96);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("payroll.employees", "Employees")}
        subtitle={`${employees.length} ${t("payroll.employees", "Employees")}`}
      />

      <View style={styles.searchWrap}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("payroll.searchEmployees", "Search employees by name, code, phone...")}
        />
      </View>

      {departments.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabs}
        >
          {departments.map((dept) => {
            const isSelected = selectedDept === dept;
            const label = dept === "ALL" ? t("payroll.allDepartments", "All Departments") : dept;
            return (
              <TouchableOpacity
                key={dept}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                activeOpacity={0.7}
                onPress={() => setSelectedDept(dept)}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading && !refreshing ? (
        <View style={styles.content}>
          <SkeletonList rows={6} />
        </View>
      ) : error && employees.length === 0 ? (
        <View style={styles.content}>
          <ErrorState message={error} onRetry={() => load(false)} />
        </View>
      ) : (
        <FlatList
          data={filteredEmployees}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.content, { paddingBottom: listPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={
            <EmptyState
              icon="account-group-outline"
              title={t("payroll.noEmployees", "No employees found")}
              body={t("payroll.noEmployeesDesc", "Get started by adding your first employee.")}
              actionLabel={t("payroll.addEmployee", "Add Employee")}
              onAction={() => router.push("/payroll/employees/new")}
            />
          }
          renderItem={({ item }) => {
            const isActive = item.isActive === 1 || item.status === "active";
            const baseSalary = Number(item.baseSalary || 0);

            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.75}
                onPress={() => router.push(`/payroll/employees/${item.id}`)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>{item.code}</Text>
                  </View>
                  <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
                    <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextInactive]}>
                      {isActive ? t("payroll.active", "Active") : t("payroll.inactive", "Inactive")}
                    </Text>
                  </View>
                </View>

                <Text style={styles.empName}>{item.fullName}</Text>
                {item.fullNameNe ? <Text style={styles.empNameNe}>{item.fullNameNe}</Text> : null}

                <View style={styles.metaRow}>
                  {item.designation ? (
                    <Text style={styles.metaText}>{item.designation}</Text>
                  ) : null}
                  {item.department ? (
                    <Text style={styles.metaText}> • {item.department}</Text>
                  ) : null}
                </View>

                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.salaryLabel}>{t("payroll.baseSalary", "Base Salary")}</Text>
                    <Text style={styles.salaryValue}>{formatNpr(baseSalary)}</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.iconMuted} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <BottomFAB
        label={t("payroll.addEmployee", "Add Employee")}
        icon="plus"
        onPress={() => router.push("/payroll/employees/new")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  filterTabs: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
  },
  content: { padding: 16 },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  codeBadge: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: "#7C3AED",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: "#DCFCE7",
  },
  statusInactive: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  statusTextActive: {
    color: "#16A34A",
  },
  statusTextInactive: {
    color: "#DC2626",
  },

  empName: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.text,
  },
  empNameNe: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  metaText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  salaryLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  salaryValue: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
    marginTop: 1,
  },
});
