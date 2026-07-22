export function shouldRejectAccountRequest(input: {
  accountAuthEnabled: boolean;
  hasAccountUser: boolean;
  needLegacyCode: boolean;
  hasValidLegacyCode: boolean;
  hasApiKey: boolean;
}) {
  if (input.accountAuthEnabled) {
    return !input.hasAccountUser;
  }
  return input.needLegacyCode && !input.hasValidLegacyCode && !input.hasApiKey;
}
