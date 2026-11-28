import { useFirebase } from '@/context/firebase-context';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { authService } from '@dosfilos/application';
import { esSuscripcionDeCortesia } from '@dosfilos/domain';
import { FirebaseUserProfileRepository } from '@dosfilos/infrastructure';
import { toast } from 'sonner';
import { CancelSubscriptionDialog } from '@/components/subscription/dialogs/CancelSubscriptionDialog';
import { PlanChangeDialog } from '@/components/subscription/dialogs/PlanChangeDialog';
import { ReactivateSubscriptionDialog } from '@/components/subscription/dialogs/ReactivateSubscriptionDialog';
import { useTranslation } from '@/i18n';
import { usePlans } from '@/hooks/usePlans';
import { PlanCard } from '@/components/plans';
import { UsageDashboard } from '@/components/usage/UsageDashboard';
import { ProcessingQuotaUsageCard } from '@/components/usage/ProcessingQuotaUsageCard';
import { CortesiaPaymentCard } from '@/components/subscription/CortesiaPaymentCard';

const userProfileRepository = new FirebaseUserProfileRepository();

export default function SubscriptionPage() {
  const { user } = useFirebase();
  const { t } = useTranslation('subscription');
  const { plans, loading: plansLoading } = usePlans();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [planChangeDialogOpen, setPlanChangeDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  // Load user profile with subscription
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const profile = await userProfileRepository.getProfile(user.uid);
        if (profile) setUserProfile(profile);
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleSubscribe = async (priceId: string) => {
    try {
      setLoading(true);
      const { url } = await authService.createCheckoutSession({
        priceId,
        successUrl: `${window.location.origin}/dashboard/settings?tab=subscription&success=true`,
        cancelUrl: `${window.location.origin}/dashboard/settings?tab=subscription&canceled=true`,
      });
      if (url) window.location.href = url;
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast.error(error.message || t('errors.checkoutError'));
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = (plan: any) => {
    setSelectedPlan(plan);
    setPlanChangeDialogOpen(true);
  };

  const handleDialogSuccess = async () => {
    if (!user) return;
    const profile = await userProfileRepository.getProfile(user.uid);
    if (profile) setUserProfile(profile);
  };

  const currentPlanId = userProfile?.subscription?.planId || 'free';
  const isSubscriptionActive = userProfile?.subscription?.status === 'active' || userProfile?.subscription?.status === 'trialing';
  const isSubscriptionCancelled = userProfile?.subscription?.status === 'cancelled';
  const currentPlan = plans.find(p => p.id === currentPlanId);
  const isFreeUser = currentPlanId === 'free';
  // Plan asignado desde el panel, sin Stripe: se paga por el checkout, no se cancela ni se cambia por Stripe.
  const esCortesia = esSuscripcionDeCortesia(userProfile?.subscription);

  // Show loading state
  if (loading || plansLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="mb-8">
          <div className="h-9 w-64 bg-muted animate-pulse rounded mb-2" />
          <div className="h-5 w-96 bg-muted animate-pulse rounded" />
        </div>
        <Card className="mb-8">
          <CardHeader>
            <div className="h-7 w-48 bg-muted animate-pulse rounded mb-2" />
            <div className="h-5 w-64 bg-muted animate-pulse rounded" />
          </CardHeader>
        </Card>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded mb-2" />
                <div className="h-8 w-24 bg-muted rounded" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {/* Usage this month — personal library quotas */}
      <div className="mb-8 space-y-6">
        <UsageDashboard />
        <ProcessingQuotaUsageCard planId={currentPlanId} />
      </div>

      {/* Current Plan Badge */}
      {userProfile?.subscription && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  {t('currentPlan.title')}
                </CardTitle>
                  {isSubscriptionCancelled && (
                    <Badge variant="outline" className="ml-2 text-warning">
                      {t('currentPlan.badges.cancelled')}
                    </Badge>
                  )}
                <CardDescription className="mt-2">
                  {isSubscriptionActive && userProfile.subscription.currentPeriodEnd ? (
                    <>
                      {t('currentPlan.renewalDate')}: {new Date(
                        userProfile.subscription.currentPeriodEnd.seconds 
                          ? userProfile.subscription.currentPeriodEnd.seconds * 1000 
                          : userProfile.subscription.currentPeriodEnd
                      ).toLocaleDateString()}
                    </>
                  ) : isSubscriptionCancelled && userProfile.subscription.endDate ? (
                    <>
                      {t('currentPlan.accessUntil')}: {new Date(
                        userProfile.subscription.endDate.seconds 
                          ? userProfile.subscription.endDate.seconds * 1000 
                          : userProfile.subscription.endDate
                      ).toLocaleDateString()}
                    </>
                  ) : (
                    t('currentPlan.notActive')
                  )}
                </CardDescription>
              </div>
              {isSubscriptionActive && !esCortesia && !isFreeUser && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCancelDialogOpen(true)}
                >
                  {t('currentPlan.cancelButton')}
                </Button>
              )}
              {isSubscriptionCancelled && (
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => setReactivateDialogOpen(true)}
                >
                  {t('currentPlan.reactivateButton')}
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>
      )}

      {esCortesia && currentPlan?.stripePriceIds?.monthly && (
        <CortesiaPaymentCard planName={currentPlan.localizedName} loading={loading} onActivatePayment={() => handleSubscribe(currentPlan.stripePriceIds!.monthly!)} />
      )}

      {/* Free Plan Upgrade Message */}
      {isFreeUser && !isSubscriptionActive && (
        <Card className="mb-8 border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">
              {t('freePlan.upgradeTitle')}
            </CardTitle>
            <CardDescription className="mt-2">
              {t('freePlan.upgradeMessage')}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Paid plans grid — Free is promoted to a standalone CTA below for
          consistency with the public /pricing surface. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans
          .filter((plan) => plan.id !== 'free')
          .map((plan) => {
            const isCurrent = plan.id === currentPlanId;

            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrentPlan={isCurrent}
                onSelect={(planId) => {
                  const selectedPlanData = plans.find(p => p.id === planId);
                  if (!selectedPlanData || isCurrent) return;

                  // If user doesn't have a subscription, create checkout
                  // Gratis también va al checkout: el perfil gratuito nace con status 'active'.
                  if (!userProfile?.subscription || !isSubscriptionActive || esCortesia || isFreeUser) {
                    // Default to monthly billing for now. Swap to a billing-cycle
                    // toggle here when the UI for yearly checkout lands.
                    const priceId = selectedPlanData.stripePriceIds?.monthly;
                    if (priceId) {
                      handleSubscribe(priceId);
                    }
                  } else {
                    // User has active subscription - show change dialog
                    handlePlanChange(selectedPlanData);
                  }
                }}
                loading={loading}
                className=""
              />
            );
          })}
      </div>


      {/* Dialogs */}
      <CancelSubscriptionDialog 
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onSuccess={handleDialogSuccess}
        isTrialing={userProfile?.subscription?.status === 'trialing'}
        trialEndDate={
          userProfile?.subscription?.trialEnd 
            ? new Date(
                userProfile.subscription.trialEnd.seconds 
                  ? userProfile.subscription.trialEnd.seconds * 1000 
                  : userProfile.subscription.trialEnd
              )
            : null
        }
      />

      <PlanChangeDialog
        open={planChangeDialogOpen}
        onOpenChange={setPlanChangeDialogOpen}
        onSuccess={handleDialogSuccess}
        currentPlan={currentPlan}
        newPlan={selectedPlan}
      />

      <ReactivateSubscriptionDialog
        open={reactivateDialogOpen}
        onOpenChange={setReactivateDialogOpen}
        onSuccess={handleDialogSuccess}
        currentPeriodEnd={
          userProfile?.subscription?.endDate 
            ? new Date(
                userProfile.subscription.endDate.seconds 
                  ? userProfile.subscription.endDate.seconds * 1000 
                  : userProfile.subscription.endDate
              )
            : undefined
        }
      />
    </div>
  );
}
