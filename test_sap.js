process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config();
const { wrapper } = require('axios-cookiejar-support');
const axios = require('axios');
const { CookieJar } = require('tough-cookie');

const SAP_BASE_URL = process.env.SAP_BASE_URL || 'https://emamidev.emami.local:4440/sap/opu/odata/sap/ZFI_EXPCLAIM_SRV';
const SAP_USERNAME = process.env.SAP_USERNAME || 'IT_FCOMMON';
const SAP_PASSWORD = process.env.SAP_PASSWORD || 'Emami@1234';

const jar = new CookieJar();
const client = wrapper(axios.create({
    jar,
    withCredentials: true,
    auth: { username: SAP_USERNAME, password: SAP_PASSWORD },
    params: { 'sap-client': '900', 'saml2': 'disabled' },
    headers: { 'X-Requested-With': 'XMLHttpRequest', 'DataServiceVersion': '2.0', 'Accept': 'application/json' }
}));

client.interceptors.request.use(request => {
  console.log('Final URL:', client.getUri(request));
  return request;
});

async function test() {
    try {
        const response2 = await client.get(SAP_BASE_URL + '/ClaimHeaderSet', {
            params: {
                $filter: "LoginId eq '90000013'",
                $format: 'json'
            }
        });
        console.log('Data:', JSON.stringify(response2.data).substring(0, 300));
    } catch (e) {
        console.log('Error LoginId:', e.response?.data?.error?.message?.value || e.message);
    }
}
test();
