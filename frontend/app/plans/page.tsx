import { getPublicPlans, getPublicFreePlan } from "@/actions/billing";
import { PlansPage } from "@/components/dashboard/plans-page";

export default async function PlansRoute() {
  const [{plans,error},freePlan] = await Promise.all([getPublicPlans(),getPublicFreePlan()]);
  return <PlansPage plans={plans} loadError={error} freePlan={freePlan} />;
}
