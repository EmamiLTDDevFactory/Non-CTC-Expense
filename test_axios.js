const axios = require('axios');
const client = axios.create();
console.log(client.getUri({
    url: 'http://dummy/ClaimHeaderSet',
    params: {
        $filter: "LoginId eq '90000013'",
        $format: 'json'
    }
}));
