const http = require('http');

const data = JSON.stringify({
    runDate: "2026-01-29",
    topK: 10,
    filters: {
        market: "us",
        minMarketCap: 0,
        minBeta1Y: 0,
        minDollarVolume1M: 0
    }
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/screen/run',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log('Body:', body);
    });
});

req.on('error', error => {
    console.error(error);
});

req.write(data);
req.end();
