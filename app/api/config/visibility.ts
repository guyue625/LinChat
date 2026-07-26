export type DangerModelConfig = {
  customModels: string;
  defaultModel: string;
  visionModels: string;
};

export function getVisibleDangerConfig<T extends DangerModelConfig>(
  config: T,
  exposeServerModels: boolean,
): T {
  if (exposeServerModels) return config;
  return {
    ...config,
    customModels: "",
    defaultModel: "",
    visionModels: "",
  };
}
