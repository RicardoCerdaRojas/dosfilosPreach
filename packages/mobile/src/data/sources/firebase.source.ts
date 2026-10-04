import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, waitForPendingWrites } from '@react-native-firebase/firestore';

// Con @react-native-firebase la app default se inicializa en el arranque
// nativo desde GoogleService-Info.plist / google-services.json — aquí no hay
// initializeApp ni persistencia manual: el SDK nativo trae caché de disco y
// cola de escrituras offline (decisión M-02 del plan Púlpito).

export const getFirebaseApp = () => getApp();
export const getFirebaseAuth = () => getAuth(getApp());
export const getFirebaseDb = () => getFirestore(getApp());

/**
 * ¿Subieron las escrituras pendientes? Espera hasta `ms`.
 *
 * Sin red, el registro de la predicación, la tinta y las marcas quedan en la
 * cola del SDK, y esa cola es del usuario que las escribió: si cierra sesión
 * antes de que suban, se pierden (revisión adversarial de A8).
 */
export async function pendingWritesSynced(ms: number): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), ms);
    });
    try {
        return await Promise.race([
            waitForPendingWrites(getFirebaseDb()).then(() => true),
            deadline,
        ]);
    } finally {
        clearTimeout(timer);
    }
}
