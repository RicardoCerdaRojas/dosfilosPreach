type Locale = 'es' | 'en';
type Mode = 'standard' | 'premium';

interface Copy {
    titleStandard: string;
    titlePremium: string;
    subjectStandard: string;
    subjectPremium: string;
    greeting: (name: string) => string;
    leadStandard: (used: number, quota: number, pct: number) => string;
    leadPremium: (used: number, quota: number, pct: number) => string;
    body: string;
    whatHappens: string;
    whatHappensBody: string;
    upgradeCta: string;
    packCta: string;
    closing: string;
    helpHint: string;
    unsubscribe: string;
}

const COPY: Record<Locale, Copy> = {
    es: {
        titleStandard: 'Te quedan pocas páginas estándar',
        titlePremium: 'Te quedan pocas páginas premium',
        subjectStandard: 'Llegaste al 80% de tu cuota estándar este mes',
        subjectPremium: 'Llegaste al 80% de tu cuota premium este mes',
        greeting: (n) => `Hola ${n},`,
        leadStandard: (used, quota, pct) =>
            `Ya usaste <strong>${used.toLocaleString()} de ${quota.toLocaleString()} páginas estándar</strong> incluidas en tu plan este mes (${pct}%).`,
        leadPremium: (used, quota, pct) =>
            `Ya usaste <strong>${used.toLocaleString()} de ${quota.toLocaleString()} páginas premium</strong> incluidas en tu plan este mes (${pct}%).`,
        body: 'Tu cuota se renueva al inicio del próximo ciclo de facturación. Si necesitas seguir procesando documentos antes de eso, puedes comprar un pack prepago — las páginas no caducan en 12 meses.',
        whatHappens: '¿Qué pasa si llego al 100%?',
        whatHappensBody: 'No bloqueamos tu acceso a la app — solo te impedimos extraer documentos nuevos hasta que se renueve tu plan o compres un pack. Tu biblioteca, sermones, y tutores siguen funcionando normal.',
        upgradeCta: 'Mejorar mi plan',
        packCta: 'Comprar pack desde $3',
        closing: 'Si tienes preguntas sobre tu uso, puedes ver el detalle en tu suscripción.',
        helpHint: 'No te enviaremos otro aviso hasta el próximo ciclo.',
        unsubscribe: 'Darse de baja',
    },
    en: {
        titleStandard: 'Your standard pages are running low',
        titlePremium: 'Your premium pages are running low',
        subjectStandard: 'You hit 80% of your monthly standard quota',
        subjectPremium: 'You hit 80% of your monthly premium quota',
        greeting: (n) => `Hi ${n},`,
        leadStandard: (used, quota, pct) =>
            `You've used <strong>${used.toLocaleString()} of ${quota.toLocaleString()} standard pages</strong> included in your plan this month (${pct}%).`,
        leadPremium: (used, quota, pct) =>
            `You've used <strong>${used.toLocaleString()} of ${quota.toLocaleString()} premium pages</strong> included in your plan this month (${pct}%).`,
        body: 'Your quota resets at the next billing cycle. If you need to keep processing documents in the meantime, you can grab a prepaid pack — pack pages don\'t expire for 12 months.',
        whatHappens: 'What happens at 100%?',
        whatHappensBody: 'We don\'t block your access — we just stop new document extractions until your plan renews or you grab a pack. Your library, sermons, and tutors keep working as normal.',
        upgradeCta: 'Upgrade my plan',
        packCta: 'Buy pack from $3',
        closing: 'For details on your usage, check your subscription page.',
        helpHint: 'We won\'t send another warning until the next cycle.',
        unsubscribe: 'Unsubscribe',
    },
};

export const getQuotaWarningSubject = (mode: Mode, locale: Locale = 'es'): string =>
    mode === 'standard' ? COPY[locale].subjectStandard : COPY[locale].subjectPremium;

export const getQuotaWarningTemplate = (
    name: string,
    mode: Mode,
    used: number,
    quota: number,
    dashboardUrl: string,
    locale: Locale = 'es',
) => {
    const c = COPY[locale];
    const title = mode === 'standard' ? c.titleStandard : c.titlePremium;
    const pct = quota > 0 ? Math.round((used / quota) * 100) : 0;
    const lead = mode === 'standard'
        ? c.leadStandard(used, quota, pct)
        : c.leadPremium(used, quota, pct);
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .alert { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 4px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 4px; }
        .button-secondary { display: inline-block; padding: 12px 24px; background-color: #fff; color: #4f46e5; text-decoration: none; border: 1px solid #4f46e5; border-radius: 6px; font-weight: bold; margin: 4px; }
        .help-hint { font-size: 12px; color: #888; text-align: center; margin-top: 8px; }
        .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>DosFilos.Preach</h1>
        </div>

        <h2>${c.greeting(name)}</h2>

        <div class="alert">
            <p style="margin: 0;">${lead}</p>
        </div>

        <p>${c.body}</p>

        <h3>${c.whatHappens}</h3>
        <p>${c.whatHappensBody}</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}/subscription" class="button">${c.upgradeCta}</a>
            <a href="${dashboardUrl}/library" class="button-secondary">${c.packCta}</a>
            <div class="help-hint">${c.helpHint}</div>
        </div>

        <p>${c.closing}</p>

        <div class="footer">
            <p>© ${new Date().getFullYear()} DosFilos.Preach</p>
            <p><a href="${dashboardUrl}/settings">${c.unsubscribe}</a></p>
        </div>
    </div>
</body>
</html>
    `.trim();
};
