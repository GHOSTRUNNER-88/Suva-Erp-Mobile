import CreateDocumentScreen from "../../screens/CreateDocumentScreen";
import { useTranslation } from "react-i18next";

export default function PurchaseOrderNewRoute() {
  const { t } = useTranslation();
  return (
    <CreateDocumentScreen
      docType="purchase-orders"
      createTitle={t("purchaseOrders.newTitle", { defaultValue: "New Purchase Order" })}
      editTitle={t("purchaseOrders.editTitle", { defaultValue: "Edit Purchase Order" })}
      endpoint="/api/mobile/purchase-orders"
      partyTypeFilter="Supplier"
      dateFieldProp="orderDate"
      hasPricing={true}
      successRedirectPrefix="/purchase-orders"
    />
  );
}