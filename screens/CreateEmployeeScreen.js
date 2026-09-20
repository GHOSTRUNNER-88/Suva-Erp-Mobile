import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { isNonNegativeNumber } from "../lib/documentTotals";
import FormScreen, { FormSection } from "../components/ui/FormScreen";
import StickyActionBar from "../components/ui/StickyActionBar";
import FormField from "../components/ui/FormField";
import DateField from "../components/ui/DateField";
import SwitchRow from "../components/ui/SwitchRow";
import { InlineError } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

export default function CreateEmployeeScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [fullNameNe, setFullNameNe] = useState("");
  const [code, setCode] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [joinDate, setJoinDate] = useState(null);
  const [baseSalary, setBaseSalary] = useState("");
  const [allowances, setAllowances] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (isEditing) {
      setLoading(true);
      apiFetch(`/api/mobile/payroll/employees/${id}`)
        .then((emp) => {
          if (!emp) return;
          setFullName(emp.fullName || "");
          setFullNameNe(emp.fullNameNe || "");
          setCode(emp.code || "");
          setDepartment(emp.department || "");
          setDesignation(emp.designation || "");
          setPanNumber(emp.panNumber || "");
          setBankName(emp.bankName || "");
          setBankAccountNumber(emp.bankAccountNumber || "");
          setPhoneNumber(emp.phoneNumber || "");
          setEmail(emp.email || "");
          setJoinDate(emp.joinDate || null);
          setBaseSalary(emp.baseSalary ? String(emp.baseSalary) : "");
          setAllowances(emp.allowances ? String(emp.allowances) : "");
          setIsActive(emp.isActive === 1 || emp.status === "active");
        })
        .catch((err) => {
          setFormError(err?.messageKey ? t(err.messageKey) : err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id, isEditing, t]);

  function validate() {
    const next = {};
    if (!fullName.trim()) next.fullName = t("payroll.fullNameEn", "Full Name (English) is required");
    if (baseSalary.trim() && !isNonNegativeNumber(baseSalary)) {
      next.baseSalary = t("forms.amountInvalid", "Please enter a valid amount");
    }
    if (allowances.trim() && !isNonNegativeNumber(allowances)) {
      next.allowances = t("forms.amountInvalid", "Please enter a valid amount");
    }
    if (email.trim() && !/\S+@\S+\.\S+/.test(email.trim())) {
      next.email = t("auth.emailInvalid", "Invalid email address");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSubmitting(true);
    setFormError(null);

    const payload = {
      code: code.trim(),
      fullName: fullName.trim(),
      fullNameNe: fullNameNe.trim() || null,
      department: department.trim() || null,
      designation: designation.trim() || null,
      panNumber: panNumber.trim() || null,
      bankName: bankName.trim() || null,
      bankAccountNumber: bankAccountNumber.trim() || null,
      phoneNumber: phoneNumber.trim() || null,
      email: email.trim() || null,
      joinDate: joinDate || null,
      baseSalary: Number(baseSalary) || 0,
      allowances: Number(allowances) || 0,
      isActive: isActive ? 1 : 0,
    };

    try {
      if (isEditing) {
        await apiFetch(`/api/mobile/payroll/employees/${id}`, {
          method: "PUT",
          body: payload,
        });
        Alert.alert(t("common.save", "Saved"), t("payroll.employeeDetails", "Employee updated successfully"), [
          { text: t("common.close", "OK"), onPress: () => router.back() },
        ]);
      } else {
        await apiFetch("/api/mobile/payroll/employees", {
          method: "POST",
          body: payload,
        });
        Alert.alert(t("common.save", "Saved"), t("payroll.employeeDetails", "Employee created successfully"), [
          { text: t("common.close", "OK"), onPress: () => router.back() },
        ]);
      }
    } catch (err) {
      if (err.fieldErrors) {
        setErrors(err.fieldErrors);
      }
      setFormError(err.formError || (err.messageKey ? t(err.messageKey) : err.message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormScreen
      title={isEditing ? t("payroll.editEmployee", "Edit Employee") : t("payroll.addEmployee", "Add Employee")}
      subtitle={fullName || t("payroll.title", "Payroll")}
      loading={loading}
      footer={
        <StickyActionBar
          primaryLabel={isEditing ? t("payroll.updateEmployee", "Update Employee") : t("payroll.saveEmployee", "Save Employee")}
          onPrimary={handleSave}
          loading={submitting}
          onSecondary={() => router.back()}
        />
      }
    >
      <InlineError message={formError} />

      {/* Personal Information */}
      <FormSection title={t("payroll.personalInfo", "Personal Information")}>
        <FormField
          label={t("payroll.fullNameEn", "Full Name (English)")}
          required
          value={fullName}
          onChangeText={(v) => {
            setFullName(v);
            if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: null }));
          }}
          placeholder="e.g. Ramesh Kumar Adhikari"
          error={errors.fullName}
        />
        <FormField
          label={t("payroll.fullNameNe", "Full Name (Nepali)")}
          value={fullNameNe}
          onChangeText={setFullNameNe}
          placeholder="उदा. रमेश कुमार अधिकारी"
        />
        <FormField
          label={t("payroll.phone", "Phone Number")}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="98XXXXXXXX"
          keyboardType="phone-pad"
        />
        <FormField
          label={t("payroll.email", "Email Address")}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
          }}
          placeholder="ramesh@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
        />
      </FormSection>

      {/* Employment Details */}
      <FormSection title={t("payroll.employmentInfo", "Employment Details")}>
        <FormField
          label={t("payroll.employeeCode", "Employee Code")}
          value={code}
          onChangeText={setCode}
          placeholder={t("common.loading", "Auto-generated if blank (e.g. EMP-001)")}
        />
        <FormField
          label={t("payroll.department", "Department")}
          value={department}
          onChangeText={setDepartment}
          placeholder="e.g. Accounts / Sales / IT"
        />
        <FormField
          label={t("payroll.designation", "Designation")}
          value={designation}
          onChangeText={setDesignation}
          placeholder="e.g. Senior Accountant"
        />
        <DateField
          label={t("payroll.joinDate", "Join Date")}
          value={joinDate}
          onChange={setJoinDate}
          placeholder={t("common.selectDate", "Select Date")}
          onClear={() => setJoinDate(null)}
        />
        <SwitchRow
          label={t("payroll.status", "Status")}
          subtitle={isActive ? t("payroll.active", "Active") : t("payroll.inactive", "Inactive")}
          value={isActive}
          onValueChange={setIsActive}
        />
      </FormSection>

      {/* Salary & Banking Details */}
      <FormSection title={t("payroll.financialInfo", "Salary & Banking")}>
        <FormField
          label={t("payroll.baseSalary", "Base Salary (NPR)")}
          value={baseSalary}
          onChangeText={(v) => {
            setBaseSalary(v);
            if (errors.baseSalary) setErrors((prev) => ({ ...prev, baseSalary: null }));
          }}
          placeholder="0.00"
          keyboardType="numeric"
          prefix="Rs."
          error={errors.baseSalary}
        />
        <FormField
          label={t("payroll.allowances", "Allowances (NPR)")}
          value={allowances}
          onChangeText={(v) => {
            setAllowances(v);
            if (errors.allowances) setErrors((prev) => ({ ...prev, allowances: null }));
          }}
          placeholder="0.00"
          keyboardType="numeric"
          prefix="Rs."
          error={errors.allowances}
        />
        <FormField
          label={t("payroll.panNumber", "PAN Number")}
          value={panNumber}
          onChangeText={setPanNumber}
          placeholder="e.g. 600123456"
          keyboardType="numeric"
        />
        <FormField
          label={t("payroll.bankName", "Bank Name")}
          value={bankName}
          onChangeText={setBankName}
          placeholder="e.g. Nabil Bank Ltd."
        />
        <FormField
          label={t("payroll.bankAccount", "Bank Account Number")}
          value={bankAccountNumber}
          onChangeText={setBankAccountNumber}
          placeholder="e.g. 01201017500123"
        />
      </FormSection>
    </FormScreen>
  );
}
