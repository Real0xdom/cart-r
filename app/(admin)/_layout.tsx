import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

const AdminLayout = () => {
  const { adminSession, isLoading } = useAuth();

  if (isLoading) return null;

  if (!adminSession) {
    return <Redirect href="/(admin-auth)/login" />;
  }

  return (
    <Stack>
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
    </Stack>
  );
};

export default AdminLayout;
