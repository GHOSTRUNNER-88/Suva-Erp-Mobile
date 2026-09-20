import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { createEntity } from "../lib/offline/sync";
import { useScanDraft, scanPartyPrefill } from "../lib/scanDraftReview";
import QuickPartyModal from "../components/QuickPartyModal";
import { isPositiveNumber, isIsoDate, toNumber } from "../lib/documentTotals";
import { describeSubmitError } from "../lib/formErrors";
import { bankAccountLabel } from "../lib/labels";
import { formatNpr } from "../lib/format";
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
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

/**
 * One shared screen for Payment In and Payment Out, keyed by a `type`
 * route param ("in" | "out") — mirrors desktop's single PaymentForm
 * (shared/@spk-reusable-components/suva/payments/payment-form.tsx), which
 * takes the same paymentType prop. Field order matches desktop: date →
 * party → bank account → amount → notes → allocations. Direction is shown as
 * a segmented toggle (desktop reaches the two directions from two menu
 * entries; on mobile a visible toggle keeps a mis-tapped entry recoverable).
 *
 * Desktop's party picker excludes suppliers from Payment In and customers
 * from Payment Out — replicated here over the same GET /api/parties list.
 * partyId 0 = on-account payment with no party (paymentInputSchema's
 * default), which desktop offers as "No party (on-account)".
 *
 * Allocations: paymentInputSchema's `allocations` defaults to [] — an
 * unallocated (on-account) payment is a valid, fully-formed payment the
 * backend accepts. Desktop's per-invoice allocation table needs
 * getOpenDocumentsForParty() (shared/payments/service.ts), which has NO
 * mobile route yet (nothing under app/api/mobile/** exposes it), so this
 * form stays honest: it says so in the Allocations section and always posts
 * allocations: [] — desktop can allocate afterward. Do not fake a list.
 */
