import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { useScanDraft, scanPartyPrefill } from "../lib/scanDraftReview";
import QuickPartyModal from "../components/QuickPartyModal";
import { estimateExpenseTotal, isNonNegativeNumber, isPercent, isIsoDate, toNumber } from "../lib/documentTotals";
import { describeSubmitError } from "../lib/formErrors";
import { bankAccountLabel } from "../lib/labels";
import { todayIsoAd } from "../lib/bs-ad";
import FormScreen, { FormSection } from "../components/ui/FormScreen";
import StickyActionBar from "../components/ui/StickyActionBar";
import FormField from "../components/ui/FormField";
import DateField from "../components/ui/DateField";
import SwitchRow from "../components/ui/SwitchRow";
import MoneySummary from "../components/ui/MoneySummary";
import { InlineError } from "../components/ui/ListStates";
import { useToast } from "../components/ui/Toast";
import PickerField from "../components/PickerField";
import ScanDraftBanner from "../components/ScanDraftBanner";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

/**
 * Fields mirror expenseInputSchema (starterkit/shared/expenses/schema.ts)
 * in desktop's "New Expense" modal order (expenses-view.tsx): party →
 * expense number → date → category → paid-from account → taxable /
 * non-taxable amounts → VAT → total → notes. `description` is the schema's
 * short line (desktop's list shows it under the category), `notes` the long
 * one. Every relation is optional in the schema — desktop requires none of
 * them either — so validation here is only shape (valid date, numbers ≥ 0)
 * plus "some amount was entered".
 *
 * Expense number: still prefilled as EXP-<timestamp> (the one field mobile
 * simplifies vs. desktop's blank required input) but it's editable, so a
 * user who wants desktop's numbering can type it.
 *
 * `partyId` / `amount` / `scanDocumentId` route params come from Scan
 * Receipt; the total shown is a DISPLAY-ONLY estimate — createExpense()
 * computes the real amount server-side (../AGENTS.md §5).
 */
const ERROR_NAMESPACES = ["expenses"];

function defaultExpenseNumber() {
  return `EXP-${Date.now()}`;
}

