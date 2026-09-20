import CreateDocumentScreen from "../../screens/CreateDocumentScreen";
import { useTranslation } from "react-i18next";

export default function SalesOrderNewRoute() {
  const { t } = useTranslation();
  return (
    <CreateDocumentScreen
      docType="sales-orders"
      createTitle={t("salesOrders.newTitle", { defaultValue: "New Sales Order" })}
      editTitle={t("salesOrders.editTitle", { defaultValue: "Edit Sales Order" })}
      endpoint="/api/mobile/sales-orders"
      partyTypeFilter="Customer"
      dateFieldProp="orderDate"
      hasPricing={true}
      successRedirectPrefix="/sales-orders"
    />
  );
}