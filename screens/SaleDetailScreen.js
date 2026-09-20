import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Sharing from "expo-sharing";
import { apiFetch, downloadDocumentPdf } from "../lib/api";
import { recordCrashlyticsError } from "../firebase/crashlytics";
import { useModuleAccess } from "../lib/orgSession";
import DocumentDetailView from "../components/documents/DocumentDetailView";

/** Real data via GET /api/mobile/sales-invoices/[id] — returns {invoice, lines}. */
export default function SaleDetailScreen() {
  const { t, i18n } = useTranslation();
  const canSee = useModuleAccess();
  const { id } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const requestToken = useRef(0);

  const invoice = data?.invoice ?? null;
  const lines = Array.isArray(data?.lines) ? data.lines : [];

  /**
   * Mirrors desktop's "Send Payment Reminder via WhatsApp" button on the
   * same screen (shared/@spk-reusable-components/suva/whatsapp/whatsapp-
   * payment-reminder-button.tsx — AGENTS.md §1: same flow, mobile just
   * skips the template picker, see that route's own doc comment for why).
   */
  async function handleSendWhatsapp() {
    if (sendingWhatsapp || !invoice) return;
    setSendingWhatsapp(true);
    try {
      await apiFetch(`/api/mobile/sales-invoices/${id}/whatsapp-reminder`, { method: "POST", body: {} });
      Alert.alert(t("sale.whatsappSent"));
    } catch (err) {
      const fallback = t("sale.whatsappFailed");
      Alert.alert(err.messageKey ? t(err.messageKey, { defaultValue: fallback }) : fallback);
    } finally {
      setSendingWhatsapp(false);
    }
  }

  async function handleShare() {
    if (sharing || !invoice) return;
    setSharing(true);
    try {
      const fileName = `${invoice.invoiceNumber || "invoice"}.pdf`;
      const uri = await downloadDocumentPdf(`/api/mobile/sales-invoices/${id}/pdf?lang=${i18n.language}`, fileName);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t("sale.shareUnavailable"));
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: fileName });
    } catch (err) {
      recordCrashlyticsError(err, `Sales invoice PDF share failed [code: ${err?.code ?? "unknown"}]`);
      Alert.alert(err?.code === "pdf_generation_failed" ? t("documentDetail.pdfServerError") : t("sale.shareFailed"));
    } finally {
      setSharing(false);
    }
  }

  function confirmCancel() {
    Alert.alert(t("sale.cancelConfirmTitle"), t("sale.cancelConfirmBody"), [
      { text: t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
      { text: t("sale.cancelInvoice"), style: "destructive", onPress: handleCancel },
    ]);
  }

  async function handleCancel() {
    if (cancelling) return;
    setCancelling(true);
    try {
      await apiFetch(`/api/mobile/sales-invoices/${id}/cancel`, { method: "POST", body: {} });
      load();
    } catch (err) {
      Alert.alert(t("sale.cancelFailed"));
    } finally {
      setCancelling(false);
    }
  }

  function confirmDelete() {
    const body = invoice && invoice.status === "cancelled" ? t("sale.deleteConfirmBody") : t("sale.deleteFullUndoWarning");
    Alert.alert(t("sale.deleteConfirmTitle"), body, [
      { text: t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
      { text: t("sale.deleteInvoice"), style: "destructive", onPress: handleDelete },
    ]);
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/mobile/sales-invoices/${id}`, { method: "DELETE" });
      router.back();
    } catch (err) {
      Alert.alert(t("sale.deleteFailed"));
      setDeleting(false);
    }
  }

  const load = useCallback(() => {
    const token = ++requestToken.current;
    setLoading(true);
    setError(null);
    apiFetch(`/api/mobile/sales-invoices/${id}`)
      .then((result) => {
        if (token !== requestToken.current) return;
        setData(result ?? null);
      })
      .catch((err) => {
        if (token !== requestToken.current) return;
        setError(err.messageKey ? t(err.messageKey) : err.message);
      })
      .finally(() => {
        if (token !== requestToken.current) return;
        setLoading(false);
      });
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const cancelled = invoice?.status === "cancelled";
  const dueAmount = Number(invoice?.dueAmount ?? 0);

  const doc = invoice
    ? {
        number: invoice.invoiceNumber,
        status: invoice.status,
        dateAd: invoice.invoiceDate,
        dueDateAd: invoice.dueDate,
        partyName: invoice.billingName || invoice.partyName || t("sale.cashSale", "Cash Sale"),
        partyRows: [
          { label: t("sale.party", { defaultValue: "Party" }), value: invoice.partyName },
          { label: t("documentDetail.billingName"), value: invoice.billingName && invoice.billingName !== invoice.partyName ? invoice.billingName : null },
          { label: t("common.phone", { defaultValue: "Phone" }), value: invoice.partyPhone },
          { label: t("parties.address", { defaultValue: "Address" }), value: invoice.billingAddress },
          { label: t("parties.panNumber", { defaultValue: "PAN Number" }), value: invoice.panNumber },
        ],
        detailRows: [
          { label: t("forms.warehouse", { defaultValue: "Warehouse" }), value: invoice.warehouseName },
          { label: t("documentDetail.creditTerm"), value: invoice.creditTermName },
        ],
        lines,
        subtotal: invoice.subtotal,
        discAmount: invoice.discAmount,
        vatPercent: invoice.isVatApplicable ? invoice.vatPercent : null,
        vatAmount: invoice.vatAmount,
        totalAmount: invoice.totalAmount,
        settledLabel: t("sale.received", { defaultValue: "Received" }),
        settledAmount: invoice.receivedAmount,
        dueAmount: invoice.dueAmount,
        notes: invoice.notes,
      }
    : null;

  const actions = [
    { key: "share", label: t("documentDetail.sharePdf"), icon: "share-2", onPress: handleShare, loading: sharing },
    ...(!cancelled && dueAmount > 0 && canSee("whatsapp")
      ? [{ key: "whatsapp", label: t("documentDetail.whatsapp"), icon: "message-circle", variant: "secondary", onPress: handleSendWhatsapp, loading: sendingWhatsapp }]
      : []),
  ];

  const menuActions = [
    { key: "edit", label: t("common.edit", { defaultValue: "Edit" }), icon: "edit-2", onPress: () => router.push(`/sales/edit/${id}`) },
    ...(!cancelled ? [{ key: "cancel", label: t("sale.cancelInvoice"), icon: "x-circle", destructive: true, onPress: confirmCancel, loading: cancelling }] : []),
    // Full undo of the invoice's creation — the backend cancels it first if
    // still live (reverses stock + posts the offsetting entry), then removes it.
    { key: "delete", label: t("sale.deleteInvoice"), icon: "trash-2", destructive: true, onPress: confirmDelete, loading: deleting },
  ];

  return (
    <DocumentDetailView
      title={t("sale.detailTitle")}
      icon="point-of-sale"
      loading={loading}
      error={error}
      onRetry={load}
      doc={doc}
      actions={actions}
      menuActions={menuActions}
    />
  );
}
