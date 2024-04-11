import { createBackendModule } from "@backstage/backend-plugin-api";
import { scaffolderActionsExtensionPoint } from "@backstage/plugin-scaffolder-node/alpha";
import { createPagerDutyServiceAction } from "./actions/custom";

/** @public */
export const pagerDutyScaffolderActions = createBackendModule({
    pluginId: 'scaffolder',
    moduleId: 'custom-extensions',
    register(env) {
        env.registerInit({
            deps: {
                scaffolder: scaffolderActionsExtensionPoint,
            },
            async init({ scaffolder }) {
                scaffolder.addActions(createPagerDutyServiceAction());
            },
        });
    },
});