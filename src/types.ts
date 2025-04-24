export type CreateServiceResponse = {
  id: string;
  url: string;
  alertGrouping: string;
};

import { Logger } from 'winston';
import { Config } from '@backstage/config';

export type PluginEnvironment = {
  logger: Logger;
  config: Config;
};
