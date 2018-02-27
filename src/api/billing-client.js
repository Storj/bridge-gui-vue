import axios from 'axios';
import config from '../../config';
import Client from './client';

const billingClient = new Client({
  baseURL: config.app.BILLING_URL,
  bridgeURL: config.app.BRIDGE_URL,
  httpClient: axios
});

export default billingClient;
