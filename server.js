require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Bypass self-signed/corporate SSL certificate issues
const express = require('express');
const cors = require('cors');
const path = require('path');
const { wrapper } = require('axios-cookiejar-support');
const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const multer = require('multer');

// Configure multer to keep uploaded files in memory and enforce a reasonable upload size limit
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB per file
        fieldSize: 50 * 1024 * 1024 // 50 MB total form payload
    }
});

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.xls', '.xlsx', '.csv', '.txt']);
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
]);
const ALLOWED_ATTACHMENT_LABEL = 'PDF, PNG, JPG, JPEG, XLS, XLSX, CSV, TXT';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Every response here is dynamic per-user SAP data — instruct any CDN/proxy/browser in front of this
// server to never cache it, so a stale response can't be replayed for a different request.
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Standard Request Logging Middleware & Lambda Body Normalizer (Buffer + Base64 + Raw String + JSON)
app.use((req, res, next) => {
    let bodyData = req.body || {};

    if (Buffer.isBuffer(bodyData)) {
        try { bodyData = JSON.parse(bodyData.toString('utf-8')); } catch (e) { }
    } else if (bodyData && typeof bodyData === 'object' && bodyData.type === 'Buffer' && Array.isArray(bodyData.data)) {
        try { bodyData = JSON.parse(Buffer.from(bodyData.data).toString('utf-8')); } catch (e) { }
    } else if (typeof bodyData === 'string' && bodyData.trim()) {
        let rawStr = bodyData.trim();
        if (!rawStr.startsWith('{') && !rawStr.startsWith('[')) {
            try { rawStr = Buffer.from(rawStr, 'base64').toString('utf-8'); } catch (e) { }
        }
        try { bodyData = JSON.parse(rawStr); } catch (e) { }
    }

    req.body = bodyData;
    try {
        console.log('[INCOMING REQUEST] ', req.method, req.path, 'url=', req.url, 'bodyKeys=', Object.keys(req.body || {}));
    } catch (e) { }
    next();
});

// --- Configuration ---
const SAP_BASE_URL = process.env.SAP_BASE_URL || 'https://emamidev.emami.local:4440/sap/opu/odata/sap/ZFI_EXPCLAIM_SRV';
const AZURE_OAUTH_TOKEN_URL = process.env.AZURE_OAUTH_TOKEN_URL || process.env.OAUTH_TOKEN_URL;
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || process.env.CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || process.env.CLIENT_SECRET;
const AZURE_SCOPE = process.env.AZURE_SCOPE || process.env.OAUTH_SCOPE;

const tokenCache = {
    accessToken: null,
    expiresAt: 0,
    inflight: null
};

const isTokenValid = () => {
    return tokenCache.accessToken && Date.now() + 60000 < tokenCache.expiresAt;
};

const invalidateAzureToken = () => {
    tokenCache.accessToken = null;
    tokenCache.expiresAt = 0;
};

const refreshAzureToken = async () => {
    if (!AZURE_OAUTH_TOKEN_URL || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_SCOPE) {
        throw new Error('Azure OAuth credentials are not fully configured');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', AZURE_CLIENT_ID);
    params.append('client_secret', AZURE_CLIENT_SECRET);
    params.append('scope', AZURE_SCOPE);

    const response = await axios.post(AZURE_OAUTH_TOKEN_URL, params.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000
    });

    const data = response.data || {};
    if (!data.access_token) {
        throw new Error(`Azure token fetch failed: ${data.error_description || data.error || 'missing access_token'}`);
    }

    const expiresIn = Number(data.expires_in || 3600);
    tokenCache.accessToken = data.access_token;
    tokenCache.expiresAt = Date.now() + (expiresIn * 1000) - 60000;
    return tokenCache.accessToken;
};

const getAzureAccessToken = async () => {
    if (isTokenValid()) {
        return tokenCache.accessToken;
    }
    if (tokenCache.inflight) {
        return tokenCache.inflight;
    }
    tokenCache.inflight = refreshAzureToken().finally(() => {
        tokenCache.inflight = null;
    });
    return tokenCache.inflight;
};

