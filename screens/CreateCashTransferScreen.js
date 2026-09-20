import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { isIsoDate, isNonNegativeNumber, toNumber } from "../lib/documentTotals";
import { describeSubmitError } from "../lib/formErrors";
import { todayIsoAd } from "../lib/bs-ad";
import FormScreen, { FormSection } from "../components/ui/FormScreen";
import StickyActionBar from "../components/ui/StickyActionBar";
import FormField from "../components/ui/FormField";
import DateField from "../components/ui/DateField";
import { InlineError } from "../components/ui/ListStates";
import { useToast } from "../components/ui/Toast";
import PickerField from "../components/PickerField";

export default function CreateCashTransferScreen() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const [transferDate, setTransferDate] = useState(todayIsoAd());
  const [fromBankAccountId, setFromBankAccountId] = useState(null);
  const [toBankAccountId, setToBankAccountId] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    apiFetch("/api/mobile/bank-accounts?activeOnly=true")
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setAccounts(list.map((a) => ({ id: a.id, name: a.displayName ? `${a.bankName} — ${a.displayName}` : a.bankName })));
        if (list.length >= 2) {
          setFromBankAccountId(list[0].id);
          setToBankAccountId(list[1].id);
        } else if (list.length === 1) {
          setFromBankAccountId(list[0].id);
        }
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

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit() {
    if (submitting) return;
    setFormError(null);
    const next = {};
    if (!isIsoDate(transferDate)) next.transferDate = t("forms.dateRequired");
    if (!fromBankAccountId) next.fromBankAccountId = t("cashTransfers.fromAccountRequired", { defaultValue: "Source account is required" });
    if (!toBankAccountId) next.toBankAccountId = t("cashTransfers.toAccountRequired", { defaultValue: "Destination account is required" });
    if (fromBankAccountId && toBankAccountId && fromBankAccountId === toBankAccountId) {
      next.toBankAccountId = t("cashTransfers.sameAccountError", { defaultValue: "Source and destination accounts must be different" });
    }
    if (!amount || !isNonNegativeNumber(amount) || toNumber(amount) <= 0) next.amount = t("forms.amountInvalid");

    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError(t("forms.fixErrors"));
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/mobile/cash-transfers", {
        method: "POST",
        body: {
          transferDate,
          fromBankAccountId,
          toBankAccountId,
          amount: String(toNumber(amount).toFixed(2)),
          note: note.trim(),
        },
      });
      showToast(t("cashTransfers.saved", { defaultValue: "Transfer completed successfully" }), "success");
      router.replace("/cash-transfers");
    } catch (err) {
      const described = describeSubmitError(i18n, err, ["cashTransfers", "forms"]);
      setErrors(described.fields);
      setFormError(described.formError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormScreen
      title={t("cashTransfers.newTitle", { defaultValue: "Transfer Funds" })}
      loading={loading}
      error={loadError}
      onRetry={load}
      footer={<StickyActionBar primaryLabel={t("forms.save")} onPrimary={handleSubmit} loading={submitting} />}
    >
      <InlineError message={formError} />

      <FormSection title={t("forms.detailsHeading")}>
        <DateField label={t("common.date")} required value={transferDate} onChange={setTransferDate} error={errors.transferDate} />
        <PickerField
          label={t("cashTransfers.fromAccount", { defaultValue: "From Account" })}
          placeholder={t("cashBank.selectAccount")}
          required
          value={fromBankAccountId}
          options={accounts}
          onSelect={(a) => setFromBankAccountId(a.id)}
          error={errors.fromBankAccountId}
        />
        <PickerField
          label={t("cashTransfers.toAccount", { defaultValue: "To Account" })}
          placeholder={t("cashBank.selectAccount")}
          required
          value={toBankAccountId}
          options={accounts.filter((a) => a.id !== fromBankAccountId)}
          onSelect={(a) => setToBankAccountId(a.id)}
          error={errors.toBankAccountId}
        />
        <FormField
          label={t("forms.amount")}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="0.00"
          required
          error={errors.amount}
        />
      </FormSection>

      <FormSection title={t("forms.notes")}>
        <FormField
          label={t("forms.notes")}
          value={note}
          onChangeText={setNote}
          placeholder={t("forms.notesPlaceholder", { defaultValue: "Transfer remarks..." })}
          multiline
          numberOfLines={2}
        />
      </FormSection>
    </FormScreen>
  );
}