import { useState } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useFirebase } from '@/context/firebase-context';
import { OnboardingWizard } from './OnboardingWizard';

/**
 * Floating help button (bottom-right FAB). Always-available re-entry to the
 * onboarding takeover. Click → opens `OnboardingWizard` starting at the intent
 * picker (skips the welcome step the user has already seen). User can browse
 * each flow's storyboard, then either jump into the flow or close out.
 *
 * Mounted once in DashboardLayout so it's available across the entire
 * authenticated surface.
 */
export function FloatingHelpButton() {
    const { t } = useTranslation('dashboard');
    const { user } = useFirebase();
    const [open, setOpen] = useState(false);

    if (!user) return null;

    return (
        <>
            <motion.button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={t('onboarding.help.fabAria')}
                title={t('onboarding.help.fabAria')}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.5, type: 'spring', stiffness: 200, damping: 18 }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="tour-target-help fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-primary-solid text-primary-foreground shadow-lg hover:shadow-xl flex items-center justify-center print:hidden"
            >
                <HelpCircle className="h-5 w-5" />
            </motion.button>

            <OnboardingWizard
                isOpen={open}
                onClose={() => setOpen(false)}
                startStep="intent"
            />
        </>
    );
}
