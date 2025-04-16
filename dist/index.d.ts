import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { RootConfigService, LoggerService } from '@backstage/backend-plugin-api';
import * as _backstage_plugin_scaffolder_node from '@backstage/plugin-scaffolder-node';
import * as _backstage_types_index from '@backstage/types/index';

/** @public */
declare const pagerDutyScaffolderActions: _backstage_backend_plugin_api.BackendFeatureCompat;

type CreatePagerDutyServiceActionProps = {
    config: RootConfigService;
    logger: LoggerService;
};
declare const createPagerDutyServiceAction: (props?: CreatePagerDutyServiceActionProps) => _backstage_plugin_scaffolder_node.TemplateAction<{
    name: string;
    description: string;
    escalationPolicyId: string;
    alertGrouping?: string;
}, _backstage_types_index.JsonObject>;

export { createPagerDutyServiceAction, pagerDutyScaffolderActions as default };
export type { CreatePagerDutyServiceActionProps };
