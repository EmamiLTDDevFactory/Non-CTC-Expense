process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { wrapper } = require('axios-cookiejar-support');
const axios = require('axios');
const { CookieJar } = require('tough-cookie');

const SAP_BASE_URL = 'https://emamidev.emami.local:4440/sap/opu/odata/sap/ZFI_EXPCLAIM_SRV';
const jar = new CookieJar();
const client = wrapper(axios.create({
    jar,
    withCredentials: true,
    auth: { username: 'IT_FCOMMON', password: 'Emami@1234' },
    params: { 'sap-client': '900', 'saml2': 'disabled' },
    headers: { 'X-Requested-With': 'XMLHttpRequest', 'DataServiceVersion': '2.0', 'Accept': 'application/json' }
}));

async function test() {
    try {
        const payload = { LoginId: '90000013', Otp: '123456', Email: '' };
        const csrfRes = await client.get(SAP_BASE_URL, { headers: { 'X-CSRF-Token': 'Fetch' } });
        const csrfToken = csrfRes.headers['x-csrf-token'];

        const response = await client.post(SAP_BASE_URL + '/LoginSet', payload, {
            headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
            params: { $format: 'json' }
        });
        console.log('Success:', response.data);
    } catch (error) {
        console.log('FAIL:', error.message);
        console.log('DATA:', error.response?.data);
    }
}
test();