// --- Axios Client Setup ---
// Setting up the cookie jar to automatically manage SAP session cookies
const jar = new CookieJar();
const client = wrapper(axios.create({
    jar,
    withCredentials: true,
    headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'DataServiceVersion': '2.0',
        'Accept': 'application/json'
    }
}));

// Note: Azure API Gateway may reject SAP-specific query parameters such as sap-client/saml2.
// These are removed from the default request config for gateway-based calls.


client.interceptors.request.use(async request => {
    if (!request.headers) {
        request.headers = {};
    }

    try {
        const token = await getAzureAccessToken();
        request.headers.Authorization = `Bearer ${token}`;
    } catch (tokenError) {
        console.error('[AUTH] Failed to acquire Azure token:', tokenError.message || tokenError);
        throw tokenError;
    }

    console.log('[DEBUG] Final URL to SAP:', client.getUri(request));
    return request;
});

client.interceptors.response.use(
    response => response,
    async error => {
        const status = error?.response?.status;
        const originalRequest = error?.config;

        if ((status === 401 || status === 403) && originalRequest && !originalRequest.__retry) {
            originalRequest.__retry = true;
            invalidateAzureToken();

            try {
                const token = await getAzureAccessToken();
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return client.request(originalRequest);
            } catch (retryError) {
                return Promise.reject(retryError);
            }
        }

        return Promise.reject(error);
    }
);

const ENABLE_ROLE_AUTO_DETECTION = true;
const DEFAULT_ROLE = 'employee';

const normalizeRole = (role) => {
    const normalized = (role || '').toString().toLowerCase();
    return normalized === 'manager' || normalized === 'finance' || normalized === 'employee'
        ? normalized
        : DEFAULT_ROLE;
};

const mapSapRole = (rawRole) => {
    if (!rawRole) return null;
    const role = rawRole.toString().trim().toUpperCase();
    if (role === 'M' || role === 'MANAGER') return 'manager';
    if (role === 'F' || role === 'FINANCE') return 'finance';
    if (role === 'E' || role === 'EMPLOYEE') return 'employee';
    return null;
};

const encodeODataFilter = (filter) => encodeURIComponent(filter).replace(/%20/g, '%20');

const detectUserRole = async (loginId) => {
    if (!ENABLE_ROLE_AUTO_DETECTION) {
        return DEFAULT_ROLE;
    }

    const sanitizedLoginId = (loginId || '').toString().trim().replace(/\D/g, '').padStart(8, '0');
    const entityCandidates = ['ZEXP_MASTERSet', 'ZEXP_MASTER', 'Zexp_MasterSet', 'Zexp_Master'];
    const filterCandidates = [
        `PERNR_D eq '${sanitizedLoginId}' or L1 eq '${sanitizedLoginId}' or L2 eq '${sanitizedLoginId}'`,
        `PERNR_D eq '${sanitizedLoginId}' or ManagerL1 eq '${sanitizedLoginId}' or ManagerL2 eq '${sanitizedLoginId}'`,
        `PERNR eq '${sanitizedLoginId}' or L1 eq '${sanitizedLoginId}' or L2 eq '${sanitizedLoginId}'`
    ];

    for (const entityName of entityCandidates) {
        for (const filter of filterCandidates) {
            const url = `${SAP_BASE_URL}/${entityName}?$format=json&$filter=${encodeODataFilter(filter)}`;
            try {
                const response = await client.get(url, { timeout: 8000 });
                const results = response?.data?.d?.results || response?.data?.results || [];

                const count = Array.isArray(results) ? results.length : (results ? Object.keys(results).length : 0);
                console.log(`[ROLE-DETECT] ${entityName} filter="${filter}" count=${count}`);

                if (Array.isArray(results) && results.length > 0) {
                    return 'manager';
                }

                if (results && typeof results === 'object' && Object.keys(results).length > 0) {
                    return 'manager';
                }
            } catch (error) {
                console.log(`[ROLE-DETECT] failed entity=${entityName} filter="${filter}"`, error?.response?.status || error?.message);
            }
        }
    }

    return DEFAULT_ROLE;
};

