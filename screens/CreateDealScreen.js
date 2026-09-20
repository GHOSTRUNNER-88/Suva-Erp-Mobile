import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { isNonNegativeNumber, isIsoDate, toNumber } from "../lib/documentTotals";
import { describeSubmitError } from "../lib/formErrors";
import FormScreen, { FormSection } from "../components/ui/FormScreen";
import StickyActionBar from "../components/ui/StickyActionBar";
import FormField from "../components/ui/FormField";
import DateField from "../components/ui/DateField";
import SwitchRow from "../components/ui/SwitchRow";
import { InlineError } from "../components/ui/ListStates";
import { useToast } from "../components/ui/Toast";
import PickerField from "../components/PickerField";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

const STAGES = ["New", "Qualified", "Proposal", "Won", "Lost"];

/**
 * Fields mirror dealInputSchema (starterkit/shared/crm/schema.ts): title,
 * partyId ("Deal Contact"), leadSourceId, expectedRevenue,
 * expectedClosingDate (optional ISO date — picked through the shared
 * BS/AD DateField, clearable), isPrivate, stage. Still skips
 * assignedToUserId — that needs an assignable-users list endpoint that
 * doesn't exist for mobile yet; it stays editable on desktop after creation.
 * `description` is optional in the schema and included here as a plain
 * multiline field.
 */
const ERROR_NAMESPACES = ["crm"];

export default function CreateDealScreen() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [refData, setRefData] = useState({ parties: [], leadSources: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const [title, setTitle] = useState("");
  const [partyId, setPartyId] = useState(null);
  const [leadSourceId, setLeadSourceId] = useState(null);
  const [stage, setStage] = useState("New");
  const [expectedRevenue, setExpectedRevenue] = useState("");
  const [expectedClosingDate, setExpectedClosingDate] = useState(null);
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([apiFetch("/api/parties"), apiFetch("/api/mobile/lead-sources").catch(() => [])])
      .then(([parties, leadSources]) => {
        if (cancelled) return;
        setRefData({ parties: parties ?? [], leadSources: leadSources ?? [] });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.messageKey && i18n.exists(err.messageKey) ? t(err.messageKey) : t("forms.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [i18n, t]);

  useEffect(() => load(), [load]);

  function validate() {
    const next = {};
    if (!title.trim()) next.title = t("crm.titleRequired");
    else if (title.trim().length > 255) next.title = t("forms.errors.dealTitleTooLong");
    if (!partyId) next.partyId = t("crm.contactRequired");
    if (expectedRevenue.trim() && !isNonNegativeNumber(expectedRevenue)) next.expectedRevenue = t("forms.amountInvalid");
    if (expectedClosingDate && !isIsoDate(expectedClosingDate)) next.expectedClosingDate = t("forms.dateInvalid");
    if (description.trim().length > 4000) next.description = t("forms.errors.dealDescriptionTooLong");
    return next;
  }

  async function handleSubmit() {
    if (submitting) return;
    setFormError(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError(t("forms.fixErrors"));
      return;
    }

    const payload = {
      title: title.trim(),
      partyId,
      leadSourceId: leadSourceId || null,
      stage,
      expectedRevenue: expectedRevenue.trim() ? toNumber(expectedRevenue) : null,
      expectedClosingDate: expectedClosingDate || null,
      description: description.trim(),
      isPrivate,
    };

    setSubmitting(true);
    try {
      const result = await apiFetch("/api/mobile/deals", { method: "POST", body: payload });
      showToast(t("forms.saved"), "success");
      router.replace(`/deals/${result.id}`);
    } catch (err) {
      const described = describeSubmitError(i18n, err, ERROR_NAMESPACES);
      setErrors(described.fields);
      setFormError(described.formError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormScreen
      title={t("crm.createTitle")}
      loading={loading}
      error={loadError}
      onRetry={load}
      footer={<StickyActionBar primaryLabel={t("forms.save")} onPrimary={handleSubmit} loading={submitting} />}
    >
      <InlineError message={formError} />

      <FormSection title={t("forms.detailsHeading")}>
        <FormField label={t("crm.dealTitle")} required value={title} onChangeText={setTitle} placeholder={t("crm.dealTitlePlaceholder")} error={errors.title} />
        <PickerField
          label={t("crm.contact")}
          placeholder={t("crm.selectContact")}
          required
          value={partyId}
          options={refData.parties}
          onSelect={(party) => setPartyId(party.id)}
          error={errors.partyId}
        />
        <PickerField
          label={t("crm.leadSource")}
          placeholder={t("crm.selectLeadSource")}
          value={leadSourceId}
          options={refData.leadSources}
          onSelect={(source) => setLeadSourceId(source.id)}
          onClear={() => setLeadSourceId(null)}
          error={errors.leadSourceId}
        />
        <FormField
          label={t("crm.expectedRevenue")}
          value={expectedRevenue}
          onChangeText={setExpectedRevenue}
          keyboardType="decimal-pad"
          prefix={t("sale.discountAmount")}
          error={errors.expectedRevenue}
        />
        <DateField
          label={t("crm.expectedClosingDate")}
          value={expectedClosingDate}
          onChange={setExpectedClosingDate}
          onClear={() => setExpectedClosingDate(null)}
          placeholder={t("picker.optional")}
          error={errors.expectedClosingDate}
        />
        <SwitchRow label={t("crm.isPrivate")} value={isPrivate} onValueChange={setIsPrivate} />
      </FormSection>

      <FormSection title={t("crm.stage")}>
        <View style={styles.stageRow} accessibilityRole="radiogroup">
          {STAGES.map((option) => {
            const active = option === stage;
            return (
              <Pressable
                key={option}
                style={({ pressed }) => [styles.stageChip, active && styles.stageChipActive, pressed && !active && styles.stageChipPressed]}
                onPress={() => setStage(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.stageChipText, active && styles.stageChipTextActive]}>{t(`crm.stage${option}`)}</Text>
              </Pressable>
            );
          })}
        </View>
      </FormSection>

      <FormSection title={t("forms.additionalInformation")}>
        <FormField label={t("forms.description")} value={description} onChangeText={setDescription} multiline error={errors.description} />
      </FormSection>

      <View style={styles.bottomSpacer} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  stageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  stageChip: { minHeight: 40, justifyContent: "center", borderWidth: 1.5, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 16 },
  stageChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stageChipPressed: { backgroundColor: "rgba(152,95,253,0.08)" },
  stageChipText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textMuted },
  stageChipTextActive: { color: "#fff" },
  bottomSpacer: { height: 8 },
});
