import { Redirect } from 'expo-router';

import SermonPasteScreen from '@/presentation/screens/sermons/SermonPasteScreen';
import { TABLET_EDITING } from '@/core/config/features';

/** Apagado en la v1 (D5): agrega texto al sermón publicado. */
export default function SermonPasteRoute() {
    if (!TABLET_EDITING) return <Redirect href="/(tabs)" />;
    return <SermonPasteScreen />;
}
