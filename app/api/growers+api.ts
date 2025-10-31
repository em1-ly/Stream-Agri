import axios from "axios";
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';



export async function POST(request: Request) {
  console.log('Odoo Growers API Called');
  try {
    // const {apiBaseUrl, session_token, test   } = await request.json();
    const body = await request.json();
    console.log('request', request);
    console.log('body', body);
    console.log('apiBaseUrl', body.apiBaseUrl);
    console.log('sessionToken', body.session_token);
    console.log('test', body.test);
    const options = {
      method: 'POST',
      url: `${body.apiBaseUrl}/api/fo/growers`,
      headers: {
        'X-FO-TOKEN': body.session_token,
        'cookie': body.adminSessionToken,
        'Content-Type': 'application/json',
      },
      data: {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {},
        "id": null
      }
    };

    console.log('Sending request to:', options.url);
    console.log('Request payload:', JSON.stringify(options.data));
    
    // Make the request to the Odoo API
    const response = await axios.request(options);
    console.log('API response status:', response.status);
    console.log('API response data:', JSON.stringify(response.data).substring(0, 200) + '...');
    
    // Return the response data
    return new Response(JSON.stringify(response.data), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

    return new Response(JSON.stringify({ message: 'Growers API called' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error: any) {
    console.log('API error:', error);
    let errorMessage = error.message;
    let statusCode = 500;
    
    // Check if it's an Axios error with a response
    if (error.response) {
      errorMessage = error.response.data?.error || error.message;
      statusCode = error.response.status || 500;
      console.log('Response error data:', error.response.data);
    }
    
    // Log more detailed information about the error
    console.log('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: error.response?.data || 'No additional details'
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: statusCode
    });
  }
}