export default function CreatePaymentScreen() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const params = useLocalSearchParams();
  const [paymentType, setPaymentType] = useState(params.type === "out" ? "out" : "in");
  const errorNamespaces = ["cashBank"];

  const [allParties, setAllParties] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const [paymentDate, setPaymentDate] = useState(todayIsoAd());
  const [partyId, setPartyId] = useState(null);
  const [bankAccountId, setBankAccountId] = useState(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [openDocs, setOpenDocs] = useState([]);
  const [allocatedAmounts, setAllocatedAmounts] = useState({});
  const [loadingDocs, setLoadingDocs] = useState(false);

  const [quickPartyOpen, setQuickPartyOpen] = useState(false);

  function handlePartyCreated(newParty) {
    setAllParties((prev) => [newParty, ...(prev ?? [])]);
    setPartyId(newParty.id);
  }

  function applyScanPayload(p) {
    if (p.paymentType === "in" || p.paymentType === "out") setPaymentType(p.paymentType);
    if (p.paymentDate && isIsoDate(String(p.paymentDate))) setPaymentDate(String(p.paymentDate));
    if (p.partyId) setPartyId(Number(p.partyId));
    if (p.bankAccountId) setBankAccountId(Number(p.bankAccountId));
    if (p.amount != null && p.amount !== "") setAmount(String(p.amount));
    if (p.notes) setNotes(String(p.notes));
  }
  const scan = useScanDraft(params.scanDocumentId, applyScanPayload);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([apiFetch("/api/parties"), apiFetch("/api/mobile/bank-accounts?activeOnly=true")])
      .then(([parties, accounts]) => {
        if (cancelled) return;
        setAllParties(parties ?? []);
        setBankAccounts(accounts ?? []);
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

  useEffect(() => {
    if (!partyId) {
      setOpenDocs([]);
      setAllocatedAmounts({});
      return;
    }
    let cancelled = false;
    setLoadingDocs(true);
    apiFetch(`/api/mobile/payments/open-documents?type=${paymentType}&partyId=${partyId}`)
      .then((res) => {
        if (cancelled) return;
        const docs = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setOpenDocs(docs);
        setAllocatedAmounts({});
      })
      .catch(() => {
        if (!cancelled) setOpenDocs([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDocs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partyId, paymentType]);

  const excludedType = paymentType === "in" ? "Supplier" : "Customer";
  const parties = allParties.filter((party) => party.type !== excludedType);

  function changeDirection(next) {
    setPaymentType(next);
    // A party that can't take the other direction must not stay silently selected.
    const excluded = next === "in" ? "Supplier" : "Customer";
    const selected = allParties.find((party) => party.id === partyId);
    if (selected && selected.type === excluded) setPartyId(null);
  }

  function resetForm() {
    setPaymentDate(todayIsoAd());
    setPartyId(null);
    setBankAccountId(null);
    setAmount("");
    setNotes("");
    setErrors({});
    setFormError(null);
  }

  function validate() {
    const next = {};
    if (!isIsoDate(paymentDate)) next.paymentDate = t("forms.dateRequired");
    if (!bankAccountId) next.bankAccountId = t("cashBank.bankAccountRequired");
    if (!isPositiveNumber(amount)) next.amount = t("cashBank.amountRequired");
    if (notes.trim().length > 1000) next.notes = t("forms.errors.tooLong");

    const totalAllocated = Object.values(allocatedAmounts).reduce((sum, v) => sum + toNumber(v || 0), 0);
    if (totalAllocated > toNumber(amount) + 0.004) {
      next.amount = t("payments.allocationExceedsAmount", { defaultValue: "Total allocated exceeds payment amount" });
    }
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

    const allocations = Object.entries(allocatedAmounts)
      .filter(([_, val]) => toNumber(val) > 0)
      .map(([docId, val]) => ({
        documentId: Number(docId),
        amount: toNumber(val),
      }));

    const payload = {
      paymentType,
      paymentDate,
      partyId: partyId || 0,
      bankAccountId,
      amount: toNumber(amount),
      notes: notes.trim(),
      allocations,
    };

    setSubmitting(true);
    try {
      const entityType = paymentType === "in" ? "payments_in" : "payments_out";
      const res = await createEntity("/api/mobile/payments", entityType, { ...payload, scanDocumentId: scan.scanId });

      try {
        await scan.consumeDraft();
      } catch {}

      if (res?.queued) {
        showToast(t("offline.savedOffline", { defaultValue: "Saved offline. Will sync once connected." }), "warning");
        router.replace({ pathname: "/payments", params: { type: paymentType } });
        return;
      }

      showToast(paymentType === "in" ? t("cashBank.savedPaymentIn") : t("cashBank.savedPaymentOut"), "success");
      router.replace({ pathname: "/payments", params: { type: paymentType } });
    } catch (err) {
      const described = describeSubmitError(i18n, err, errorNamespaces);
      setErrors(described.fields);
      setFormError(described.formError);
    } finally {
      setSubmitting(false);
    }
  }

  const title = paymentType === "in" ? t("cashBank.paymentInTitle") : t("cashBank.paymentOutTitle");

  return (
    <FormScreen
      title={title}
      loading={loading}
      error={loadError}
      onRetry={load}
      footer={<StickyActionBar primaryLabel={t("cashBank.save")} onPrimary={handleSubmit} loading={submitting} />}
    >
      <ScanDraftBanner draft={scan.draft} onClear={async () => { await scan.clearDraft(); resetForm(); }} />
      <InlineError message={formError} />

      <FormSection title={t("forms.detailsHeading")}>
        <Text style={styles.label}>{t("forms.paymentDirection")}</Text>
        <SegmentedControl
          style={styles.direction}
          value={paymentType}
          onChange={changeDirection}
          options={[
            { value: "in", label: t("cashBank.paymentInTitle") },
            { value: "out", label: t("cashBank.paymentOutTitle") },
          ]}
        />
        <DateField label={t("cashBank.date")} required value={paymentDate} onChange={setPaymentDate} error={errors.paymentDate} restrictToFiscalYear={true} {...scan.fieldProps(t, "paymentDate")} />
        <PickerField
          label={t("cashBank.party")}
          placeholder={t("forms.noParty")}
          value={partyId}
          options={parties}
          onSelect={(party) => setPartyId(party.id)}
          onAddNew={() => setQuickPartyOpen(true)}
          addNewLabel={t("parties.createParty", { defaultValue: "+ Add New Party" })}
          onClear={() => setPartyId(null)}
          error={errors.partyId}
          hint={partyId ? undefined : t("forms.unallocated")}
          {...scan.fieldProps(t, "partyId")}
        />
        <PickerField
          label={t("cashBank.bankAccountField")}
          placeholder={t("cashBank.selectBankAccount")}
          required
          value={bankAccountId}
          options={bankAccounts}
          getLabel={bankAccountLabel}
          onSelect={(account) => setBankAccountId(account.id)}
          error={errors.bankAccountId}
          {...scan.fieldProps(t, "bankAccountId")}
        />
        <FormField
          label={t("cashBank.amount")}
          required
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          prefix={t("sale.discountAmount")}
          error={errors.amount}
          {...scan.fieldProps(t, "amount", "totalAmount")}
        />
        <FormField
          label={t("cashBank.reference")}
          value={notes}
          onChangeText={setNotes}
          placeholder={t("cashBank.referencePlaceholder")}
          error={errors.notes}
          {...scan.fieldProps(t, "notes", "text")}
        />
      </FormSection>

      <FormSection title={t("forms.allocationsTitle")}>
        {!partyId ? (
          <View style={styles.noticeRow}>
            <Feather name="info" size={16} color={colors.iconMuted} />
            <Text style={styles.noticeText}>{t("forms.unallocated")}</Text>
          </View>
        ) : loadingDocs ? (
          <Text style={styles.noticeText}>{t("common.loading", { defaultValue: "Loading invoices..." })}</Text>
        ) : openDocs.length === 0 ? (
          <View style={styles.noticeRow}>
            <Feather name="check-circle" size={16} color={colors.success || "#10b981"} />
            <Text style={styles.noticeText}>{t("payments.noOpenDocs", { defaultValue: "No open invoices/bills for this party. Payment will be on-account." })}</Text>
          </View>
        ) : (
          <View style={styles.allocationsList}>
            {openDocs.map((doc) => {
              const currentAlloc = allocatedAmounts[doc.documentId] ?? "";
              return (
                <View key={doc.documentId} style={styles.allocCard}>
                  <View style={styles.allocHeader}>
                    <View style={styles.allocDocInfo}>
                      <Text style={styles.allocDocNo}>{doc.documentNo}</Text>
                      <Text style={styles.allocDocDate}>{doc.documentDate ? String(doc.documentDate).slice(0, 10) : ""}</Text>
                    </View>
                    <View style={styles.allocDueCol}>
                      <Text style={styles.allocDueLabel}>{t("forms.due", { defaultValue: "Due" })}</Text>
                      <Text style={styles.allocDueAmount}>{formatNpr(doc.dueAmount)}</Text>
                    </View>
                  </View>
                  <View style={styles.allocInputRow}>
                    <FormField
                      style={styles.allocInput}
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={currentAlloc}
                      onChangeText={(val) => setAllocatedAmounts((prev) => ({ ...prev, [doc.documentId]: val }))}
                    />
                    <TouchableOpacity
                      style={styles.fullBtn}
                      onPress={() => setAllocatedAmounts((prev) => ({ ...prev, [doc.documentId]: String(doc.dueAmount) }))}
                    >
                      <Text style={styles.fullBtnText}>{t("payments.full", { defaultValue: "Full" })}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </FormSection>

      <View style={styles.bottomSpacer} />

      <QuickPartyModal
        visible={quickPartyOpen}
        onClose={() => setQuickPartyOpen(false)}
        defaultType={paymentType === "in" ? "Customer" : "Supplier"}
        onPartyCreated={handlePartyCreated}
        prefill={scanPartyPrefill(scan.draft)}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  direction: { marginBottom: 14 },
  noticeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 12 },
  noticeText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  bottomSpacer: { height: 8 },
  allocationsList: { gap: 10 },
  allocCard: { backgroundColor: colors.bodyBg, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.border },
  allocHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  allocDocInfo: { flex: 1 },
  allocDocNo: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  allocDocDate: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  allocDueCol: { alignItems: "flex-end" },
  allocDueLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  allocDueAmount: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.danger },
  allocInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  allocInput: { flex: 1, marginBottom: 0 },
  fullBtn: { backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, justifyContent: "center", alignItems: "center" },
  fullBtnText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primary },
});
