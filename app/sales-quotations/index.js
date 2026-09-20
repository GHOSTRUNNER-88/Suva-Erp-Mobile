import DocumentListScreen from "../../screens/DocumentListScreen";
import { useTranslation } from "react-i18next";

export default function SalesQuotationsListRoute() {
  const { t } = useTranslation();
  return (
    <DocumentListScreen
      title={t("salesQuotations.title", { defaultValue: "Sales Quotations" })}
      endpoint="/api/mobile/sales-quotations"
      numberKey="quotationNumber"
      dateKey="quotationDate"
      detailRoutePrefix="/sales-quotations"
      createRoute="/sales-quotations/new"
      emptyTitle={t("salesQuotations.empty", { defaultValue: "No quotations yet" })}
    />
  );
}