// --- Routes ---

// Example GET Route
app.get(['/get-data', '/api/get-data'], async (req, res) => {
    try {
        const loginId = req.query.loginId || req.query.empId || '00009021'; // Default if not provided
        const expand = req.query.expand ? `&$expand=${encodeURIComponent(req.query.expand)}` : '';

        // Use GET_ENTITYSET with filter as requested by the user
        // We append the query manually because Axios encodes spaces as '+' which breaks SAP OData $filter
        const url = `${SAP_BASE_URL}/ClaimHeaderSet?$filter=LoginId%20eq%20'${loginId}'${expand}&$format=json`;
        const response = await client.get(url);


        res.json(response.data);
    } catch (error) {
        console.error('Error in GET /api/get-data:', error?.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch data from SAP' });
    }
});

app.get(['/history-set', '/api/history-set'], async (req, res) => {
    try {
        const rawLoginId = (req.query.loginId || req.query.empId || '').toString();
        const sanitizedLoginId = rawLoginId.replace(/\D/g, '').padStart(8, '0');
        if (!sanitizedLoginId || sanitizedLoginId.length > 8) {
            return res.status(400).json({ error: 'Invalid Employee ID' });
        }

        const url = `${SAP_BASE_URL}/HistorySet?$filter=ActionBy%20eq%20'${sanitizedLoginId}'&$format=json`;
        console.log('[HISTORY] requesting URL:', url);
        const response = await client.get(url);

        res.json(response.data);
    } catch (error) {
        console.error('Error in GET /api/history-set:');
        console.error('  url:', error?.config?.url || 'n/a');
        console.error('  message:', error?.message);
        console.error('  status:', error?.response?.status || 'n/a');
        console.error('  response data:', JSON.stringify(error?.response?.data || error?.message, null, 2));
        res.status(500).json({ error: 'Failed to fetch history data from SAP' });
    }
});

app.get(['/get-expense-types', '/api/get-expense-types'], async (req, res) => {
    try {
        const rawLoginId = (req.query.loginId || req.query.empId || '').toString().replace(/\D/g, '');
        const loginId = rawLoginId ? rawLoginId.padStart(8, '0') : '';
        const params = {
            $format: 'json'
        };
        if (loginId) {
            params.$filter = `LoginId eq '${loginId}'`;
        }

        const response = await client.get(`${SAP_BASE_URL}/ExptypeSet`, {
            params
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error in GET /api/get-expense-types:', error?.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch expense types from SAP' });
    }
});

// Fetch GST master data (GstSet) for the logged-in user if available
app.get(['/get-gst', '/api/get-gst'], async (req, res) => {
    try {
        const gstin = (req.query.gstin || '').toString().replace(/\s+/g, '').toUpperCase();
        const filterParam = gstin && gstin.length === 15 ? `&$filter=${encodeODataFilter(`Stcd3 eq '${gstin}'`)}` : '';
        const url = `${SAP_BASE_URL}/GstSet?$format=json${filterParam}`;
        const response = await client.get(url, { timeout: 8000 });
        res.json(response.data);
    } catch (error) {
        console.error('Error in GET /api/get-gst:', error?.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch GstSet from SAP' });
    }
});

app.get(['/claim-header/:id', '/api/claim-header/:id'], async (req, res) => {
    try {
        const claimId = req.params.id;
        const expand = req.query.expand || 'CLAIMNAV,HISTORYNAV';

        const url = `${SAP_BASE_URL}/ClaimHeaderSet('${claimId}')?$format=json&$expand=${encodeURIComponent(expand)}`;
        const response = await client.get(url);

        res.json(response.data);
    } catch (error) {
        console.error('Error in GET /api/claim-header/:id:', error?.response?.data || error.message);
        const status = error?.response?.status || 500;
        res.status(status).json({ error: 'Failed to fetch claim header from SAP' });
    }
});

// Root Route Health Check
app.get('/', async (req, res) => {
    res.json({ status: 'API is live', message: 'Non-CTC Expense Backend running on AWS Lambda' });
});

// Call SAP LoginSet to generate/send OTP using GET_ENTITY
app.get(['/send-otp', '/api/send-otp'], async (req, res) => {
    try {
        // Now getting loginId from frontend
        const rawLoginId = (req.query.loginId || req.query.empId || '').toString();
        const sanitizedLoginId = rawLoginId.replace(/\D/g, '');
        if (!sanitizedLoginId || sanitizedLoginId.length > 8) {
            return res.status(400).json({ error: 'Invalid Employee ID' });
        }

        const loginId = sanitizedLoginId.padStart(8, '0');

        // Calling LoginSet using explicit LoginId key to perfectly match the ABAP property
        const response = await client.get(`${SAP_BASE_URL}/LoginSet(LoginId='${loginId}')`, {
            params: {
                $format: 'json'
            }
        });

        const sapResponse = response.data?.d || response.data || {};
        const sapErrorType = (sapResponse.Type || sapResponse.type || '').toString().toUpperCase();
        const sapMessage = sapResponse.Message || sapResponse.message || 'Unable to send OTP';
        const sapEmail = (sapResponse.Email || sapResponse.email || '').toString().trim();

        if (sapErrorType === 'E') {
            return res.status(400).json({ error: sapMessage, sapResponse });
        }

        if (!sapResponse.LoginId && !sapResponse.loginId) {
            return res.status(404).json({ error: 'Employee ID not found' });
        }

        if (!sapEmail) {
            return res.status(400).json({ error: 'Employee ID is not registered for email OTP', sapResponse });
        }

        res.json(response.data);
    } catch (error) {
        console.error('Error in GET /api/send-otp:', error?.response?.data || error.message);

        if (error?.response?.status === 404) {
            return res.status(404).json({ error: 'Employee ID not found' });
        }

        res.status(500).json({ error: 'Failed to send OTP via SAP LoginSet' });
    }
});

// Call SAP LoginSet to Verify OTP (Using POST)
app.post(['/', '/verify-otp', '/api/verify-otp'], async (req, res) => {
    try {
        let bodyData = req.body || {};
        if (typeof bodyData === 'string') {
            try { bodyData = JSON.parse(bodyData); } catch (e) { }
        }

        const loginId = bodyData.loginId || bodyData.LoginId || bodyData.empId || req.query.loginId;
        const otp = bodyData.otp || bodyData.Otp || req.query.otp;
        const email = bodyData.email || bodyData.Email || "";

        if (!loginId || !otp) {
            return res.status(400).json({ error: 'loginId and otp are required' });
        }

        const rawLoginId = (loginId || '').toString();
        const sanitizedLoginId = rawLoginId.replace(/\D/g, '');
        if (!sanitizedLoginId || sanitizedLoginId.length > 8) {
            return res.status(400).json({ error: 'Invalid Employee ID' });
        }

        const paddedLoginId = sanitizedLoginId.padStart(8, '0');

        // Construct the verification payload using the normalized LoginId
        const payload = {
            LoginId: paddedLoginId,
            Otp: otp,
            Email: email || "",
        };

        const loginSetCollectionUrl = `${SAP_BASE_URL}/LoginSet`;

        // Post directly to LoginSet, matching the working Postman flow.
        const response = await client.post(loginSetCollectionUrl, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const sapResponse = response.data?.d || response.data || {};
        const sapRole = mapSapRole(sapResponse.Role || sapResponse.role);
        const autoRole = normalizeRole(await detectUserRole(loginId));
        const detectedRole = sapRole || autoRole;

        console.log(`[AUTH] SAP role for ${loginId}: ${sapResponse.Role || sapResponse.role}`);
        console.log(`[AUTH] Detected role for ${loginId}: ${detectedRole}`);

        const sapErrorType = (sapResponse.Type || sapResponse.type || '').toString().toUpperCase();
        const sapMessage = sapResponse.Message || sapResponse.message || '';

        if (sapErrorType === 'E') {
            return res.status(401).json({
                error: sapMessage || 'Invalid OTP',
                role: detectedRole,
                roleSource: sapRole ? 'sap' : (ENABLE_ROLE_AUTO_DETECTION ? 'auto-detect' : 'fallback'),
                sapResponse,
            });
        }

        res.json({
            ...sapResponse,
            role: detectedRole,
            roleSource: sapRole ? 'sap' : (ENABLE_ROLE_AUTO_DETECTION ? 'auto-detect' : 'fallback')
        });
    } catch (error) {
        console.error('Error in POST /api/verify-otp:');
        console.error('  message:', error?.message);
        console.error('  status:', error?.response?.status || 'n/a');
        console.error('  data:', JSON.stringify(error?.response?.data || error?.message, null, 2));
        console.error('  headers:', JSON.stringify(error?.response?.headers || {}, null, 2));
        console.error('  request url:', error?.config?.url || 'n/a');
        console.error('  request method:', error?.config?.method || 'n/a');
        console.error('  request headers:', JSON.stringify(error?.config?.headers || {}, null, 2));
        console.error(error?.stack || 'no stack');
        res.status(error?.response?.status || 500).json({
            error: error?.response?.data?.error?.message?.value || error?.response?.data || 'Failed to verify OTP in SAP'
        });
    }
});

// Example POST Route (Now accepting multipart/form-data)
app.post(['/submit', '/api/submit'], upload.any(), async (req, res) => {
    console.log('\n=== [SUBMIT] NEW CLAIM SUBMISSION RECEIVED ===\n');
    try {
        // 2. Parse the JSON data sent from the mobile app
        let postData;
        try {
            // Expo app sends 'claimData' as a stringified JSON field or object
            if (typeof req.body?.claimData === 'string') {
                postData = JSON.parse(req.body.claimData);
            } else if (req.body?.claimData && typeof req.body.claimData === 'object') {
                postData = req.body.claimData;
            } else if (typeof req.body === 'string') {
                postData = JSON.parse(req.body);
            } else {
                postData = req.body;
            }
        } catch (e) {
            return res.status(400).json({ error: 'Missing or invalid claimData JSON in form body' });
        }

        // 3. Attach any uploaded files to their respective line items
        // Expo should send files with field names like 'receipt_0', 'receipt_1' matching the index in CLAIMNAV
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                const extension = path.extname(file.originalname || '').toLowerCase();
                const mimetype = (file.mimetype || '').toLowerCase();
                if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension) || !ALLOWED_ATTACHMENT_MIME_TYPES.has(mimetype)) {
                    throw Object.assign(
                        new Error(`Unsupported attachment "${file.originalname}". Allowed file types: ${ALLOWED_ATTACHMENT_LABEL}.`),
                        { statusCode: 400 }
                    );
                }

                const match = file.fieldname.match(/receipt_(\d+)/);
                if (match) {
                    const index = parseInt(match[1], 10);
                    if (postData.CLAIMNAV && postData.CLAIMNAV[index]) {
                        // Inject the file data as Base64 for SAP
                        postData.CLAIMNAV[index].Value = file.buffer.toString('base64');
                        postData.CLAIMNAV[index].Mimetype = file.mimetype;
                        postData.CLAIMNAV[index].Filename = file.originalname;
                    }
                }
            });
        }

        // 4. Make the actual POST request to SAP
        const response = await client.post(`${SAP_BASE_URL}/ClaimHeaderSet`, postData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // 5. Extract ClaimId from the SAP response (handle OData wrapper)
        console.log('[SUBMIT] Full SAP Response:', JSON.stringify(response.data, null, 2));

        // SAP wraps response in "d" property for OData format
        const sapResponse = response.data.d || response.data;

        // Try multiple possible property names for the ClaimId
        const claimId = sapResponse.ClaimId
            || sapResponse.ClaimID
            || sapResponse['ClaimId']
            || sapResponse.id;

        console.log('[SUBMIT] Extracted ClaimId:', claimId);
        console.log('[SUBMIT] sapResponse keys:', Object.keys(sapResponse));
        console.log('[SUBMIT] response.data.d:', response.data.d ? 'EXISTS' : 'MISSING');
        console.log('[SUBMIT] response.data.d.ClaimId:', response.data.d?.ClaimId);

        if (!claimId) {
            console.error('[SUBMIT] ERROR: ClaimId not found in response!');
            console.error('[SUBMIT] Full sapResponse:', JSON.stringify(sapResponse, null, 2));
            return res.status(500).json({ error: 'Failed to extract ClaimId from SAP response' });
        }

        // Return a consistent response format with the ClaimId
        res.json({
            ClaimId: claimId,
            Status: sapResponse.Status,
            Message: 'Claim submitted successfully'
        });
    } catch (error) {
        console.error('\n--- SAP ERROR ---');
        console.error('  message:', error?.message);
        console.error('  status:', error?.response?.status || 'n/a');
        console.error('  data:', JSON.stringify(error?.response?.data || error?.message, null, 2));
        console.error('  headers:', JSON.stringify(error?.response?.headers || {}, null, 2));
        console.error('  request url:', error?.config?.url || 'n/a');
        console.error('  request method:', error?.config?.method || 'n/a');
        console.error('  request headers:', JSON.stringify(error?.config?.headers || {}, null, 2));
        console.error(error?.stack || 'no stack');
        console.error('-----------------\n');
        res.status(error?.statusCode || error?.response?.status || 500).json({
            error: error?.response?.data?.error?.message?.value || error?.response?.data || 'Failed to submit data to SAP'
        });
    }
});

