'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var zod = require('zod');
var fetch$1 = require('node-fetch');
var backstagePluginCommon = require('@pagerduty/backstage-plugin-common');
var backendCommon = require('@backstage/backend-common');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch$1);

let authPersistence;
let isLegacyConfig$1 = false;
let _config$1;
let _legacyConfig$1;
let _logger$1;
async function checkForOAuthToken(tokenId) {
  if (authPersistence.accountTokens[tokenId]?.authToken !== "" && authPersistence.accountTokens[tokenId]?.authToken.includes("Bearer")) {
    if (authPersistence.accountTokens[tokenId].authTokenExpiryDate > Date.now()) {
      return true;
    }
    _logger$1.info("OAuth token expired, renewing");
    await loadAuthConfig({
      config: _config$1,
      legacyConfig: _legacyConfig$1,
      logger: _logger$1
    });
    return authPersistence.accountTokens[tokenId].authTokenExpiryDate > Date.now();
  }
  return false;
}
async function getAuthToken(accountId) {
  if (!authPersistence?.accountTokens) {
    _logger$1.debug("Auth config not loaded. Loading auth config...");
    await loadAuthConfig({
      config: _config$1,
      legacyConfig: _legacyConfig$1,
      logger: _logger$1
    });
  }
  if (isLegacyConfig$1) {
    _logger$1.debug("Using legacy config for auth token retrieval.");
    if (authPersistence.accountTokens.default.authToken !== "" && (await checkForOAuthToken("default") || authPersistence.accountTokens.default.authToken.includes("Token"))) {
      return authPersistence.accountTokens.default.authToken;
    }
  } else {
    _logger$1.debug("Using new config for auth token retrieval.");
    if (accountId && accountId !== "") {
      if (authPersistence.accountTokens[accountId]?.authToken !== "" && (await checkForOAuthToken(accountId) || authPersistence.accountTokens[accountId]?.authToken.includes("Token"))) {
        return authPersistence.accountTokens[accountId].authToken;
      }
    } else {
      const defaultFallback = authPersistence.defaultAccount ?? "";
      _logger$1.debug("No account ID provided. Using default account token.");
      if (authPersistence.accountTokens[defaultFallback]?.authToken !== "" && (await checkForOAuthToken(defaultFallback) || authPersistence.accountTokens[defaultFallback]?.authToken.includes(
        "Token"
      ))) {
        return authPersistence.accountTokens[defaultFallback].authToken;
      }
    }
  }
  return "";
}
async function loadAuthConfig({
  config,
  legacyConfig,
  logger
}) {
  try {
    const defaultAccountId = "default";
    _config$1 = config;
    _legacyConfig$1 = legacyConfig;
    _logger$1 = logger;
    authPersistence = {
      accountTokens: {},
      config: _config$1,
      legacyConfig: _legacyConfig$1,
      logger: _logger$1
    };
    if (!readOptionalObject$1("pagerDuty.accounts")) {
      isLegacyConfig$1 = true;
      logger.warn(
        "No PagerDuty accounts configuration found in config file. Reverting to legacy configuration."
      );
      if (!readOptionalString$1("pagerDuty.apiToken")) {
        logger.warn(
          "No PagerDuty API token found in config file. Trying OAuth token instead..."
        );
        if (!readOptionalObject$1("pagerDuty.oauth")) {
          logger.error(
            "No PagerDuty OAuth configuration found in config file."
          );
        } else if (!readOptionalString$1("pagerDuty.oauth.clientId") || !readOptionalString$1("pagerDuty.oauth.clientSecret") || !readOptionalString$1("pagerDuty.oauth.subDomain")) {
          logger.error(
            "Missing required PagerDuty OAuth parameters in config file. 'clientId', 'clientSecret', and 'subDomain' are required. 'region' is optional."
          );
        } else {
          const tokenInfo = await getOAuthToken(
            readString$1("pagerDuty.oauth.clientId"),
            readString$1("pagerDuty.oauth.clientSecret"),
            readString$1("pagerDuty.oauth.subDomain"),
            readOptionalString$1("pagerDuty.oauth.region") ?? "us"
          );
          authPersistence.accountTokens[defaultAccountId] = tokenInfo;
          logger.debug("PagerDuty OAuth configuration loaded successfully.");
        }
      } else {
        authPersistence.accountTokens[defaultAccountId] = {
          authToken: `Token token=${readOptionalString$1("pagerDuty.apiToken")}`,
          authTokenExpiryDate: Date.now() + 36e5 * 24 * 365 * 2
          // 2 years
        };
        logger.debug("PagerDuty API token loaded successfully.");
      }
    } else {
      logger.debug(
        "New PagerDuty accounts configuration found in config file."
      );
      isLegacyConfig$1 = false;
      const accounts = JSON.parse(
        JSON.stringify(readOptionalObject$1("pagerDuty.accounts"))
      );
      if (accounts && accounts?.length === 1) {
        logger.debug(
          "Only one account found in config file. Setting it as default."
        );
        authPersistence.defaultAccount = accounts[0].id;
      }
      await Promise.all(
        accounts?.map(async (account) => {
          const maskedAccountId = maskString(account.id);
          if (account.isDefault && !authPersistence.defaultAccount) {
            logger.debug(
              `Default account found in config file. Setting it as default.`
            );
            authPersistence.defaultAccount = account.id;
          }
          if (!account.apiToken) {
            logger.warn(
              "No PagerDuty API token found in config file. Trying OAuth token instead..."
            );
            if (!account.oauth) {
              logger.error(
                "No PagerDuty OAuth configuration found in config file."
              );
            } else if (!account.oauth.clientId || !account.oauth.clientSecret || !account.oauth.subDomain) {
              logger.error(
                "Missing required PagerDuty OAuth parameters in config file. 'clientId', 'clientSecret', and 'subDomain' are required. 'region' is optional."
              );
            } else {
              const tokenInfo = await getOAuthToken(
                account.oauth.clientId,
                account.oauth.clientSecret,
                account.oauth.subDomain,
                account.oauth.region ?? "us"
              );
              authPersistence.accountTokens[account.id] = tokenInfo;
              logger.debug(
                `PagerDuty OAuth configuration loaded successfully for account ${maskedAccountId}.`
              );
            }
          } else {
            authPersistence.accountTokens[account.id] = {
              authToken: `Token token=${account.apiToken}`,
              authTokenExpiryDate: Date.now() + 36e5 * 24 * 365 * 2
              // 2 years
            };
            logger.debug(
              `PagerDuty API token loaded successfully for account ${maskedAccountId}.`
            );
          }
        })
      );
      if (!authPersistence.defaultAccount) {
        logger.error(
          "No default account found in config file. One account must be marked as default."
        );
      }
    }
  } catch (error) {
    logger.error(
      `Unable to retrieve valid PagerDuty AUTH configuration from config file: ${error}`
    );
  }
}
function readOptionalString$1(key) {
  if (!_config$1) {
    return _legacyConfig$1.getOptionalString(key);
  }
  return _config$1.getOptionalString(key);
}
function readOptionalObject$1(key) {
  if (!_config$1) {
    return _legacyConfig$1.getOptional(key);
  }
  return _config$1.getOptional(key);
}
function readString$1(key) {
  if (!_config$1) {
    return _legacyConfig$1.getString(key);
  }
  return _config$1.getString(key);
}
async function getOAuthToken(clientId, clientSecret, subDomain, region) {
  if (!clientId || !clientSecret || !subDomain) {
    throw new Error("Missing required PagerDuty OAuth parameters.");
  }
  const scopes = `
        abilities.read 
        analytics.read
        change_events.read 
        escalation_policies.read 
        incidents.read 
        oncalls.read 
        schedules.read 
        services.read 
        services.write 
        standards.read
        teams.read 
        users.read 
        vendors.read
    `;
  const urlencoded = new URLSearchParams();
  urlencoded.append("grant_type", "client_credentials");
  urlencoded.append("client_id", clientId);
  urlencoded.append("client_secret", clientSecret);
  urlencoded.append("scope", `as_account-${region}.${subDomain} ${scopes}`);
  let response;
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: urlencoded
  };
  const baseUrl = "https://identity.pagerduty.com/oauth/token";
  try {
    response = await fetch(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to retrieve oauth token: ${error}`);
  }
  switch (response.status) {
    case 400:
      throw new backstagePluginCommon.HttpError(
        "Failed to retrieve valid token. Bad Request - Invalid arguments provided.",
        400
      );
    case 401:
      throw new backstagePluginCommon.HttpError(
        "Failed to retrieve valid token. Forbidden - Invalid credentials provided.",
        401
      );
  }
  const authResponse = await response.json();
  const result = {
    authToken: `Bearer ${authResponse.access_token}`,
    authTokenExpiryDate: Date.now() + authResponse.expires_in * 1e3
  };
  return result;
}
function maskString(str) {
  return str[0] + "*".repeat(str.length - 2) + str.slice(-1);
}

const EndpointConfig = {};
let fallbackEndpointConfig;
let isLegacyConfig = false;
let _config;
let _legacyConfig;
let _logger;
function setFallbackEndpointConfig(account) {
  fallbackEndpointConfig = {
    eventsBaseUrl: account.eventsBaseUrl !== void 0 ? account.eventsBaseUrl : "https://events.pagerduty.com/v2",
    apiBaseUrl: account.apiBaseUrl !== void 0 ? account.apiBaseUrl : "https://api.pagerduty.com"
  };
}
function insertEndpointConfig(account) {
  EndpointConfig[account.id] = {
    eventsBaseUrl: account.eventsBaseUrl !== void 0 ? account.eventsBaseUrl : "https://events.pagerduty.com/v2",
    apiBaseUrl: account.apiBaseUrl !== void 0 ? account.apiBaseUrl : "https://api.pagerduty.com"
  };
}
function loadPagerDutyEndpointsFromConfig({
  config,
  legacyConfig,
  logger
}) {
  _config = config;
  _legacyConfig = legacyConfig;
  _logger = logger;
  if (readOptionalObject("pagerDuty.accounts")) {
    _logger.debug(
      `New accounts configuration detected. Loading PagerDuty endpoints from config.`
    );
    isLegacyConfig = false;
    const accounts = JSON.parse(
      JSON.stringify(readOptionalObject("pagerDuty.accounts"))
    );
    if (accounts?.length === 1) {
      _logger.debug(
        `Single account configuration detected. Loading PagerDuty endpoints from config to 'default'.`
      );
      EndpointConfig.default = {
        eventsBaseUrl: accounts[0].eventsBaseUrl !== void 0 ? accounts[0].eventsBaseUrl : "https://events.pagerduty.com/v2",
        apiBaseUrl: accounts[0].apiBaseUrl !== void 0 ? accounts[0].apiBaseUrl : "https://api.pagerduty.com"
      };
    } else {
      _logger.debug(
        `Multiple account configuration detected. Loading PagerDuty endpoints from config.`
      );
      accounts?.forEach((account) => {
        if (account.isDefault) {
          setFallbackEndpointConfig(account);
        }
        insertEndpointConfig(account);
      });
    }
  } else {
    _logger.debug(`Loading legacy PagerDuty endpoints from config.`);
    isLegacyConfig = true;
    EndpointConfig.default = {
      eventsBaseUrl: readOptionalString("pagerDuty.eventsBaseUrl") !== void 0 ? readString("pagerDuty.eventsBaseUrl") : "https://events.pagerduty.com/v2",
      apiBaseUrl: readOptionalString("pagerDuty.apiBaseUrl") !== void 0 ? readString("pagerDuty.apiBaseUrl") : "https://api.pagerduty.com"
    };
  }
}
function getApiBaseUrl(account) {
  if (isLegacyConfig === true) {
    return EndpointConfig.default.apiBaseUrl;
  }
  if (account) {
    return EndpointConfig[account].apiBaseUrl;
  }
  return fallbackEndpointConfig.apiBaseUrl;
}
async function createService({
  name,
  description,
  escalationPolicyId,
  account,
  alertGrouping
}) {
  let alertGroupingParameters = "null";
  let response;
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services`;
  let body = JSON.stringify({
    service: {
      type: "service",
      name,
      description,
      alert_creation: "create_alerts_and_incidents",
      auto_pause_notifications_parameters: {
        enabled: true,
        timeout: 300
      },
      escalation_policy: {
        id: escalationPolicyId,
        type: "escalation_policy_reference"
      }
    }
  });
  if (await isEventNoiseReductionEnabled(account) && alertGrouping !== void 0) {
    alertGroupingParameters = alertGrouping;
    switch (alertGroupingParameters) {
      case "intelligent":
        body = JSON.stringify({
          service: {
            type: "service",
            name,
            description,
            escalation_policy: {
              id: escalationPolicyId,
              type: "escalation_policy_reference"
            },
            alert_creation: "create_alerts_and_incidents",
            alert_grouping_parameters: {
              type: alertGroupingParameters
            },
            auto_pause_notifications_parameters: {
              enabled: true,
              timeout: 300
            }
          }
        });
        break;
      case "time":
        body = JSON.stringify({
          service: {
            type: "service",
            name,
            description,
            escalation_policy: {
              id: escalationPolicyId,
              type: "escalation_policy_reference"
            },
            alert_creation: "create_alerts_and_incidents",
            alert_grouping_parameters: {
              type: alertGroupingParameters,
              config: {
                timeout: 0
              }
            },
            auto_pause_notifications_parameters: {
              enabled: true,
              timeout: 300
            }
          }
        });
        break;
      case "content_based":
        body = JSON.stringify({
          service: {
            type: "service",
            name,
            description,
            escalation_policy: {
              id: escalationPolicyId,
              type: "escalation_policy_reference"
            },
            alert_creation: "create_alerts_and_incidents",
            alert_grouping_parameters: {
              type: alertGroupingParameters,
              config: {
                aggregate: "all",
                time_window: 0,
                fields: ["source", "summary"]
              }
            },
            auto_pause_notifications_parameters: {
              enabled: true,
              timeout: 300
            }
          }
        });
        break;
    }
  }
  const token = await getAuthToken(account);
  const options = {
    method: "POST",
    body,
    headers: {
      Authorization: token,
      Accept: "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    }
  };
  try {
    response = await fetch__default.default(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to create service: ${error}`);
  }
  switch (response.status) {
    case 400:
      throw new Error(
        `Failed to create service. Caller provided invalid arguments.`
      );
    case 401:
      throw new Error(
        `Failed to create service. Caller did not supply credentials or did not provide the correct credentials.`
      );
    case 402:
      throw new Error(
        `Failed to create service. Account does not have the abilities to perform the action.`
      );
    case 403:
      throw new Error(
        `Failed to create service. Caller is not authorized to view the requested resource.`
      );
  }
  let result;
  try {
    result = await response.json();
    const createServiceResult = {
      url: result.service.html_url,
      id: result.service.id,
      alertGrouping: alertGroupingParameters
    };
    return createServiceResult;
  } catch (error) {
    throw new Error(`Failed to parse service information: ${error}`);
  }
}
async function createServiceIntegration({
  serviceId,
  vendorId,
  account
}) {
  let response;
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services`;
  const token = await getAuthToken(account);
  const options = {
    method: "POST",
    body: JSON.stringify({
      integration: {
        name: "Backstage",
        service: {
          id: serviceId,
          type: "service_reference"
        },
        vendor: {
          id: vendorId,
          type: "vendor_reference"
        }
      }
    }),
    headers: {
      Authorization: token,
      Accept: "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    }
  };
  try {
    response = await fetch__default.default(`${baseUrl}/${serviceId}/integrations`, options);
  } catch (error) {
    throw new Error(`Failed to create service integration: ${error}`);
  }
  switch (response.status) {
    case 400:
      throw new Error(
        `Failed to create service integration. Caller provided invalid arguments.`
      );
    case 401:
      throw new Error(
        `Failed to create service integration. Caller did not supply credentials or did not provide the correct credentials.`
      );
    case 403:
      throw new Error(
        `Failed to create service integration. Caller is not authorized to view the requested resource.`
      );
    case 429:
      throw new Error(
        `Failed to create service integration. Rate limit exceeded.`
      );
  }
  let result;
  try {
    result = await response.json();
    return result.integration.integration_key ?? "";
  } catch (error) {
    throw new Error(`Failed to parse service information: ${error}`);
  }
}
async function isEventNoiseReductionEnabled(account) {
  let response;
  const baseUrl = getApiBaseUrl(account);
  const token = await getAuthToken(account);
  const options = {
    method: "GET",
    headers: {
      Authorization: token,
      Accept: "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    }
  };
  try {
    response = await fetch__default.default(`${baseUrl}/abilities`, options);
  } catch (error) {
    throw new Error(`Failed to read abilities: ${error}`);
  }
  switch (response.status) {
    case 401:
      throw new Error(
        `Failed to read abilities. Caller did not supply credentials or did not provide the correct credentials.`
      );
    case 403:
      throw new Error(
        `Failed to read abilities. Caller is not authorized to view the requested resource.`
      );
    case 429:
      throw new Error(`Failed to read abilities. Rate limit exceeded.`);
  }
  let result;
  try {
    result = await response.json();
    if (result.abilities.includes("preview_intelligent_alert_grouping") && result.abilities.includes("time_based_alert_grouping")) {
      return true;
    }
    return false;
  } catch (error) {
    throw new Error(`Failed to parse abilities information: ${error}`);
  }
}
function readOptionalString(key) {
  if (!_config) {
    return _legacyConfig.getOptionalString(key);
  }
  return _config.getOptionalString(key);
}
function readOptionalObject(key) {
  if (!_config) {
    return _legacyConfig.getOptional(key);
  }
  return _config.getOptional(key);
}
function readString(key) {
  if (!_config) {
    return _legacyConfig.getString(key);
  }
  return _config.getString(key);
}
async function getAccountByEscalationPolicyId(escalationPolicyId) {
  const escalationPoliciesList = await getAllEscalationPolicies();
  const escalationPolicy = escalationPoliciesList.find(
    (policy) => policy.id === escalationPolicyId
  );
  return escalationPolicy?.account ?? "";
}
async function getEscalationPolicies(offset, limit, account) {
  let response;
  const params = `total=true&sort_by=name&offset=${offset}&limit=${limit}`;
  const options = {
    method: "GET",
    headers: {
      Authorization: await getAuthToken(account),
      Accept: "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    }
  };
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/escalation_policies`;
  try {
    response = await fetch__default.default(`${baseUrl}?${params}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve escalation policies: ${error}`);
  }
  switch (response.status) {
    case 400:
      throw new backstagePluginCommon.HttpError(
        "Failed to list escalation policies. Caller provided invalid arguments.",
        400
      );
    case 401:
      throw new backstagePluginCommon.HttpError(
        "Failed to list escalation policies. Caller did not supply credentials or did not provide the correct credentials.",
        401
      );
    case 403:
      throw new backstagePluginCommon.HttpError(
        "Failed to list escalation policies. Caller is not authorized to view the requested resource.",
        403
      );
    case 429:
      throw new backstagePluginCommon.HttpError(
        "Failed to list escalation policies. Rate limit exceeded.",
        429
      );
  }
  let result;
  try {
    result = await response.json();
    return [result.more ?? false, result.escalation_policies];
  } catch (error) {
    throw new backstagePluginCommon.HttpError(
      `Failed to parse escalation policy information: ${error}`,
      500
    );
  }
}
async function getAllEscalationPolicies() {
  const limit = 50;
  let offset = 0;
  let moreResults = false;
  let results = [];
  await Promise.all(
    Object.keys(EndpointConfig).map(async (account) => {
      try {
        offset = 0;
        do {
          const res = await getEscalationPolicies(offset, limit, account);
          res[1].forEach((policy) => {
            policy.account = account;
          });
          results = results.concat(res[1]);
          if (res[0] === true) {
            moreResults = true;
            offset += limit;
          } else {
            moreResults = false;
          }
        } while (moreResults === true);
      } catch (error) {
        if (error instanceof backstagePluginCommon.HttpError) {
          throw error;
        } else {
          throw new backstagePluginCommon.HttpError(`${error}`, 500);
        }
      }
    })
  );
  return results;
}

const createPagerDutyServiceAction = (props) => {
  let loggerService;
  return pluginScaffolderNode.createTemplateAction({
    id: "pagerduty:service:create",
    schema: {
      input: zod.z.object({
        name: zod.z.string().min(1, "name is required").describe("Name of the service"),
        description: zod.z.string().min(1, "description is required").describe("Description of the service"),
        escalationPolicyId: zod.z.string().min(1, "Escalation policy is required").describe("Escalation policy ID"),
        alertGrouping: zod.z.string().optional().describe("Alert grouping parameters")
      }),
      output: zod.z.object({
        serviceUrl: zod.z.string().describe("PagerDuty Service URL"),
        serviceId: zod.z.string().describe("PagerDuty Service ID"),
        integrationKey: zod.z.string().describe("Backstage Integration Key")
      })
    },
    async handler(ctx) {
      try {
        loggerService = props?.logger ? props.logger : ctx.logger;
        const configService = props?.config;
        const legacyConfig = await backendCommon.loadBackendConfig({
          logger: loggerService,
          argv: []
        });
        await loadAuthConfig({
          config: configService,
          legacyConfig,
          logger: loggerService
        });
        loadPagerDutyEndpointsFromConfig({
          config: configService,
          legacyConfig,
          logger: loggerService
        });
        const account = await getAccountByEscalationPolicyId(
          ctx.input.escalationPolicyId
        );
        loggerService.info(
          `Creating service '${ctx.input.name}' in account '${account}'.`
        );
        const service = await createService({
          name: ctx.input.name,
          description: ctx.input.description,
          escalationPolicyId: ctx.input.escalationPolicyId,
          account,
          alertGrouping: ctx.input.alertGrouping
        });
        loggerService.info(`Service '${ctx.input.name}' created successfully!`);
        loggerService.info(`Alert grouping set to '${service.alertGrouping}'`);
        ctx.output("serviceUrl", service.url);
        ctx.output("serviceId", service.id);
        ctx.output("account", account);
        const backstageIntegrationId = "PRO19CT";
        loggerService.info(
          `Creating Backstage Integration for service '${ctx.input.name}' in account '${account}'.`
        );
        const integrationKey = await createServiceIntegration({
          serviceId: service.id,
          vendorId: backstageIntegrationId,
          account
        });
        loggerService.info(
          `Backstage Integration for service '${ctx.input.name}' created successfully!`
        );
        ctx.output("integrationKey", integrationKey);
      } catch (error) {
        loggerService.error(`${error}`);
      }
    }
  });
};

const pagerDutyScaffolderActions = backendPluginApi.createBackendModule({
  pluginId: "scaffolder",
  moduleId: "pagerduty-actions",
  register(env) {
    env.registerInit({
      deps: {
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        scaffolder: alpha.scaffolderActionsExtensionPoint
      },
      async init({ config, logger, scaffolder }) {
        scaffolder.addActions(
          createPagerDutyServiceAction({
            config,
            logger
          })
        );
      }
    });
  }
});

exports.createPagerDutyServiceAction = createPagerDutyServiceAction;
exports.default = pagerDutyScaffolderActions;
//# sourceMappingURL=index.cjs.js.map
