import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { useScanDraft } from "../lib/scanDraftReview";
import { isIsoDate, isNonNegativeNumber, toNumber } from "../lib/documentTotals";
import { describeSubmitError } from "../lib/formErrors";
import { todayIsoAd } from "../lib/bs-ad";
import FormScreen, { FormSection } from "../components/ui/FormScreen";
import StickyActionBar from "../components/ui/StickyActionBar";
import FormField from "../components/ui/FormField";
import DateField from "../components/ui/DateField";
import SegmentedControl from "../components/ui/SegmentedControl";
import { InlineError } from "../components/ui/ListStates";
import { useToast } from "../components/ui/Toast";
import PickerField from "../components/PickerField";
import ScanDraftBanner from "../components/ScanDraftBanner";

export default function CreateChequeScreen() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const params = useLocalSearchParams();

  const [refData, setRefData] = useState({ parties: [], bankAccounts: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const [chequeType, setChequeType] = useState("received"); // "received" | "issued"
  const [chequeNumber, setChequeNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [chequeDate, setChequeDate] = useState(todayIsoAd());
  const [depositDate, setDepositDate] = useState(todayIsoAd());
  const [partyId, setPartyId] = useState(null);
  const [bankAccountId, setBankAccountId] = useState(null);
  const [bankName, setBankName] = useState("");
  const [notes, setNotes] = useState("");

  // Wires this screen into Scan Document exactly like CreateExpenseScreen/
  // CreatePaymentScreen do — a cheque photographed via Scan Document routes
  // here with `scanDocumentId`, and this hook reads back the mapper's draft
  // (shared/scan-documents/mapper.ts's mapTextractToCheque) and prefills
  // the form. Every setter stays guarded (never a blind overwrite), same
  // convention those two screens use.
  function applyScanPayload(p) {
    if (p.chequeNumber) setChequeNumber(String(p.chequeNumber));
    if (p.chequeDate && isIsoDate(String(p.chequeDate))) setChequeDate(String(p.chequeDate));
    if (p.bankName) setBankName(String(p.bankName));
    if (p.amount != null && p.amount !== "") setAmount(String(p.amount));
    if (p.partyId) setPartyId(Number(p.partyId));
    if (p.notes) setNotes(String(p.notes));
  }
  const scan = useScanDraft(params.scanDocumentId, applyScanPayload);

  function resetForm() {
    setChequeNumber("");
    setAmount("");
    setChequeDate(todayIsoAd());
    setBankName("");
    setNotes("");
  }

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      apiFetch("/api/parties"),
      apiFetch("/api/mobile/bank-accounts?activeOnly=true").catch(() => []),
    ])
      .then(([parties, accounts]) => {
        if (cancelled) return;
        setRefData({
          parties: parties ?? [],
          bankAccounts: accounts ?? [],
        });
        if (accounts && accounts[0]) {
          setBankAccountId(accounts[0].id);
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
    if (!chequeNumber.trim()) next.chequeNumber = t("cheques.numberRequired", { defaultValue: "Cheque number is required" });
    if (!amount || !isNonNegativeNumber(amount) || toNumber(amount) <= 0) next.amount = t("forms.amountInvalid");
    if (!partyId) next.partyId = t("forms.partyRequired", { defaultValue: "Party is required" });
    if (!bankAccountId) next.bankAccountId = t("forms.bankAccountRequired", { defaultValue: "Bank account is required" });
    if (!bankName.trim()) next.bankName = t("cheques.bankNameRequired", { defaultValue: "Cheque bank name is required" });
    if (!isIsoDate(chequeDate)) next.chequeDate = t("forms.dateRequired");
    if (!isIsoDate(depositDate)) next.depositDate = t("forms.dateRequired");

    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError(t("forms.fixErrors"));
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/mobile/cheques", {
        method: "POST",
        body: {
          chequeType,
          chequeCategory: "regular",
          chequeNumber: chequeNumber.trim(),
          amount: toNumber(amount),
          chequeDate,
          depositDate,
          partyId,
          bankAccountId,
          bankName: bankName.trim(),
          notes: notes.trim(),
          scanDocumentId: scan.scanId,
        },
      });
      await scan.consumeDraft();
      showToast(t("cheques.saved", { defaultValue: "Cheque recorded successfully" }), "success");
      router.replace("/cheques");
    } catch (err) {
      const described = describeSubmitError(i18n, err, ["cheques", "forms"]);
      setErrors(described.fields);
      setFormError(described.formError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormScreen
      title={t("cheques.newChequeTitle", { defaultValue: "Record Cheque" })}
      loading={loading}
      error={loadError}
      onRetry={load}
      footer={<StickyActionBar primaryLabel={t("forms.save")} onPrimary={handleSubmit} loading={submitting} />}
    >
      <ScanDraftBanner draft={scan.draft} onClear={async () => { await scan.clearDraft(); resetForm(); }} />
      <InlineError message={formError} />

      <FormSection title={t("cheques.typeHeading", { defaultValue: "Cheque Type" })}>
        <SegmentedControl
          value={chequeType}
          onChange={setChequeType}
          options={[
            { value: "received", label: t("cheques.receivedToggle", { defaultValue: "Cheque Received" }) },
            { value: "issued", label: t("cheques.issuedToggle", { defaultValue: "Cheque Issued" }) },
          ]}
        />
      </FormSection>

      <FormSection title={t("forms.detailsHeading")}>
        <FormField
          label={t("cheques.chequeNumber", { defaultValue: "Cheque Number" })}
          value={chequeNumber}
          onChangeText={setChequeNumber}
          placeholder="e.g. 104523"
          required
          error={errors.chequeNumber}
          {...scan.fieldProps(t, "chequeNumber")}
        />
        <FormField
          label={t("forms.amount")}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="0.00"
          required
          error={errors.amount}
          {...scan.fieldProps(t, "amount", "totalAmount")}
        />
        <PickerField
          label={t("sale.party")}
          placeholder={t("sale.selectParty")}
          required
          value={partyId}
          options={refData.parties}
          onSelect={(p) => setPartyId(p.id)}
          error={errors.partyId}
          {...scan.fieldProps(t, "partyId")}
        />
        <PickerField
          label={t("cashBank.bankAccount", { defaultValue: "Deposit / Issuing Account" })}
          placeholder={t("cashBank.selectAccount", { defaultValue: "Select account" })}
          required
          value={bankAccountId}
          options={refData.bankAccounts.map((a) => ({ id: a.id, name: a.displayName ? `${a.bankName} — ${a.displayName}` : a.bankName }))}
          onSelect={(a) => setBankAccountId(a.id)}
          error={errors.bankAccountId}
        />
        <FormField
          label={t("cheques.bankName", { defaultValue: "Cheque Bank Name" })}
          value={bankName}
          onChangeText={setBankName}
          placeholder="e.g. Nabil Bank, Global IME"
          required
          {...scan.fieldProps(t, "bankName")}
          error={errors.bankName}
        />
        <DateField label={t("cheques.chequeDate", { defaultValue: "Cheque Date" })} required value={chequeDate} onChange={setChequeDate} error={errors.chequeDate} {...scan.fieldProps(t, "chequeDate")} />
        <DateField label={t("cheques.depositDate", { defaultValue: "Deposit Date" })} required value={depositDate} onChange={setDepositDate} error={errors.depositDate} />
      </FormSection>

      <FormSection title={t("forms.notes")}>
        <FormField
          label={t("forms.notes")}
          value={notes}
          onChangeText={setNotes}
          placeholder={t("forms.notesPlaceholder", { defaultValue: "Add notes..." })}
          multiline
          numberOfLines={2}
        />
      </FormSection>
    </FormScreen>
  );
}