// Multer and body parser error handler for file upload size issues and large JSON payloads
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const isTooLarge = err && (
        err.code === 'LIMIT_FILE_SIZE' ||
        err.code === 'LIMIT_FIELD_SIZE' ||
        err.type === 'entity.too.large' ||
        err.type === 'request.entity.too.large' ||
        err.message?.includes('PayloadTooLargeError') ||
        err.message?.includes('request entity too large')
    );

    if (isTooLarge) {
        return res.status(413).json({ error: 'Uploaded file is too large. Please attach a smaller file.' });
    }

    if (err && err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON request body.' });
    }

    next(err);
});

// --- Approve or Reject Claim via PUT ---
app.put(['/approve-claim/:id', '/api/approve-claim/:id'], async (req, res) => {
    try {
        const claimId = req.params.id;
        const { putData } = req.body;

        if (!putData || typeof putData !== 'object') {
            return res.status(400).json({ error: 'putData is required in request body' });
        }

        const updateKey = (putData?.ClaimId || claimId || '').toString();
        if (!updateKey) {
            return res.status(400).json({ error: 'Claim ID is required for approval/rejection' });
        }

        const postUrl = `${SAP_BASE_URL}/ClaimHeaderSet`;
        console.log('[APPROVAL] claimId param=', claimId, 'putData.ClaimId=', putData.ClaimId, 'updateKey=', updateKey);
        console.log('[APPROVAL] POST URL=', postUrl);

        const response = await client.post(postUrl, putData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        res.json({ success: true, data: response.data });
    } catch (error) {
        const sapErrorMsg = error?.response?.data?.error?.message?.value || error.message || 'Unknown SAP Error';
        console.error('\n--- SAP APPROVAL ERROR ---');
        console.error('status:', error?.response?.status || 'n/a');
        console.error('url:', error?.config?.url || 'n/a');
        console.error('method:', error?.config?.method || 'n/a');
        console.error('response data:', JSON.stringify(error?.response?.data || error?.message, null, 2));
        console.error('headers:', JSON.stringify(error?.response?.headers || {}, null, 2));
        console.error('--------------------------\n');
        res.status(error?.response?.status || 500).json({ error: sapErrorMsg });
    }
});

// --- Serve Static Files & SPA Routing Fallback ---
// Serve static frontend files from Expo build 'dist' directory
const fs = require('fs');
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback middleware for Single Page Application (SPA) routing (Express 5 / Node 24 safe)
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    const distIndexPath = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(distIndexPath)) {
        res.sendFile(distIndexPath);
    } else {
        next();
    }
});

// --- Start Server ---
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}

module.exports = app;

