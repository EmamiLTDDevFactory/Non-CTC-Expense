process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const jar = new CookieJar();
const client = wrapper(axios.create({
    jar,
    withCredentials: true,
    auth: { username: 'IT_FCOMMON', password: 'Emami@1234' },
    params: { 'sap-client': '900', 'saml2': 'disabled' }
}));

const SAP_BASE_URL = 'https://emamidev.emami.local:4440/sap/opu/odata/sap/ZFI_EXPCLAIM_SRV';

const payload = {
  ClaimId: '',
  EmpId: '10001234',
  EmpName: 'Test User',
  Department: 'IT',
  Designation: 'Developer',
  TotalAmount: '500.000',
  Currency: 'INR',
  CostCenter: 'CC1001',
  Status: 'N',
  CLAIMNAV: [
    {
      ClaimId: '',
      ItemNo: '000001',
      ExpenseType: 'Travel',
      Amount: '500.000',
      Currency: 'INR',
      VendorName: 'Test Vendor',
      Description: 'Test Expense'
    }
  ]
};

client.get(SAP_BASE_URL, { headers: { 'X-CSRF-Token': 'Fetch' } })
  .then(csrfRes => {
      const csrfToken = csrfRes.headers['x-csrf-token'];
      return client.post(`${SAP_BASE_URL}/ClaimHeaderSet`, payload, {
          headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' }
      });
  })
  .then(res => console.log('POST SUCCESS:', res.data))
  .catch(err => {
      console.error('POST FAILED!');
      if (err.response) {
          console.error(JSON.stringify(err.response.data, null, 2));
      } else {
          console.error(err.message);
      }
  });
