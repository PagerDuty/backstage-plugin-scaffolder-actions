import { LoggerService, RootConfigService } from "@backstage/backend-plugin-api";
import { HttpError } from "@pagerduty/backstage-plugin-common";
import { Config } from "@backstage/config";

type Auth = {
    authToken: string;
    authTokenExpiryDate: number;
}

export type LoadAuthConfigProps = {
    config: RootConfigService;
    legacyConfig: Config;
    logger: LoggerService;
}

type JsonValue = boolean | number | string | null | JsonArray | JsonObject;

interface JsonObject {
    [x: string]: JsonValue;
}

type JsonArray = JsonValue[];

let authPersistence: Auth;
let isLegacyConfig: boolean;
let _config: RootConfigService;
let _legacyConfig: Config;
let _logger: LoggerService;

export async function getAuthToken(): Promise<string> {
    // check if token already exists and is valid
    if (
        (authPersistence?.authToken?.includes('Bearer') &&
            authPersistence.authTokenExpiryDate > Date.now())  // case where OAuth token is still valid
        ||
        (authPersistence?.authToken?.includes('Token'))) { // case where API token is used
        return authPersistence.authToken;
    }

    await loadAuthConfig({
        config: _config,
        legacyConfig: _legacyConfig,
        logger: _logger,
    });
    return authPersistence.authToken;
}

export async function loadAuthConfig({config, legacyConfig, logger}: LoadAuthConfigProps) {
    try {
        // check if we are using new backend system. Fallback to legacy config if not
        isLegacyConfig = !config;

        // set config and logger
        _config = config;
        _legacyConfig = legacyConfig;
        _logger = logger;

        // initiliaze the authPersistence in-memory object
        authPersistence = {
            authToken: '',
            authTokenExpiryDate: Date.now()
        };

        if (!readOptionalString('pagerDuty.apiToken')) {
            logger.warn('No PagerDuty API token found in config file. Trying OAuth token instead...');

            if (!readOptionalObject('pagerDuty.oauth')) {
                logger.error('No PagerDuty OAuth configuration found in config file.');

            } else if (!readOptionalString('pagerDuty.oauth.clientId') || !readOptionalString('pagerDuty.oauth.clientSecret') || !readOptionalString('pagerDuty.oauth.subDomain')) {
                
                logger.error("Missing required PagerDuty OAuth parameters in config file. 'clientId', 'clientSecret', and 'subDomain' are required. 'region' is optional.");

            } else {

                authPersistence.authToken = await getOAuthToken(
                    readString('pagerDuty.oauth.clientId'),
                    readString('pagerDuty.oauth.clientSecret'),
                    readString('pagerDuty.oauth.subDomain'),
                    readOptionalString('pagerDuty.oauth.region') ?? 'us');

                logger.info('PagerDuty OAuth configuration loaded successfully.');
            }
        } else {
            authPersistence.authToken = `Token token=${readString('pagerDuty.apiToken')}`;

            logger.info('PagerDuty API token loaded successfully.');
        }
    }
    catch (error) {
        logger.error(`Unable to retrieve valid PagerDuty AUTH configuration from config file: ${error}`);
    }
}

function readOptionalString(key: string) : string | undefined {
    if (isLegacyConfig) {
        return _legacyConfig.getOptionalString(key);
    } 
    
    return _config.getOptionalString(key);
}

function readOptionalObject(key: string): JsonValue | undefined {
    if (isLegacyConfig) {
        return _legacyConfig.getOptional(key);
    }

    return _config.getOptional(key);
}

function readString(key: string) : string {
    if (isLegacyConfig) {
        return _legacyConfig.getString(key);
    } 
    
    return _config.getString(key);
}


async function getOAuthToken(clientId: string, clientSecret: string, subDomain: string, region: string): Promise<string> {
    // check if required parameters are provided
    if (!clientId || !clientSecret || !subDomain) {
        throw new Error('Missing required PagerDuty OAuth parameters.');
    }

    // define the scopes required for the OAuth token
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

    // encode the parameters for the request
    const urlencoded = new URLSearchParams();
    urlencoded.append("grant_type", "client_credentials");
    urlencoded.append("client_id", clientId);
    urlencoded.append("client_secret", clientSecret);
    urlencoded.append("scope", `as_account-${region}.${subDomain} ${scopes}`);

    let response: Response;
    const options: RequestInit = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: urlencoded,
    };
    const baseUrl = 'https://identity.pagerduty.com/oauth/token';

    try {
        response = await fetch(baseUrl, options);
    } catch (error) {
        throw new Error(`Failed to retrieve oauth token: ${error}`);
    }

    switch (response.status) {
        case 400:
            throw new HttpError("Failed to retrieve valid token. Bad Request - Invalid arguments provided.", 400);
        case 401:
            throw new HttpError("Failed to retrieve valid token. Forbidden - Invalid credentials provided.", 401);
        default: // 200
            break;
    }

    const authResponse = await response.json();
    authPersistence.authTokenExpiryDate = Date.now() + (authResponse.expires_in * 1000);
    return `Bearer ${authResponse.access_token}`;
}