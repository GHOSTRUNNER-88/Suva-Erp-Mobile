import DocumentListScreen from "../../screens/DocumentListScreen";
import { useTranslation } from "react-i18next";

export default function SalesOrdersListRoute() {
  const { t } = useTranslation();
  return (
    <DocumentListScreen
      title={t("salesOrders.title", { defaultValue: "Sales Orders" })}
      endpoint="/api/mobile/sales-orders"
      numberKey="orderNumber"
      dateKey="orderDate"
      detailRoutePrefix="/sales-orders"
      createRoute="/sales-orders/new"
      emptyTitle={t("salesOrders.empty", { defaultValue: "No sales orders yet" })}
    />
  );
}