import { getPublicPlans } from "@/actions/billing";
import { PlansPage } from "@/components/dashboard/plans-page";

export default async function PricingRoute() {
  const { plans, error } = await getPublicPlans();
  return <PlansPage plans={plans} loadError={error} />;
}
