import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import PickerField from "../components/PickerField";
import { getNepaliFiscalYearStartAd } from "../lib/bs-ad";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

const TYPES = ["Customer", "Supplier", "Both"];
const BALANCE_TYPES = ["Dr", "Cr"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Mirrors starterkit's shared party-form.tsx field-for-field (name, type,
 * partyGroupId, phoneNumber, panNumber, address, openingBalance +
 * openingBalanceType, openingBalanceDate, creditLimit) in the same order.
 * One screen handles both create (POST /api/parties) and edit
 * (PATCH /api/parties/[id]) — same PartyFormValues shape desktop's
 * shared form uses for both modes, so this avoids duplicating the field
 * list twice. Edit mode is entered via /parties/edit/[id] and prefills
 * from the plain GET /api/parties/[id] (bare fields — the same one
 * desktop's own edit flow reads from, getPartyDetail()).
 *
 * `creditTermId` is intentionally omitted here, same reasoning as
 * CreateDealScreen omitting assignedToUserId — no assignable/creditTerm
 * list endpoint exists for mobile yet (desktop's SearchableSelect reads
 * shared/business-settings credit terms, not wired to any
 * app/api/mobile/** route so far). It stays editable from desktop only;
 * the field defaults to null server-side so party create/update still
 * succeeds without it.
 */
export default function CreatePartyScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();
  const isEdit = !!id;

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("Customer");
  const [partyGroupId, setPartyGroupId] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [address, setAddress] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [openingBalanceType, setOpeningBalanceType] = useState("Dr");
  const [openingBalanceDate, setOpeningBalanceDate] = useState(getNepaliFiscalYearStartAd());
  const [creditLimit, setCreditLimit] = useState("0");

  useEffect(() => {
    let cancelled = false;
    const requests = [apiFetch("/api/party-groups").catch(() => [])];
    if (isEdit) requests.push(apiFetch(`/api/parties/${id}`));

    Promise.all(requests)
      .then(([groupsData, party]) => {
        if (cancelled) return;
        setGroups(groupsData ?? []);
        if (party) {
          setName(party.name ?? "");
          setType(party.type ?? "Customer");
          setPartyGroupId(party.partyGroupId ?? null);
          setPhoneNumber(party.phoneNumber ?? "");
          setPanNumber(party.panNumber ?? "");
          setAddress(party.address ?? "");
          setOpeningBalance(String(party.openingBalance ?? 0));
          setOpeningBalanceType(party.openingBalanceType ?? "Dr");
          setOpeningBalanceDate(party.openingBalanceDate ?? getNepaliFiscalYearStartAd());
          setCreditLimit(String(party.creditLimit ?? 0));
        }
      })
      .catch((err) => {
        if (!cancelled) setFormError(err.messageKey ? t(err.messageKey) : err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, t]);

  async function handleSubmit() {
    setFormError(null);
    setErrors({});

    if (!name.trim()) {
      setErrors({ name: t("parties.partyNameRequired") });
      return;
    }

    const payload = {
      name: name.trim(),
      type,
      phoneNumber: phoneNumber.trim(),
      address: address.trim(),
      panNumber: panNumber.trim(),
      partyGroupId,
      openingBalance: Number(openingBalance || 0),
      openingBalanceType,
      openingBalanceDate,
      creditLimit: Number(creditLimit || 0),
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await apiFetch(`/api/parties/${id}`, { method: "PATCH", body: payload });
        router.replace(`/parties/${id}`);
      } else {
        // `/api/parties` returns `{ ok: true, id }` verbatim — lib/api.js's
        // own comment names this route as the reason `raw` exists.
        const result = await apiFetch("/api/parties", { method: "POST", body: payload, raw: true });
        router.replace(result?.id ? `/parties/${result.id}` : "/parties");
      }
    } catch (err) {
      if (err.fieldErrors) {
        const flat = {};
        Object.entries(err.fieldErrors).forEach(([key, messages]) => {
          flat[key] = Array.isArray(messages) ? t(`parties.${messages[0]}`, messages[0]) : messages;
        });
        setErrors(flat);
      } else {
        setFormError(err.messageKey ? t(err.messageKey) : err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top", "left", "right"]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? t("parties.editParty") : t("parties.createParty")}</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>{t("parties.partyName")}</Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                value={name}
                onChangeText={setName}
                placeholder={t("parties.partyNamePlaceholder")}
                placeholderTextColor={colors.iconMuted}
              />
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("parties.partyType")}</Text>
              <View style={styles.chipRow}>
                {TYPES.map((option) => {
                  const active = option === type;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setType(option)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`parties.type${option}`)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <PickerField
              label={t("parties.partyGroup")}
              placeholder={t("parties.selectGroup")}
              value={partyGroupId}
              options={groups}
              onSelect={(group) => setPartyGroupId(group.id)}
              error={errors.partyGroupId}
            />

            <View style={styles.field}>
              <Text style={styles.label}>{t("parties.phone")}</Text>
              <TextInput
                style={[styles.input, errors.phoneNumber && styles.inputError]}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
              {errors.phoneNumber ? <Text style={styles.errorText}>{errors.phoneNumber}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("parties.panNumber")}</Text>
              <TextInput
                style={[styles.input, errors.panNumber && styles.inputError]}
                value={panNumber}
                onChangeText={setPanNumber}
                autoCapitalize="characters"
              />
              {errors.panNumber ? <Text style={styles.errorText}>{errors.panNumber}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("parties.address")}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={2}
              />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.rowField, { flex: 1.4 }]}>
                <Text style={styles.label}>{t("parties.openingBalance")}</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={openingBalance} onChangeText={setOpeningBalance} />
              </View>
              <View style={styles.rowField}>
                <Text style={styles.label}> </Text>
                <View style={styles.chipRow}>
                  {BALANCE_TYPES.map((option) => {
                    const active = option === openingBalanceType;
                    return (
                      <TouchableOpacity
                        key={option}
                        style={[styles.chip, styles.chipCompact, active && styles.chipActive]}
                        onPress={() => setOpeningBalanceType(option)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`parties.${option.toLowerCase()}`)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <Text style={[styles.hint, { marginTop: 6, marginBottom: 8 }]}>
              {t("parties.openingBalanceFiscalYearHint", { defaultValue: "Opening balance is anchored to Nepali fiscal year start (साउन १)." })}
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>{t("parties.creditLimit")}</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={creditLimit} onChangeText={setCreditLimit} />
              <Text style={styles.hint}>{t("parties.creditLimitHint")}</Text>
            </View>
          </View>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>{t("parties.save")}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bodyBg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 8 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontFamily: fonts.semiBold, fontSize: 16, color: colors.text, textAlign: "center" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 15,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  field: { marginBottom: 14 },
  label: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  textArea: { minHeight: 60, textAlignVertical: "top" },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 12, marginTop: 4 },
  hint: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 6 },
  row: { flexDirection: "row", gap: 10 },
  rowField: { flex: 1, marginBottom: 14 },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 10, alignItems: "center" },
  chipCompact: { paddingVertical: 12 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textMuted },
  chipTextActive: { color: "#fff" },
  formError: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
    backgroundColor: "rgba(255,103,87,0.08)",
    borderRadius: 10,
    paddingVertical: 8,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  submitButtonText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 15 },
});
