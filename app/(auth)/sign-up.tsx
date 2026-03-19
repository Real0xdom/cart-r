import { Redirect } from "expo-router";

// Legacy sign-up page - redirect to welcome screen
const SignUp = () => {
  return <Redirect href="/(auth)/welcome" />;
};

export default SignUp;
