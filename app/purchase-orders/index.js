import DocumentListScreen from "../../screens/DocumentListScreen";
import { useTranslation } from "react-i18next";

export default function PurchaseOrdersListRoute() {
  const { t } = useTranslation();
  return (
    <DocumentListScreen
      title={t("purchaseOrders.title", { defaultValue: "Purchase Orders" })}
      endpoint="/api/mobile/purchase-orders"
      numberKey="orderNumber"
      dateKey="orderDate"
      detailRoutePrefix="/purchase-orders"
      createRoute="/purchase-orders/new"
      emptyTitle={t("purchaseOrders.empty", { defaultValue: "No purchase orders yet" })}
    />
  );
}