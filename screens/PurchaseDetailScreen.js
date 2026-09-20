import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Sharing from "expo-sharing";
import { apiFetch, downloadDocumentPdf } from "../lib/api";
import { recordCrashlyticsError } from "../firebase/crashlytics";
import DocumentDetailView from "../components/documents/DocumentDetailView";

/**
 * Real data via GET /api/mobile/purchase-bills/[id]. Same layout as
 * SaleDetailScreen (components/documents/DocumentDetailView). The mobile
 * purchase-bill API has no cancel/delete route, so only Edit is in "More".
 */
export default function PurchaseDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sharing, setSharing] = useState(false);
  const requestToken = useRef(0);

  const bill = data?.invoice ?? data?.bill ?? null;
  const lines = Array.isArray(data?.lines) ? data.lines : [];

  async function handleShare() {
    if (sharing || !bill) return;
    setSharing(true);
    try {
      const fileName = `${bill.billNumber || "purchase-bill"}.pdf`;
      const uri = await downloadDocumentPdf(`/api/mobile/purchase-bills/${id}/pdf?lang=${i18n.language}`, fileName);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t("sale.shareUnavailable"));
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: fileName });
    } catch (err) {
      recordCrashlyticsError(err, `Purchase bill PDF share failed [code: ${err?.code ?? "unknown"}]`);
      Alert.alert(err?.code === "pdf_generation_failed" ? t("documentDetail.pdfServerError") : t("sale.shareFailed"));
    } finally {
      setSharing(false);
    }
  }

  const load = useCallback(() => {
    const token = ++requestToken.current;
    setLoading(true);
    setError(null);
    apiFetch(`/api/mobile/purchase-bills/${id}`)
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

  const tds = bill?.tdsTypeName
    ? `${bill.tdsTypeCode ? `${bill.tdsTypeCode} · ` : ""}${bill.tdsTypeName}${Number(bill.tdsTypeRatePercent) ? ` (${Number(bill.tdsTypeRatePercent)}%)` : ""}`
    : null;

  const doc = bill
    ? {
        number: bill.billNumber,
        status: bill.status,
        dateAd: bill.billDate,
        dueDateAd: bill.dueDate,
        partyName: bill.supplierName || bill.partyName || t("purchase.cashPurchase", "Cash Purchase"),
        partyRows: [
          { label: t("purchase.supplier", { defaultValue: "Supplier" }), value: bill.partyName },
          { label: t("documentDetail.billingName"), value: bill.supplierName && bill.supplierName !== bill.partyName ? bill.supplierName : null },
          { label: t("common.phone", { defaultValue: "Phone" }), value: bill.partyPhone },
          { label: t("parties.address", { defaultValue: "Address" }), value: bill.supplierAddress },
          { label: t("parties.panNumber", { defaultValue: "PAN Number" }), value: bill.panNumber },
        ],
        detailRows: [
          { label: t("forms.warehouse", { defaultValue: "Warehouse" }), value: bill.warehouseName },
          { label: t("documentDetail.creditTerm"), value: bill.creditTermName },
          { label: t("documentDetail.tds"), value: tds },
        ],
        lines,
        subtotal: bill.subtotal,
        discAmount: bill.discAmount,
        vatPercent: bill.isVatApplicable ? bill.vatPercent : null,
        vatAmount: bill.vatAmount,
        totalAmount: bill.totalAmount,
        settledLabel: t("purchase.paid", { defaultValue: "Paid" }),
        settledAmount: bill.paidAmount,
        dueAmount: bill.dueAmount,
        notes: bill.notes,
      }
    : null;

  return (
    <DocumentDetailView
      title={t("purchase.detailTitle")}
      icon="cart-arrow-down"
      loading={loading}
      error={error}
      onRetry={load}
      doc={doc}
      actions={[{ key: "share", label: t("documentDetail.sharePdf"), icon: "share-2", onPress: handleShare, loading: sharing }]}
      menuActions={[{ key: "edit", label: t("common.edit", { defaultValue: "Edit" }), icon: "edit-2", onPress: () => router.push(`/purchases/edit/${id}`) }]}
    />
  );
}