export default function CreateExpenseScreen() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const params = useLocalSearchParams();

  const [refData, setRefData] = useState({ categories: [], parties: [], bankAccounts: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const [partyId, setPartyId] = useState(params.partyId ? Number(params.partyId) : null);
  const [expenseNumber, setExpenseNumber] = useState(defaultExpenseNumber());
  const [expenseDate, setExpenseDate] = useState(todayIsoAd());
  const [categoryId, setCategoryId] = useState(null);
  const [bankAccountId, setBankAccountId] = useState(null);
  const [taxableAmount, setTaxableAmount] = useState(params.amount ? String(params.amount) : "0");
  const [nonTaxableAmount, setNonTaxableAmount] = useState("0");
  const [isVatApplicable, setIsVatApplicable] = useState(false);
  const [vatPercent, setVatPercent] = useState("13");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const [quickPartyOpen, setQuickPartyOpen] = useState(false);

  function handlePartyCreated(newParty) {
    setRefData((prev) => ({ ...prev, parties: [newParty, ...(prev.parties ?? [])] }));
    setPartyId(newParty.id);
  }

  function applyScanPayload(p) {
    if (p.partyId) setPartyId(Number(p.partyId));
    if (p.expenseNumber) setExpenseNumber(String(p.expenseNumber));
    if (p.expenseDate && isIsoDate(String(p.expenseDate))) setExpenseDate(String(p.expenseDate));
    if (p.categoryId) setCategoryId(Number(p.categoryId));
    if (p.bankAccountId) setBankAccountId(Number(p.bankAccountId));
    if (p.taxableAmount != null) setTaxableAmount(String(p.taxableAmount));
    else if (p.amount != null) setTaxableAmount(String(p.amount));
    if (p.nonTaxableAmount != null) setNonTaxableAmount(String(p.nonTaxableAmount));
    if (p.isVatApplicable != null) setIsVatApplicable(Boolean(p.isVatApplicable));
    if (p.vatPercent != null) setVatPercent(String(p.vatPercent));
    if (p.description) setDescription(String(p.description));
    if (p.notes) setNotes(String(p.notes));
  }
  const scan = useScanDraft(params.scanDocumentId, applyScanPayload);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      apiFetch("/api/mobile/expense-categories").catch(() => []),
      apiFetch("/api/parties"),
      apiFetch("/api/mobile/bank-accounts?activeOnly=true").catch(() => []),
    ])
      .then(([categories, parties, bankAccounts]) => {
        if (cancelled) return;
        setRefData({ categories: categories ?? [], parties: parties ?? [], bankAccounts: bankAccounts ?? [] });
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

  function resetForm() {
    setPartyId(null);
    setExpenseNumber(defaultExpenseNumber());
    setExpenseDate(todayIsoAd());
    setCategoryId(null);
    setBankAccountId(null);
    setTaxableAmount("0");
    setNonTaxableAmount("0");
    setIsVatApplicable(false);
    setVatPercent("13");
    setDescription("");
    setNotes("");
    setErrors({});
    setFormError(null);
  }

  const totals = estimateExpenseTotal({ taxableAmount, nonTaxableAmount, isVatApplicable, vatPercent });

  function validate() {
    const next = {};
    if (!expenseNumber.trim()) next.expenseNumber = t("forms.errors.numberRequired");
    if (!isIsoDate(expenseDate)) next.expenseDate = t("forms.dateRequired");
    if (!isNonNegativeNumber(taxableAmount)) next.taxableAmount = t("forms.amountInvalid");
    if (!isNonNegativeNumber(nonTaxableAmount)) next.nonTaxableAmount = t("forms.amountInvalid");
    if (!next.taxableAmount && !next.nonTaxableAmount && toNumber(taxableAmount) + toNumber(nonTaxableAmount) <= 0) next.taxableAmount = t("forms.amountPositive");
    if (isVatApplicable && !isPercent(vatPercent)) next.vatPercent = t("forms.percentRange");
    if (description.trim().length > 500) next.description = t("forms.errors.tooLong");
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
      expenseNumber: expenseNumber.trim(),
      expenseDate,
      categoryId: categoryId || null,
      partyId: partyId || null,
      bankAccountId: bankAccountId || null,
      description: description.trim(),
      taxableAmount: toNumber(taxableAmount),
      nonTaxableAmount: toNumber(nonTaxableAmount),
      isVatApplicable,
      vatPercent: isVatApplicable ? toNumber(vatPercent) : 0,
      notes: notes.trim(),
    };

    setSubmitting(true);
    try {
      await apiFetch("/api/mobile/expenses", { method: "POST", body: { ...payload, scanDocumentId: scan.scanId } });
      await scan.consumeDraft();
      showToast(t("forms.saved"), "success");
      router.replace("/expenses");
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
      title={t("expenses.createTitle")}
      loading={loading}
      error={loadError}
      onRetry={load}
      footer={<StickyActionBar primaryLabel={t("expenses.save")} onPrimary={handleSubmit} loading={submitting} />}
    >
      <ScanDraftBanner draft={scan.draft} onClear={async () => { await scan.clearDraft(); resetForm(); }} />
      <InlineError message={formError} />

      <FormSection title={t("forms.detailsHeading")}>
        <PickerField
          label={t("expenses.party")}
          placeholder={t("expenses.selectParty")}
          value={partyId}
          options={refData.parties}
          onSelect={(party) => setPartyId(party.id)}
          onAddNew={() => setQuickPartyOpen(true)}
          addNewLabel={t("parties.createParty", { defaultValue: "+ Add New Party" })}
          onClear={() => setPartyId(null)}
          error={errors.partyId}
          {...scan.fieldProps(t, "partyId")}
        />
        <FormField label={t("expenses.expenseNumber")} required value={expenseNumber} onChangeText={setExpenseNumber} error={errors.expenseNumber} autoCapitalize="characters" {...scan.fieldProps(t, "expenseNumber", "number")} />
        <DateField label={t("expenses.expenseDate")} required value={expenseDate} onChange={setExpenseDate} error={errors.expenseDate} restrictToFiscalYear={true} {...scan.fieldProps(t, "expenseDate")} />
        <PickerField
          label={t("expenses.category")}
          placeholder={t("expenses.selectCategory")}
          value={categoryId}
          options={refData.categories}
          onSelect={(category) => setCategoryId(category.id)}
          onClear={() => setCategoryId(null)}
          error={errors.categoryId}
          {...scan.fieldProps(t, "categoryId")}
        />
        <PickerField
          label={t("forms.paidFromAccount")}
          placeholder={t("forms.cashNoBankAccount")}
          value={bankAccountId}
          options={refData.bankAccounts}
          getLabel={bankAccountLabel}
          onSelect={(account) => setBankAccountId(account.id)}
          onClear={() => setBankAccountId(null)}
          error={errors.bankAccountId}
          {...scan.fieldProps(t, "bankAccountId")}
        />
      </FormSection>

      <FormSection title={t("forms.estimatedTotals")}>
        <View style={styles.twoCol}>
          <FormField
            label={t("expenses.taxableAmount")}
            value={taxableAmount}
            onChangeText={setTaxableAmount}
            keyboardType="decimal-pad"
            prefix={t("sale.discountAmount")}
            error={errors.taxableAmount}
            style={styles.col}
            {...scan.fieldProps(t, "taxableAmount", "amount", "totalAmount")}
          />
          <FormField
            label={t("expenses.nonTaxableAmount")}
            value={nonTaxableAmount}
            onChangeText={setNonTaxableAmount}
            keyboardType="decimal-pad"
            prefix={t("sale.discountAmount")}
            error={errors.nonTaxableAmount}
            style={styles.col}
            {...scan.fieldProps(t, "nonTaxableAmount")}
          />
        </View>
        <SwitchRow label={t("expenses.vatApplicable")} value={isVatApplicable} onValueChange={setIsVatApplicable} />
        {isVatApplicable ? (
          <FormField label={t("expenses.vatPercent")} value={vatPercent} onChangeText={setVatPercent} keyboardType="decimal-pad" suffix={t("sale.discountPercent")} error={errors.vatPercent} {...scan.fieldProps(t, "vatPercent")} />
        ) : null}
        <MoneySummary
          rows={[
            { key: "taxable", label: t("expenses.taxableAmount"), value: totals.taxable },
            { key: "nonTaxable", label: t("expenses.nonTaxableAmount"), value: totals.nonTaxable },
            ...(isVatApplicable ? [{ key: "vat", label: `${t("forms.vat")} (${toNumber(vatPercent)}%)`, value: totals.vatAmount }] : []),
          ]}
          totalLabel={t("expenses.amount")}
          totalValue={totals.totalAmount}
          style={styles.totals}
        />
        <Text style={styles.estimateNote}>{t("forms.estimateNote")}</Text>
      </FormSection>

      <FormSection title={t("forms.additionalInformation")}>
        <FormField label={t("expenses.description")} value={description} onChangeText={setDescription} error={errors.description} {...scan.fieldProps(t, "description", "text")} />
        <FormField label={t("forms.notes")} value={notes} onChangeText={setNotes} multiline {...scan.fieldProps(t, "notes")} />
      </FormSection>

      <View style={styles.bottomSpacer} />

      <QuickPartyModal
        visible={quickPartyOpen}
        onClose={() => setQuickPartyOpen(false)}
        defaultType="Supplier"
        onPartyCreated={handlePartyCreated}
        prefill={scanPartyPrefill(scan.draft)}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  twoCol: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  totals: { marginTop: 4, marginBottom: 6 },
  estimateNote: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginBottom: 10 },
  bottomSpacer: { height: 8 },
});
