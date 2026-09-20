import DocumentListScreen from "../../screens/DocumentListScreen";
import { useTranslation } from "react-i18next";

export default function DeliveryChallansListRoute() {
  const { t } = useTranslation();
  return (
    <DocumentListScreen
      title={t("deliveryChallans.title", { defaultValue: "Delivery Challans" })}
      endpoint="/api/mobile/delivery-challans"
      numberKey="challanNumber"
      dateKey="challanDate"
      hasAmount={false}
      detailRoutePrefix="/delivery-challans"
      createRoute="/delivery-challans/new"
      emptyTitle={t("deliveryChallans.empty", { defaultValue: "No delivery challans yet" })}
    />
  );
}