import { Redirect } from 'expo-router';

/**
 * Profile stack index: redirect to the main profile tab so /profile shows the same content as the Profile tab.
 */
export default function ProfileIndex() {
  return <Redirect href="/(tabs)/profile" />;
}
