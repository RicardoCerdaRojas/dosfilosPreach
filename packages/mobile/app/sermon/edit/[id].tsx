import { Redirect } from 'expo-router';

import SermonEditScreen from '@/presentation/screens/sermons/SermonEditScreen';
import { TABLET_EDITING } from '@/core/config/features';

/** Apagado en la v1 (D5): por enlace directo también se llegaba. */
export default function SermonEditRoute() {
    if (!TABLET_EDITING) return <Redirect href="/(tabs)" />;
    return <SermonEditScreen />;
}
