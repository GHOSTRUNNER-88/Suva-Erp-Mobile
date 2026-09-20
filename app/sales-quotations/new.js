import CreateDocumentScreen from "../../screens/CreateDocumentScreen";
import { useTranslation } from "react-i18next";

export default function SalesQuotationNewRoute() {
  const { t } = useTranslation();
  return (
    <CreateDocumentScreen
      docType="sales-quotations"
      createTitle={t("salesQuotations.newTitle", { defaultValue: "New Quotation" })}
      editTitle={t("salesQuotations.editTitle", { defaultValue: "Edit Quotation" })}
      endpoint="/api/mobile/sales-quotations"
      partyTypeFilter="Customer"
      dateFieldProp="quotationDate"
      hasPricing={true}
      successRedirectPrefix="/sales-quotations"
    />
  );
}