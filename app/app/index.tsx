import 'react-native-get-random-values';
import { useEffect } from 'react';
import { SpaceScreen } from '@/src/screens/SpaceScreen';
import { initializeDatabase } from '@/src/db/migrations';

export default function Page() {
  useEffect(() => {
    initializeDatabase();
  }, []);

  return <SpaceScreen />;
}