import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Cómo borrar la cuenta (B2 de la fase Púlpito premium).
 *
 * Google Play pide, en el formulario de seguridad de datos, una dirección
 * pública donde se explique cómo pedir el borrado de la cuenta y de los datos,
 * aunque no se tenga la app instalada. Esta es esa página. El plazo de gracia
 * es el de `ACCOUNT_DELETION_GRACE_DAYS` en el servidor.
 */
export function DeleteAccountPage() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-12">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft className="h-4 w-4" />
                Volver
            </Link>

            <h1 className="text-3xl font-bold tracking-tight mb-2">Eliminar tu cuenta de Dos Filos Preach</h1>
            <p className="text-sm text-muted-foreground mb-8">
                Puedes pedir que se borre tu cuenta y todos tus datos en cualquier momento.
            </p>

            <div className="prose prose-slate dark:prose-invert max-w-none">
                <h2>Cómo pedirlo</h2>
                <ul>
                    <li>
                        <strong>Desde la app para tablet:</strong> Perfil → «Eliminar mi cuenta».
                    </li>
                    <li>
                        <strong>Por correo:</strong> escribe a{' '}
                        <a href="mailto:privacy@dosfilos.app">privacy@dosfilos.app</a> desde el correo de tu cuenta.
                    </li>
                </ul>

                <h2>Qué pasa después</h2>
                <ul>
                    <li>
                        <strong>En el momento:</strong> tu cuenta se desactiva, se cierran tus sesiones y se cancela tu
                        suscripción.
                    </li>
                    <li>
                        <strong>A los 7 días:</strong> se borran por completo tus sermones, series y planes, estudios y
                        trabajos exegéticos, tu biblioteca y sus archivos, tus marcas, tinta y registros de predicación,
                        y los datos de tu cuenta. Ese plazo existe para poder deshacer un error: si cambias de opinión,
                        escribe al correo de arriba antes de que termine.
                    </li>
                    <li>
                        <strong>Lo que se conserva:</strong> que la cuenta se borró y cuándo (sin tu correo), los
                        registros de auditoría que la seguridad del servicio obliga a guardar, y los comprobantes de
                        pago que conserva el procesador de pagos por obligación legal.
                    </li>
                </ul>
            </div>
        </div>
    );
}
