import { View } from "react-native";
import Input from "./Input";
import PrimaryButton from "./PrimaryButton";

type Props = {
  buttonTitle: string;
};

export default function AuthForm({ buttonTitle }: Props) {
  return (
    <View>
      <Input placeholder="Email" keyboardType="email-address" />
      <Input placeholder="Password" secureTextEntry />
      <PrimaryButton title={buttonTitle} />
    </View>
  );
}
