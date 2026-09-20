import GenericDocumentDetailScreen from "../../screens/GenericDocumentDetailScreen";
import { useTranslation } from "react-i18next";

export default function SalesQuotationDetailRoute() {
  const { t } = useTranslation();
  return (
    <GenericDocumentDetailScreen
      title={t("salesQuotations.detailTitle", { defaultValue: "Sales Quotation Detail" })}
      endpointPrefix="/api/mobile/sales-quotations"
      editRoutePrefix="/sales-quotations/edit"
      numberKey="quotationNumber"
      dateKey="quotationDate"
      hasPricing={true}
    />
  );
}