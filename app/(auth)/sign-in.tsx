import { Redirect } from "expo-router";

// Legacy sign-in page - redirect to welcome screen
const SignIn = () => {
  return <Redirect href="/(auth)/welcome" />;
};

export default SignIn;

