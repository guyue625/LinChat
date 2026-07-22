import { shouldRequireLogin, type AccountSnapshot } from "./account-utils";

export async function runWithAccountLogin(
  account: AccountSnapshot,
  onRequireLogin: () => Promise<void> | void,
  action: () => Promise<void> | void,
) {
  if (shouldRequireLogin(account)) {
    await onRequireLogin();
    return false;
  }
  await action();
  return true;
}
